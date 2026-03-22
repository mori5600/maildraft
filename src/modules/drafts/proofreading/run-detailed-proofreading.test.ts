import { describe, expect, it } from "vitest";

import { createDraftInput } from "../../../test/ui-fixtures";
import { runDetailedDraftProofreading } from "./run-detailed-proofreading";

describe("runDetailedDraftProofreading", () => {
  it("returns worker-safe preset-japanese and prh issues for supported draft fields", async () => {
    const issues = await runDetailedDraftProofreading({
      draft: createDraftInput({
        body: "ご連絡\u200Bありがとうございます。",
        closing: "",
        opening: "",
        subject: "了解しました",
      }),
      signatureBody: "",
    });

    expect(
      issues.some(
        (issue) =>
          issue.field === "subject" &&
          issue.ruleId === "prh" &&
          issue.suggestion?.edits[0]?.replacement === "承知しました",
      ),
    ).toBe(true);
    expect(
      issues.some((issue) => issue.field === "body" && issue.ruleId === "no-zero-width-spaces"),
    ).toBe(true);
  }, 30000);
});
