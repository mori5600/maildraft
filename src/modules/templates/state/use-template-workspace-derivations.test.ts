import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  createSignature,
  createStoreSnapshot,
  createTemplate,
  createTemplateInput,
} from "../../../test/ui-fixtures";
import { useTemplateWorkspaceDerivations } from "./use-template-workspace-derivations";

describe("useTemplateWorkspaceDerivations", () => {
  it("derives preview text, available tags, filtered templates, and active tag filter", () => {
    const snapshot = createStoreSnapshot({
      templates: [
        createTemplate({
          id: "template-1",
          name: "営業お礼",
          tags: ["社外"],
        }),
        createTemplate({
          id: "template-2",
          name: "採用連絡",
          tags: ["採用"],
        }),
      ],
      signatures: [createSignature({ id: "signature-active", body: "現役署名", isDefault: true })],
      trash: {
        drafts: [],
        templates: [],
        signatures: [
          {
            signature: createSignature({
              id: "signature-trash",
              body: "削除済み署名",
              isDefault: false,
            }),
            deletedAt: "10",
          },
        ],
        memos: [],
      },
    });

    const { result } = renderHook(() =>
      useTemplateWorkspaceDerivations({
        deferredTemplateSearchQuery: "採用",
        requestedTagFilter: "採用",
        snapshot,
        templateForm: createTemplateInput({
          recipient: "株式会社〇〇\n佐藤様",
          opening: "お世話になっております。",
          body: "ご連絡です。",
          closing: "よろしくお願いいたします。",
          signatureId: "signature-trash",
        }),
        templateSort: "name",
      }),
    );

    expect(result.current.availableTemplateTags).toEqual(["社外", "採用"]);
    expect(result.current.activeTemplateTagFilter).toBe("採用");
    expect(result.current.filteredTemplates.map((template) => template.id)).toEqual(["template-2"]);
    expect(result.current.templatePreviewText).toContain("削除済み署名");
    expect(result.current.templatePreviewText).toContain("ご連絡です。");
  });

  it("clears an invalid requested tag filter", () => {
    const snapshot = createStoreSnapshot({
      templates: [
        createTemplate({
          id: "template-1",
          tags: ["社外"],
        }),
      ],
      trash: {
        drafts: [],
        templates: [],
        signatures: [],
        memos: [],
      },
    });

    const { result } = renderHook(() =>
      useTemplateWorkspaceDerivations({
        deferredTemplateSearchQuery: "",
        requestedTagFilter: "採用",
        snapshot,
        templateForm: createTemplateInput(),
        templateSort: "recent",
      }),
    );

    expect(result.current.activeTemplateTagFilter).toBeNull();
  });
});
