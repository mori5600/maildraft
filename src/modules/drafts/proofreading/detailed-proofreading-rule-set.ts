import { type TextlintKernelRule, type TextlintRuleOptions } from "@textlint/kernel";
import textPluginModule from "@textlint/textlint-plugin-text";
import noInvalidControlCharacterRuleModule from "@textlint-rule/textlint-rule-no-invalid-control-character";
import noKangxiRadicalsRuleModule from "textlint-rule-no-kangxi-radicals";
import noNfdRuleModule from "textlint-rule-no-nfd";
import noZeroWidthSpacesRuleModule from "textlint-rule-no-zero-width-spaces";
import prhRuleModule from "textlint-rule-prh";
import sentenceLengthRuleModule from "textlint-rule-sentence-length";

import {
  ensureDetailedProofreadingRuntime,
  unwrapModuleDefault,
} from "./detailed-proofreading-runtime";
import { type DraftProofreadingPhraseRule, phraseRules } from "./proofreading-rule-data";

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
    ruleContents: [buildPrhRuleContent(phraseRules)],
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
