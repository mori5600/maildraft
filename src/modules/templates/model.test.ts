import { describe, expect, it } from "vitest";

import {
  createEmptyTemplate,
  createTemplateFromDraftInput,
  duplicateTemplateInput,
  templateHasMeaningfulContent,
  templateInputsEqual,
  templateMatchesPersistedTemplate,
  toTemplateInput,
} from "./model";

describe("template model", () => {
  it("creates an empty template using the provided default signature id", () => {
    expect(createEmptyTemplate("signature-default")).toMatchObject({
      name: "新しいテンプレート",
      isPinned: false,
      subject: "",
      signatureId: "signature-default",
      tags: [],
    });
  });

  it("converts a template to editable input", () => {
    expect(
      toTemplateInput({
        id: "template-1",
        name: "お礼メール",
        isPinned: true,
        subject: "件名",
        recipient: "株式会社〇〇",
        opening: "お世話になっております。",
        body: "ありがとうございます。",
        closing: "よろしくお願いいたします。",
        signatureId: "signature-default",
        tags: ["社外"],
        createdAt: "1",
        updatedAt: "2",
      }),
    ).toEqual({
      id: "template-1",
      name: "お礼メール",
      isPinned: true,
      subject: "件名",
      recipient: "株式会社〇〇",
      opening: "お世話になっております。",
      body: "ありがとうございます。",
      closing: "よろしくお願いいたします。",
      signatureId: "signature-default",
      tags: ["社外"],
    });
  });

  it("duplicates a template into an unpinned copy", () => {
    const duplicate = duplicateTemplateInput({
      id: "template-1",
      name: "お礼メール",
      isPinned: true,
      subject: "件名",
      recipient: "",
      opening: "",
      body: "",
      closing: "",
      signatureId: null,
      tags: ["社外", "営業"],
    });

    expect(duplicate.id).not.toBe("template-1");
    expect(duplicate).toMatchObject({
      name: "お礼メール コピー",
      isPinned: false,
      subject: "件名",
      tags: ["社外", "営業"],
    });
  });

  it("creates a template from a draft and reuses the current draft content", () => {
    expect(
      createTemplateFromDraftInput({
        title: "4/12 打ち合わせお礼",
        subject: "お打ち合わせのお礼",
        recipient: "株式会社〇〇\n佐藤様",
        opening: "いつもお世話になっております。",
        body: "本日はありがとうございました。",
        closing: "よろしくお願いいたします。",
        signatureId: "signature-default",
        tags: ["社外", "お礼"],
      }),
    ).toMatchObject({
      name: "4/12 打ち合わせお礼",
      isPinned: false,
      subject: "お打ち合わせのお礼",
      signatureId: "signature-default",
      tags: ["社外", "お礼"],
    });

    expect(
      createTemplateFromDraftInput({
        title: "",
        subject: "",
        recipient: "",
        opening: "",
        body: "本文のみ",
        closing: "",
        signatureId: null,
        tags: [],
      }),
    ).toMatchObject({
      name: "新しいテンプレート",
      body: "本文のみ",
      signatureId: null,
    });
  });

  it("detects meaningful edits and persisted equality", () => {
    const emptyTemplate = createEmptyTemplate("signature-default");

    expect(templateHasMeaningfulContent(emptyTemplate)).toBe(false);
    expect(
      templateHasMeaningfulContent({
        ...emptyTemplate,
        name: "個別テンプレート",
      }),
    ).toBe(true);
    expect(
      templateInputsEqual(emptyTemplate, {
        ...emptyTemplate,
      }),
    ).toBe(true);
    expect(
      templateMatchesPersistedTemplate(
        {
          ...emptyTemplate,
          name: "個別テンプレート",
        },
        {
          id: emptyTemplate.id,
          name: "個別テンプレート",
          isPinned: false,
          subject: "",
          recipient: "",
          opening: "",
          body: "",
          closing: "",
          signatureId: "signature-default",
          tags: [],
          createdAt: "1",
          updatedAt: "2",
        },
      ),
    ).toBe(true);
    expect(
      templateHasMeaningfulContent({
        ...emptyTemplate,
        tags: ["社外"],
      }),
    ).toBe(true);
  });
});
