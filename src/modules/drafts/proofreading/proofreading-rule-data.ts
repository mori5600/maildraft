import type { DraftProofreadingEditableField, DraftProofreadingSeverity } from "./model";

export const repeatedLineFields: DraftProofreadingEditableField[] = ["opening", "body", "closing"];
export const textCheckFields: DraftProofreadingEditableField[] = [
  "subject",
  "opening",
  "body",
  "closing",
];

export interface DraftProofreadingPhraseRule {
  description: string;
  phrase: string;
  replacement: string;
  ruleId: string;
}

export interface DraftProofreadingPhraseRuleStrategy {
  rules: DraftProofreadingPhraseRule[];
  severity: DraftProofreadingSeverity;
  suggestionLabel: string;
  title: string;
}

export const discouragedPhraseRules: DraftProofreadingPhraseRule[] = [
  {
    description: "社外メールではやや砕けた印象になりやすい表現です。",
    phrase: "了解しました",
    replacement: "承知しました",
    ruleId: "discouraged.understood",
  },
  {
    description: "口語寄りのため、ビジネスメールでは丁寧な表現に寄せる方が無難です。",
    phrase: "わかりました",
    replacement: "承知しました",
    ruleId: "discouraged.casual-understood",
  },
  {
    description: "謝意や依頼では、より丁寧な言い換えの方がメール文面になじみます。",
    phrase: "すみません",
    replacement: "恐れ入ります",
    ruleId: "discouraged.apology",
  },
  {
    description: "急ぎでない文面では、曖昧さを避けた表現の方が意図を伝えやすくなります。",
    phrase: "とりあえず",
    replacement: "まずは",
    ruleId: "discouraged.temporary",
  },
];

export const doubleHonorificPhraseRules: DraftProofreadingPhraseRule[] = [
  {
    description: "敬語が重なって見えるため、簡潔な形にすると自然です。",
    phrase: "ご確認いただけますでしょうか",
    replacement: "ご確認いただけますか",
    ruleId: "honorific.confirm-maybe",
  },
  {
    description: "「お伺い」と「させていただく」が重なり、不自然に見えることがあります。",
    phrase: "お伺いさせていただきます",
    replacement: "伺います",
    ruleId: "honorific.visit",
  },
  {
    description: "「拝見」と「させていただく」が重なり、不自然に見えることがあります。",
    phrase: "拝見させていただきます",
    replacement: "拝見いたします",
    ruleId: "honorific.view",
  },
  {
    description: "尊敬表現が重なって見えるため、一般的な形に寄せると自然です。",
    phrase: "ご覧になられましたら",
    replacement: "ご覧になりましたら",
    ruleId: "honorific.see",
  },
];

export const phraseRuleStrategies: DraftProofreadingPhraseRuleStrategy[] = [
  {
    rules: discouragedPhraseRules,
    severity: "warning",
    suggestionLabel: "言い換える",
    title: "非推奨表現の可能性があります。",
  },
  {
    rules: doubleHonorificPhraseRules,
    severity: "warning",
    suggestionLabel: "候補を適用",
    title: "二重敬語の候補があります。",
  },
];
