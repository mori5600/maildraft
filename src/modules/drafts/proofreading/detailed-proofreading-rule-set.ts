import { type TextlintKernelRule, type TextlintRuleOptions } from "@textlint/kernel";
import textPluginModule from "@textlint/textlint-plugin-text";
import noInvalidControlCharacterRuleModule from "@textlint-rule/textlint-rule-no-invalid-control-character";
import noKangxiRadicalsRuleModule from "textlint-rule-no-kangxi-radicals";
import noNfdRuleModule from "textlint-rule-no-nfd";
import noZeroWidthSpacesRuleModule from "textlint-rule-no-zero-width-spaces";
import prhRuleModule from "textlint-rule-prh";
import sentenceLengthRuleModule from "textlint-rule-sentence-length";

import {
  discouragedPhraseRules,
  doubleHonorificPhraseRules,
  type DraftProofreadingPhraseRule,
} from "./build-proofreading-issues";
import {
  ensureDetailedProofreadingRuntime,
  unwrapModuleDefault,
} from "./detailed-proofreading-runtime";
import type { DraftProofreadingSeverity } from "./model";

export interface DetailedRuleDefinition {
  description: string;
  severity?: DraftProofreadingSeverity;
  title: string;
}

ensureDetailedProofreadingRuntime();

const textPlugin = unwrapModuleDefault(textPluginModule);
const noInvalidControlCharacterRule = unwrapModuleDefault(noInvalidControlCharacterRuleModule);
const noKangxiRadicalsRule = unwrapModuleDefault(noKangxiRadicalsRuleModule);
const noNfdRule = unwrapModuleDefault(noNfdRuleModule);
const noZeroWidthSpacesRule = unwrapModuleDefault(noZeroWidthSpacesRuleModule);
const prhRule = unwrapModuleDefault(prhRuleModule);
const sentenceLengthRule = unwrapModuleDefault(sentenceLengthRuleModule);

export const detailedProofreadingTextPlugins = [
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

export const detailedProofreadingRuleSets = {
  prhOnly: [prhRuleEntry],
  withTextlint: [...workerSafeTextlintRuleEntries, prhRuleEntry],
};

export const detailedProofreadingPhraseRuleIndex = new Map(
  [...discouragedPhraseRules, ...doubleHonorificPhraseRules].map((rule) => [rule.phrase, rule]),
);

export const detailedProofreadingRuleDefinitions = new Map<string, DetailedRuleDefinition>([
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
