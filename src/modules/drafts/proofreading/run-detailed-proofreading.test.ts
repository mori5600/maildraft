import { TextlintKernel } from "@textlint/kernel";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createDraftInput } from "../../../test/ui-fixtures";
import {
  createDetailedDraftProofreadingSession,
  runDetailedDraftProofreading,
} from "./run-detailed-proofreading";

describe("runDetailedDraftProofreading", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns worker-safe preset-japanese and prh issues for supported draft fields", async () => {
    const issues = await runDetailedDraftProofreading({
      draft: createDraftInput({
        body: "ご連絡\u200Bありがとうございます。",
        closing: "",
        opening: "",
        subject: "了解しました",
      }),
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

  it("reuses unchanged field results across runs within the same session", async () => {
    const session = createDetailedDraftProofreadingSession();
    const lintTextSpy = vi.spyOn(TextlintKernel.prototype, "lintText");
    const initialDraft = createDraftInput({
      body: "ご連絡\u200Bありがとうございます。",
      closing: "よろしくお願いいたします。",
      opening: "お世話になっております。",
      subject: "了解しました",
    });

    await session.run({ draft: initialDraft });
    expect(lintTextSpy).toHaveBeenCalledTimes(4);

    lintTextSpy.mockClear();

    await session.run({
      draft: {
        ...initialDraft,
      },
    });

    expect(lintTextSpy).not.toHaveBeenCalled();

    await session.run({
      draft: {
        ...initialDraft,
        body: "ご連絡ありがとうございます。",
      },
    });

    expect(lintTextSpy).toHaveBeenCalledTimes(1);
  });
});
