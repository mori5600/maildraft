import {
  TextlintKernel,
  type TextlintKernelRule,
  type TextlintMessage,
  type TextlintRuleOptions,
} from "@textlint/kernel";
import textPluginModule from "@textlint/textlint-plugin-text";
import noInvalidControlCharacterRuleModule from "@textlint-rule/textlint-rule-no-invalid-control-character";
import noKangxiRadicalsRuleModule from "textlint-rule-no-kangxi-radicals";
import noNfdRuleModule from "textlint-rule-no-nfd";
import noZeroWidthSpacesRuleModule from "textlint-rule-no-zero-width-spaces";
import prhRuleModule from "textlint-rule-prh";
import sentenceLengthRuleModule from "textlint-rule-sentence-length";

import type { DraftInput } from "../model";
import {
  discouragedPhraseRules,
  doubleHonorificPhraseRules,
  type DraftProofreadingPhraseRule,
} from "./build-proofreading-issues";
import {
  createDraftProofreadingIssueId,
  type DraftProofreadingEditableField,
  type DraftProofreadingIssue,
  type DraftProofreadingLocation,
  type DraftProofreadingSeverity,
  type DraftProofreadingSuggestion,
  sortDraftProofreadingIssues,
} from "./model";

interface DetailedProofreadingRequest {
  draft: DraftInput;
}

interface DetailedRuleDefinition {
  description: string;
  severity?: DraftProofreadingSeverity;
  title: string;
}

interface DetailedTargetField {
  field: DraftProofreadingEditableField;
  includeTextlintRules: boolean;
  text: string;
}

interface DetailedFieldCacheEntry {
  includeTextlintRules: boolean;
  issues: DraftProofreadingIssue[];
  text: string;
}

export interface DetailedDraftProofreadingSession {
  clear: () => void;
  run: (request: DetailedProofreadingRequest) => Promise<DraftProofreadingIssue[]>;
}

ensureProcessShim();

const textPlugin = unwrapModuleDefault(textPluginModule);
const noInvalidControlCharacterRule = unwrapModuleDefault(noInvalidControlCharacterRuleModule);
const noKangxiRadicalsRule = unwrapModuleDefault(noKangxiRadicalsRuleModule);
const noNfdRule = unwrapModuleDefault(noNfdRuleModule);
const noZeroWidthSpacesRule = unwrapModuleDefault(noZeroWidthSpacesRuleModule);
const prhRule = unwrapModuleDefault(prhRuleModule);
const sentenceLengthRule = unwrapModuleDefault(sentenceLengthRuleModule);
const textPlugins = [
  {
    plugin: textPlugin,
    pluginId: "text",
  },
];
const prhRuleEntry: TextlintKernelRule = {
  options: {
    ruleContents: [buildPrhRuleContent([...discouragedPhraseRules, ...doubleHonorificPhraseRules])],
  } as TextlintRuleOptions,
  rule: prhRule,
  ruleId: "prh",
};
const workerSafeTextlintRuleEntries: TextlintKernelRule[] = [
  {
    options: {
      max: 100,
    } as TextlintRuleOptions,
    rule: sentenceLengthRule,
    ruleId: "sentence-length",
  },
  {
    options: undefined,
    rule: noNfdRule,
    ruleId: "no-nfd",
  },
  {
    options: undefined,
    rule: noInvalidControlCharacterRule,
    ruleId: "no-invalid-control-character",
  },
  {
    options: undefined,
    rule: noZeroWidthSpacesRule,
    ruleId: "no-zero-width-spaces",
  },
  {
    options: undefined,
    rule: noKangxiRadicalsRule,
    ruleId: "no-kangxi-radicals",
  },
];
const detailedRuleSets = {
  prhOnly: [prhRuleEntry],
  withTextlint: [...workerSafeTextlintRuleEntries, prhRuleEntry],
};
const phraseRuleIndex = new Map(
  [...discouragedPhraseRules, ...doubleHonorificPhraseRules].map((rule) => [rule.phrase, rule]),
);
const detailedRuleDefinitions = new Map<string, DetailedRuleDefinition>([
  [
    "max-ten",
    {
      description: "読点が多く、1文が詰まって見える可能性があります。",
      severity: "info",
      title: "読点がやや多い可能性があります。",
    },
  ],
  [
    "no-doubled-conjunctive-particle-ga",
    {
      description: "逆接の「が」が重なり、文意が読み取りにくくなることがあります。",
      title: "逆接表現が重なっている可能性があります。",
    },
  ],
  [
    "no-doubled-conjunction",
    {
      description: "接続詞が重なると、文の流れがくどく見えることがあります。",
      title: "接続詞が重複している可能性があります。",
    },
  ],
  [
    "no-double-negative-ja",
    {
      description: "二重否定は意図が伝わりにくいため、単純な形に寄せる方が安全です。",
      title: "二重否定の可能性があります。",
    },
  ],
  [
    "no-doubled-joshi",
    {
      description: "同じ助詞が続くと、文章が引っかかって読まれやすくなります。",
      title: "助詞が重複している可能性があります。",
    },
  ],
  [
    "sentence-length",
    {
      description: "一文が長いため、メールでは分割した方が読みやすくなることがあります。",
      severity: "info",
      title: "一文が長い可能性があります。",
    },
  ],
  [
    "no-dropping-the-ra",
    {
      description: "ら抜き言葉が含まれている可能性があります。",
      title: "口語的な表現の可能性があります。",
    },
  ],
  [
    "no-mix-dearu-desumasu",
    {
      description: "ですます調とである調が混ざると、メール文体が不安定に見えます。",
      title: "文体が混在している可能性があります。",
    },
  ],
  [
    "no-nfd",
    {
      description: "結合文字が混ざっているため、環境によって表示が崩れる可能性があります。",
      title: "文字正規化の揺れがあります。",
    },
  ],
  [
    "no-invalid-control-character",
    {
      description: "制御文字が含まれているため、コピーや表示に影響する可能性があります。",
      severity: "warning",
      title: "制御文字が含まれています。",
    },
  ],
  [
    "no-zero-width-spaces",
    {
      description: "ゼロ幅スペースは見えずに残りやすく、コピー後も気づきにくい文字です。",
      title: "ゼロ幅スペースが含まれています。",
    },
  ],
  [
    "no-kangxi-radicals",
    {
      description: "一部環境で置換や検索がしづらい文字が含まれている可能性があります。",
      title: "互換性の低い漢字が含まれている可能性があります。",
    },
  ],
  [
    "prh",
    {
      description: "メール向けの推奨表現に置き換える候補です。",
      title: "表現の言い換え候補があります。",
    },
  ],
]);

export async function runDetailedDraftProofreading({
  draft,
}: DetailedProofreadingRequest): Promise<DraftProofreadingIssue[]> {
  return createDetailedDraftProofreadingSession().run({ draft });
}

export function createDetailedDraftProofreadingSession(): DetailedDraftProofreadingSession {
  const kernel = new TextlintKernel();
  let cachedIssuesByField = new Map<DraftProofreadingEditableField, DetailedFieldCacheEntry>();

  return {
    clear() {
      cachedIssuesByField.clear();
    },
    async run({ draft }) {
      const nextCache = new Map<DraftProofreadingEditableField, DetailedFieldCacheEntry>();
      const issues: DraftProofreadingIssue[] = [];

      for (const targetField of buildDetailedTargetFields(draft)) {
        const cachedEntry = cachedIssuesByField.get(targetField.field);

        if (
          cachedEntry &&
          cachedEntry.includeTextlintRules === targetField.includeTextlintRules &&
          cachedEntry.text === targetField.text
        ) {
          nextCache.set(targetField.field, cachedEntry);
          issues.push(...cachedEntry.issues);
          continue;
        }

        if (!targetField.text.trim()) {
          nextCache.set(targetField.field, {
            includeTextlintRules: targetField.includeTextlintRules,
            issues: [],
            text: targetField.text,
          });
          continue;
        }

        const nextIssues = await lintDetailedField(kernel, targetField);
        nextCache.set(targetField.field, {
          includeTextlintRules: targetField.includeTextlintRules,
          issues: nextIssues,
          text: targetField.text,
        });
        issues.push(...nextIssues);
      }

      cachedIssuesByField = nextCache;

      return sortDraftProofreadingIssues(issues);
    },
  };
}

async function lintDetailedField(
  kernel: TextlintKernel,
  input: DetailedTargetField,
): Promise<DraftProofreadingIssue[]> {
  const lintOptions = {
    ext: ".txt",
    filePath: `/virtual/${input.field}.txt`,
    plugins: textPlugins,
  };

  try {
    const result = await kernel.lintText(input.text, {
      ...lintOptions,
      rules: input.includeTextlintRules ? detailedRuleSets.withTextlint : detailedRuleSets.prhOnly,
    });

    return result.messages.map((message) =>
      toDraftProofreadingIssue({
        field: input.field,
        message,
        sourceText: input.text,
      }),
    );
  } catch (fullRuleError) {
    if (!input.includeTextlintRules) {
      throw fullRuleError;
    }

    const result = await kernel.lintText(input.text, {
      ...lintOptions,
      rules: detailedRuleSets.prhOnly,
    });

    return result.messages.map((message) =>
      toDraftProofreadingIssue({
        field: input.field,
        message,
        sourceText: input.text,
      }),
    );
  }
}

function buildDetailedTargetFields(draft: DraftInput): DetailedTargetField[] {
  return [
    {
      field: "subject",
      includeTextlintRules: false,
      text: draft.subject,
    },
    {
      field: "opening",
      includeTextlintRules: true,
      text: draft.opening,
    },
    {
      field: "body",
      includeTextlintRules: true,
      text: draft.body,
    },
    {
      field: "closing",
      includeTextlintRules: true,
      text: draft.closing,
    },
  ];
}

function toDraftProofreadingIssue(input: {
  field: DraftProofreadingEditableField;
  message: TextlintMessage;
  sourceText: string;
}): DraftProofreadingIssue {
  const suggestion = createDetailedSuggestion(input.field, input.sourceText, input.message);
  const location = createDetailedLocation(input.message);
  const excerpt = createDetailedExcerpt(input.sourceText, suggestion, location);
  const metadata = describeDetailedRule(input.message, excerpt, suggestion);

  return {
    description: metadata.description,
    excerpt,
    field: input.field,
    id: createDraftProofreadingIssueId(
      input.message.ruleId ?? "textlint",
      input.field,
      location,
      `${excerpt}:${suggestion?.edits[0]?.replacement ?? ""}`,
    ),
    location,
    ruleId: input.message.ruleId ?? "textlint",
    severity: metadata.severity,
    suggestion,
    title: metadata.title,
  };
}

function createDetailedSuggestion(
  field: DraftProofreadingEditableField,
  sourceText: string,
  message: TextlintMessage,
): DraftProofreadingSuggestion | undefined {
  if (!message.fix) {
    return undefined;
  }

  const [from, to] = message.fix.range;
  return {
    edits: [
      {
        field,
        from,
        originalText: sourceText.slice(from, to),
        replacement: message.fix.text,
        to,
      },
    ],
    label: "候補を適用",
  };
}

function createDetailedLocation(message: TextlintMessage): DraftProofreadingLocation | undefined {
  if (message.fix) {
    return {
      from: message.fix.range[0],
      to: message.fix.range[1],
    };
  }

  if (!message.range) {
    return undefined;
  }

  return {
    from: message.index,
    to: message.range[1],
  };
}

function createDetailedExcerpt(
  sourceText: string,
  suggestion: DraftProofreadingSuggestion | undefined,
  location: DraftProofreadingLocation | undefined,
): string {
  if (suggestion) {
    const [edit] = suggestion.edits;
    return sourceText.slice(edit.from, edit.to);
  }

  if (!location) {
    return sourceText.trim().slice(0, 48);
  }

  return excerptWithContext(sourceText, location.from, location.to);
}

function describeDetailedRule(
  message: TextlintMessage,
  excerpt: string,
  suggestion: DraftProofreadingSuggestion | undefined,
): DetailedRuleDefinition & { severity: DraftProofreadingSeverity } {
  if (message.ruleId === "prh") {
    const replacement = suggestion?.edits[0]?.replacement ?? "";
    const phraseRule = findPhraseRule(excerpt, replacement);

    if (phraseRule) {
      return {
        description: phraseRule.description,
        severity: "warning",
        title: phraseRule.ruleId.startsWith("honorific")
          ? "二重敬語の候補があります。"
          : "非推奨表現の可能性があります。",
      };
    }
  }

  const definition = message.ruleId ? detailedRuleDefinitions.get(message.ruleId) : undefined;

  return {
    description: definition?.description ?? message.message,
    severity: definition?.severity ?? toDraftProofreadingSeverity(message.severity),
    title: definition?.title ?? "文章表現の見直し候補があります。",
  };
}

function findPhraseRule(
  excerpt: string,
  replacement: string,
): DraftProofreadingPhraseRule | undefined {
  const directMatch = phraseRuleIndex.get(excerpt);

  if (directMatch?.replacement === replacement) {
    return directMatch;
  }

  return [...phraseRuleIndex.values()].find(
    (rule) => rule.phrase === excerpt && rule.replacement === replacement,
  );
}

function excerptWithContext(text: string, from: number, to: number): string {
  const contextStart = Math.max(0, from - 12);
  const contextEnd = Math.min(text.length, to + 12);
  return text.slice(contextStart, contextEnd);
}

function toDraftProofreadingSeverity(severity: number | undefined): DraftProofreadingSeverity {
  if (!severity || severity <= 1) {
    return "info";
  }

  return "warning";
}

function buildPrhRuleContent(rules: DraftProofreadingPhraseRule[]): string {
  return [
    "version: 1",
    "rules:",
    ...rules.flatMap((rule) => [
      `  - expected: ${quoteYamlValue(rule.replacement)}`,
      `    pattern: ${quoteYamlValue(rule.phrase)}`,
    ]),
  ].join("\n");
}

function quoteYamlValue(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function ensureProcessShim() {
  const currentProcess = Reflect.get(globalThis, "process") as
    | {
        argv?: string[];
        cwd?: () => string;
        env?: Record<string, string | undefined>;
        hrtime?: ((time?: [number, number]) => [number, number]) & {
          bigint?: () => bigint;
        };
        on?: (eventName: string, listener: (...args: unknown[]) => void) => unknown;
      }
    | undefined;

  if (!currentProcess) {
    Reflect.set(globalThis, "process", createProcessShim());
    return;
  }

  if (typeof currentProcess.cwd !== "function") {
    currentProcess.cwd = () => "/";
  }

  if (!Array.isArray(currentProcess.argv)) {
    currentProcess.argv = [];
  }

  if (!currentProcess.env) {
    currentProcess.env = {};
  }

  if (typeof currentProcess.hrtime !== "function") {
    currentProcess.hrtime = createHrtimeShim();
  }

  if (typeof currentProcess.on !== "function") {
    currentProcess.on = () => undefined;
  }
}

function unwrapModuleDefault<T>(value: T): T extends { default: infer U } ? U : T {
  return ((value as { default?: unknown }).default ?? value) as T extends { default: infer U }
    ? U
    : T;
}

function createProcessShim() {
  return {
    argv: [],
    cwd: () => "/",
    env: {},
    hrtime: createHrtimeShim(),
    on: () => undefined,
  };
}

function createHrtimeShim(): ((time?: [number, number]) => [number, number]) & {
  bigint?: () => bigint;
} {
  const hrtime = ((time?: [number, number]) => {
    const now = performance.now();
    const seconds = Math.floor(now / 1000);
    const nanoseconds = Math.floor((now - seconds * 1000) * 1_000_000);

    if (!time) {
      return [seconds, nanoseconds] as [number, number];
    }

    let deltaSeconds = seconds - time[0];
    let deltaNanoseconds = nanoseconds - time[1];

    if (deltaNanoseconds < 0) {
      deltaSeconds -= 1;
      deltaNanoseconds += 1_000_000_000;
    }

    return [deltaSeconds, deltaNanoseconds] as [number, number];
  }) as ((time?: [number, number]) => [number, number]) & {
    bigint?: () => bigint;
  };

  hrtime.bigint = () => BigInt(Math.floor(performance.now() * 1_000_000));

  return hrtime;
}
