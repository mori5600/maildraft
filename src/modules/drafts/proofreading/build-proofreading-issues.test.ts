import { describe, expect, it } from "vitest";

import { createDraftInput, createSignature } from "../../../test/ui-fixtures";
import { buildDraftProofreadingIssues } from "./build-proofreading-issues";
import {
  applyDraftProofreadingSuggestion,
  DRAFT_SUBJECT_WARNING_LENGTH,
  draftProofreadingFieldLabel,
  draftProofreadingRuleLabel,
} from "./model";

describe("build-proofreading-issues", () => {
  it("returns lightweight issues for missing structure and common wording problems", () => {
    const issues = buildDraftProofreadingIssues(
      createDraftInput({
        body: "了解しました。  \n同じ文です。\n同じ文です。\nご確認いただけますでしょうか。",
        closing: "",
        opening: "",
        recipient: "",
        signatureId: null,
      }),
      undefined,
    );

    expect(issues.map((issue) => issue.title)).toEqual(
      expect.arrayContaining([
        "宛名または書き出しが未入力です。",
        "署名が未設定です。",
        "重複表現の可能性があります。",
        "非推奨表現の可能性があります。",
        "二重敬語の候補があります。",
        "行末に不要な空白があります。",
        "結びが未入力です。",
      ]),
    );
  });

  it("adds a subject length issue only after the configured threshold", () => {
    const issues = buildDraftProofreadingIssues(
      createDraftInput({
        subject: "あ".repeat(DRAFT_SUBJECT_WARNING_LENGTH + 1),
      }),
      createSignature(),
    );

    expect(issues.some((issue) => issue.ruleId === "subject.length")).toBe(true);
  });

  it("creates suggestions that can be applied back to the draft form", () => {
    const draft = createDraftInput({
      body: "了解しました。  \nご確認いただけますでしょうか。",
    });
    const issues = buildDraftProofreadingIssues(draft, createSignature());
    const discouragedIssue = issues.find((issue) => issue.ruleId === "discouraged.understood");

    expect(draftProofreadingFieldLabel(discouragedIssue?.field ?? "body")).toBe("本文");
    expect(discouragedIssue?.suggestion).toBeDefined();

    const nextDraft = applyDraftProofreadingSuggestion(
      draft,
      discouragedIssue?.suggestion ?? { edits: [], label: "" },
    );

    expect(nextDraft.body).toContain("承知しました");
  });

  it("reports unresolved template variables as required issues", () => {
    const issues = buildDraftProofreadingIssues(
      createDraftInput({
        body: "本日はありがとうございました。{{会社名}}",
        variableValues: {},
      }),
      createSignature(),
    );

    expect(issues.find((issue) => issue.ruleId === "variables.missing")?.title).toBe(
      "未置換の変数があります: 会社名",
    );
  });

  it("does not flag leading indentation as repeated spaces", () => {
    const issues = buildDraftProofreadingIssues(
      createDraftInput({
        body: "  箇条書きの下書きです。",
      }),
      createSignature(),
    );

    expect(issues.some((issue) => issue.ruleId === "whitespace.multiple")).toBe(false);
  });

  it("resolves rule labels from the centralized rule registry", () => {
    expect(draftProofreadingRuleLabel("required.subject")).toBe("件名未入力");
    expect(draftProofreadingRuleLabel("honorific.view")).toBe("「拝見させていただきます」");
  });
});
