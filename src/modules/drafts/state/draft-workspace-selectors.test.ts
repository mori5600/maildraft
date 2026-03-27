import { describe, expect, it } from "vitest";

import { createDraft, createStoreSnapshot } from "../../../test/ui-fixtures";
import type { DraftProofreadingIssue } from "../proofreading/model";
import {
  createDraftSearchIndex,
  filterVisibleProofreadingIssues,
  selectDraftHistory,
  selectFilteredDrafts,
} from "./draft-workspace-selectors";

describe("draft-workspace-selectors", () => {
  it("filters visible issues by ignored ids and disabled rule ids", () => {
    const issues: DraftProofreadingIssue[] = [
      {
        description: "説明",
        excerpt: "了解しました",
        field: "body",
        id: "issue-visible",
        ruleId: "discouraged.understood",
        severity: "warning",
        title: "非推奨表現の可能性があります。",
      },
      {
        description: "説明",
        excerpt: "承知しました",
        field: "body",
        id: "issue-ignored",
        ruleId: "prh",
        severity: "warning",
        title: "表現の言い換え候補があります。",
      },
    ];

    expect(
      filterVisibleProofreadingIssues(issues, ["issue-ignored"], ["discouraged.understood"]),
    ).toEqual([]);
  });

  it("filters and sorts drafts from a prebuilt search index", () => {
    const searchIndex = createDraftSearchIndex([
      createDraft({
        body: "候補本文",
        id: "draft-b",
        tags: ["社外"],
        title: "Beta",
        updatedAt: "20",
        variableValues: { 会社名: "候補株式会社" },
      }),
      createDraft({
        body: "別本文",
        id: "draft-a",
        tags: ["社内"],
        title: "Alpha",
        updatedAt: "10",
        variableValues: { 会社名: "別会社" },
      }),
    ]);

    expect(
      selectFilteredDrafts(searchIndex, "候補", null, "label").map((draft) => draft.id),
    ).toEqual(["draft-b"]);
    expect(
      selectFilteredDrafts(searchIndex, "社外", null, "label").map((draft) => draft.id),
    ).toEqual(["draft-b"]);
    expect(selectFilteredDrafts(searchIndex, "", "社内", "label").map((draft) => draft.id)).toEqual(
      ["draft-a"],
    );
  });

  it("selects history entries for the active draft only", () => {
    const snapshot = createStoreSnapshot({
      draftHistory: [
        {
          body: "本文",
          closing: "結び",
          draftId: "draft-a",
          id: "history-a",
          opening: "書き出し",
          recipient: "宛名",
          recordedAt: "10",
          signatureId: null,
          subject: "件名",
          templateId: null,
          title: "A",
          variableValues: {},
          tags: [],
        },
        {
          body: "本文",
          closing: "結び",
          draftId: "draft-b",
          id: "history-b",
          opening: "書き出し",
          recipient: "宛名",
          recordedAt: "11",
          signatureId: null,
          subject: "件名",
          templateId: null,
          title: "B",
          variableValues: {},
          tags: [],
        },
      ],
    });

    expect(selectDraftHistory(snapshot.draftHistory, "draft-a").map((entry) => entry.id)).toEqual([
      "history-a",
    ]);
  });
});
