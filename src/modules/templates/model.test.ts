import { describe, expect, it } from "vitest";

import {
  createEmptyTemplate,
  duplicateTemplateInput,
  toTemplateInput,
} from "./model";

describe("template model", () => {
  it("creates an empty template using the provided default signature id", () => {
    expect(createEmptyTemplate("signature-default")).toMatchObject({
      name: "新しいテンプレート",
      isPinned: false,
      subject: "",
      signatureId: "signature-default",
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
    });

    expect(duplicate.id).not.toBe("template-1");
    expect(duplicate).toMatchObject({
      name: "お礼メール コピー",
      isPinned: false,
      subject: "件名",
    });
  });
});
