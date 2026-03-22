import type { DraftProofreadingEditableField, DraftProofreadingSeverity } from "./model";

export const repeatedLineFields: DraftProofreadingEditableField[] = ["opening", "body", "closing"];
export const textCheckFields: DraftProofreadingEditableField[] = [
  "subject",
  "opening",
  "body",
  "closing",
];

export interface DraftProofreadingRuleDefinition {
  description: string;
  label: string;
  severity: DraftProofreadingSeverity;
  title: string;
}

export interface DraftProofreadingPhraseRule extends DraftProofreadingRuleDefinition {
  phrase: string;
  replacement: string;
  ruleId: string;
  suggestionLabel: string;
}

const discouragedPhraseRulesById: Record<string, DraftProofreadingPhraseRule> = {
  "discouraged.understood": {
    description: "社外メールではやや砕けた印象になりやすい表現です。",
    label: "「了解しました」",
    phrase: "了解しました",
    replacement: "承知しました",
    ruleId: "discouraged.understood",
    severity: "warning",
    suggestionLabel: "言い換える",
    title: "非推奨表現の可能性があります。",
  },
  "discouraged.casual-understood": {
    description: "口語寄りのため、ビジネスメールでは丁寧な表現に寄せる方が無難です。",
    label: "「わかりました」",
    phrase: "わかりました",
    replacement: "承知しました",
    ruleId: "discouraged.casual-understood",
    severity: "warning",
    suggestionLabel: "言い換える",
    title: "非推奨表現の可能性があります。",
  },
  "discouraged.apology": {
    description: "謝意や依頼では、より丁寧な言い換えの方がメール文面になじみます。",
    label: "「すみません」",
    phrase: "すみません",
    replacement: "恐れ入ります",
    ruleId: "discouraged.apology",
    severity: "warning",
    suggestionLabel: "言い換える",
    title: "非推奨表現の可能性があります。",
  },
  "discouraged.temporary": {
    description: "急ぎでない文面では、曖昧さを避けた表現の方が意図を伝えやすくなります。",
    label: "「とりあえず」",
    phrase: "とりあえず",
    replacement: "まずは",
    ruleId: "discouraged.temporary",
    severity: "warning",
    suggestionLabel: "言い換える",
    title: "非推奨表現の可能性があります。",
  },
};

const doubleHonorificPhraseRulesById: Record<string, DraftProofreadingPhraseRule> = {
  "honorific.confirm-maybe": {
    description: "敬語が重なって見えるため、簡潔な形にすると自然です。",
    label: "「ご確認いただけますでしょうか」",
    phrase: "ご確認いただけますでしょうか",
    replacement: "ご確認いただけますか",
    ruleId: "honorific.confirm-maybe",
    severity: "warning",
    suggestionLabel: "候補を適用",
    title: "二重敬語の候補があります。",
  },
  "honorific.visit": {
    description: "「お伺い」と「させていただく」が重なり、不自然に見えることがあります。",
    label: "「お伺いさせていただきます」",
    phrase: "お伺いさせていただきます",
    replacement: "伺います",
    ruleId: "honorific.visit",
    severity: "warning",
    suggestionLabel: "候補を適用",
    title: "二重敬語の候補があります。",
  },
  "honorific.view": {
    description: "「拝見」と「させていただく」が重なり、不自然に見えることがあります。",
    label: "「拝見させていただきます」",
    phrase: "拝見させていただきます",
    replacement: "拝見いたします",
    ruleId: "honorific.view",
    severity: "warning",
    suggestionLabel: "候補を適用",
    title: "二重敬語の候補があります。",
  },
  "honorific.see": {
    description: "尊敬表現が重なって見えるため、一般的な形に寄せると自然です。",
    label: "「ご覧になられましたら」",
    phrase: "ご覧になられましたら",
    replacement: "ご覧になりましたら",
    ruleId: "honorific.see",
    severity: "warning",
    suggestionLabel: "候補を適用",
    title: "二重敬語の候補があります。",
  },
};

export const discouragedPhraseRules = Object.values(discouragedPhraseRulesById);
export const doubleHonorificPhraseRules = Object.values(doubleHonorificPhraseRulesById);
export const phraseRules = [...discouragedPhraseRules, ...doubleHonorificPhraseRules];

const staticRuleDefinitions = createRuleDefinitions([
  {
    description: "件名がないと、受信者が要件を判断しにくくなります。",
    label: "件名未入力",
    ruleId: "required.subject",
    severity: "error",
    title: "件名が未入力です。",
  },
  {
    description: "宛名か書き出しのどちらかがあると、メール冒頭の体裁が整います。",
    label: "宛名または書き出し",
    ruleId: "required.recipient-or-opening",
    severity: "error",
    title: "宛名または書き出しが未入力です。",
  },
  {
    description: "本文が空のままだと、要件が伝わりません。",
    label: "本文未入力",
    ruleId: "required.body",
    severity: "error",
    title: "本文が未入力です。",
  },
  {
    description: "結びの一文があると、メール全体の印象が締まります。",
    label: "結び未入力",
    ruleId: "required.closing",
    severity: "warning",
    title: "結びが未入力です。",
  },
  {
    description: "署名があると、差出人情報を毎回書き直さずに済みます。",
    label: "署名未設定",
    ruleId: "required.signature",
    severity: "error",
    title: "署名が未設定です。",
  },
  {
    description: "末尾の空白は見た目では分かりづらく、コピー後にも残りやすいです。",
    label: "行末スペース",
    ruleId: "whitespace.trailing",
    severity: "warning",
    title: "行末に不要な空白があります。",
  },
  {
    description: "連続スペースは意図が伝わりにくいため、通常は 1 文字にそろえる方が安全です。",
    label: "連続スペース",
    ruleId: "whitespace.multiple",
    severity: "warning",
    title: "連続したスペースがあります。",
  },
  {
    description: "同じ行が連続しているため、誤って重複した可能性があります。",
    label: "重複行",
    ruleId: "expression.repeated-line",
    severity: "warning",
    title: "重複表現の可能性があります。",
  },
  {
    description: "読点が多く、1文が詰まって見える可能性があります。",
    label: "読点過多",
    ruleId: "max-ten",
    severity: "info",
    title: "読点がやや多い可能性があります。",
  },
  {
    description: "逆接の「が」が重なり、文意が読み取りにくくなることがあります。",
    label: "逆接表現の重複",
    ruleId: "no-doubled-conjunctive-particle-ga",
    severity: "warning",
    title: "逆接表現が重なっている可能性があります。",
  },
  {
    description: "接続詞が重なると、文の流れがくどく見えることがあります。",
    label: "接続詞の重複",
    ruleId: "no-doubled-conjunction",
    severity: "warning",
    title: "接続詞が重複している可能性があります。",
  },
  {
    description: "二重否定は意図が伝わりにくいため、単純な形に寄せる方が安全です。",
    label: "二重否定",
    ruleId: "no-double-negative-ja",
    severity: "warning",
    title: "二重否定の可能性があります。",
  },
  {
    description: "同じ助詞が続くと、文章が引っかかって読まれやすくなります。",
    label: "助詞の重複",
    ruleId: "no-doubled-joshi",
    severity: "warning",
    title: "助詞が重複している可能性があります。",
  },
  {
    description: "一文が長いため、メールでは分割した方が読みやすくなることがあります。",
    label: "長文",
    ruleId: "sentence-length",
    severity: "info",
    title: "一文が長い可能性があります。",
  },
  {
    description: "ら抜き言葉が含まれている可能性があります。",
    label: "ら抜き言葉",
    ruleId: "no-dropping-the-ra",
    severity: "warning",
    title: "口語的な表現の可能性があります。",
  },
  {
    description: "ですます調とである調が混ざると、メール文体が不安定に見えます。",
    label: "文体混在",
    ruleId: "no-mix-dearu-desumasu",
    severity: "warning",
    title: "文体が混在している可能性があります。",
  },
  {
    description: "結合文字が混ざっているため、環境によって表示が崩れる可能性があります。",
    label: "文字正規化の揺れ",
    ruleId: "no-nfd",
    severity: "warning",
    title: "文字正規化の揺れがあります。",
  },
  {
    description: "制御文字が含まれているため、コピーや表示に影響する可能性があります。",
    label: "制御文字",
    ruleId: "no-invalid-control-character",
    severity: "warning",
    title: "制御文字が含まれています。",
  },
  {
    description: "ゼロ幅スペースは見えずに残りやすく、コピー後も気づきにくい文字です。",
    label: "ゼロ幅スペース",
    ruleId: "no-zero-width-spaces",
    severity: "warning",
    title: "ゼロ幅スペースが含まれています。",
  },
  {
    description: "一部環境で置換や検索がしづらい文字が含まれている可能性があります。",
    label: "互換性の低い漢字",
    ruleId: "no-kangxi-radicals",
    severity: "warning",
    title: "互換性の低い漢字が含まれている可能性があります。",
  },
  {
    description: "メール向けの推奨表現に置き換える候補です。",
    label: "prh 言い換え",
    ruleId: "prh",
    severity: "warning",
    title: "表現の言い換え候補があります。",
  },
  {
    description: "一般的な文章表現の見直し候補です。",
    label: "textlint",
    ruleId: "textlint",
    severity: "warning",
    title: "文章表現の見直し候補があります。",
  },
]);

const phraseRuleDefinitions = createRuleDefinitions(
  phraseRules.map((rule) => ({
    description: rule.description,
    label: rule.label,
    ruleId: rule.ruleId,
    severity: rule.severity,
    title: rule.title,
  })),
);

const proofreadingRuleDefinitions = new Map([
  ...staticRuleDefinitions.entries(),
  ...phraseRuleDefinitions.entries(),
]);

export const detailedProofreadingRuleDefinitions = new Map([
  ...staticRuleDefinitions.entries(),
  ...phraseRuleDefinitions.entries(),
]);

export const detailedProofreadingPhraseRuleIndex = new Map(
  phraseRules.map((rule) => [rule.phrase, rule]),
);

export function getDraftProofreadingRuleDefinition(
  ruleId: string,
): DraftProofreadingRuleDefinition | undefined {
  return proofreadingRuleDefinitions.get(ruleId);
}

export function getDraftProofreadingRuleLabel(ruleId: string): string | undefined {
  return proofreadingRuleDefinitions.get(ruleId)?.label;
}

export function createSubjectLengthRuleDefinition(
  subjectWarningLength: number,
): DraftProofreadingRuleDefinition {
  return {
    description: `件名は ${subjectWarningLength} 文字以内を目安にすると一覧で読みやすくなります。`,
    label: "件名長さ",
    severity: "info",
    title: "件名がやや長めです。",
  };
}

export function createMissingVariablesRuleDefinition(
  missingVariables: string[],
): DraftProofreadingRuleDefinition {
  return {
    description: "差し込み項目に値が入っていないため、プレビューやコピー時にそのまま残ります。",
    label: "未置換の変数",
    severity: "error",
    title: `未置換の変数があります: ${missingVariables.join(", ")}`,
  };
}

function createRuleDefinitions(
  rules: Array<DraftProofreadingRuleDefinition & { ruleId: string }>,
): Map<string, DraftProofreadingRuleDefinition> {
  return new Map(rules.map(({ ruleId, ...definition }) => [ruleId, definition]));
}
