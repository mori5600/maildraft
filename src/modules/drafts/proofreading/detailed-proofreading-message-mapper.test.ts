import type { TextlintMessage } from "@textlint/kernel";
import { describe, expect, it } from "vitest";

import { mapDetailedLintMessageToIssue } from "./detailed-proofreading-message-mapper";

describe("detailed-proofreading-message-mapper", () => {
  it("maps prh honorific matches through the phrase strategy", () => {
    const issue = mapDetailedLintMessageToIssue({
      field: "body",
      message: {
        fix: {
          range: [0, "ご確認いただけますでしょうか".length],
          text: "ご確認いただけますか",
        },
        index: 0,
        message: "replace",
        range: [0, "ご確認いただけますでしょうか".length],
        ruleId: "prh",
        severity: 2,
      } as unknown as TextlintMessage,
      sourceText: "ご確認いただけますでしょうか",
    });

    expect(issue.title).toBe("二重敬語の候補があります。");
    expect(issue.description).toContain("敬語が重なって見える");
    expect(issue.suggestion?.edits[0]?.replacement).toBe("ご確認いただけますか");
  });

  it("maps predefined non-fix rules through the rule definition strategy", () => {
    const issue = mapDetailedLintMessageToIssue({
      field: "body",
      message: {
        index: 0,
        message: "control character",
        range: [0, 1],
        ruleId: "no-invalid-control-character",
        severity: 2,
      } as unknown as TextlintMessage,
      sourceText: "本文です\u0007",
    });

    expect(issue.title).toBe("制御文字が含まれています。");
    expect(issue.description).toContain("制御文字");
    expect(issue.location).toEqual({
      from: 0,
      to: 1,
    });
  });
});
