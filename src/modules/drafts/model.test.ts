import { describe, expect, it } from "vitest";

import type { TemplateInput } from "../templates/model";
import {
  applyTemplateToDraft,
  createDraftFromTemplateInput,
  draftHasMeaningfulContent,
  draftInputsEqual,
} from "./model";

const baseTemplate: TemplateInput = {
  id: "template-1",
  name: "お礼メール",
  isPinned: false,
  subject: "お打ち合わせのお礼",
  recipient: "株式会社〇〇\n佐藤様",
  opening: "いつもお世話になっております。",
  body: "本日はありがとうございました。",
  closing: "よろしくお願いいたします。",
  signatureId: "signature-template",
};

describe("draft model", () => {
  it("creates a draft from a template and prefers the template signature", () => {
    expect(createDraftFromTemplateInput(baseTemplate, "signature-default")).toMatchObject({
      title: "お礼メール",
      subject: "お打ち合わせのお礼",
      templateId: "template-1",
      signatureId: "signature-template",
    });
  });

  it("applies a template while preserving an existing custom title", () => {
    expect(
      applyTemplateToDraft(
        {
          id: "draft-1",
          title: "営業向け下書き",
          isPinned: false,
          subject: "旧件名",
          recipient: "",
          opening: "",
          body: "",
          closing: "",
          templateId: null,
          signatureId: "signature-default",
          variableValues: {
            案件名: "導入相談",
          },
        },
        {
          ...baseTemplate,
          name: "定型",
          createdAt: "1",
          updatedAt: "2",
        },
      ),
    ).toMatchObject({
      title: "営業向け下書き",
      subject: "お打ち合わせのお礼",
      templateId: "template-1",
      signatureId: "signature-template",
      variableValues: {
        案件名: "導入相談",
      },
    });
  });

  it("treats variable value key order as equal and detects meaningful content", () => {
    expect(
      draftInputsEqual(
        {
          id: "draft-1",
          title: "",
          isPinned: false,
          subject: "",
          recipient: "",
          opening: "",
          body: "",
          closing: "",
          templateId: null,
          signatureId: null,
          variableValues: {
            会社名: "株式会社〇〇",
            担当者名: "佐藤",
          },
        },
        {
          id: "draft-1",
          title: "",
          isPinned: false,
          subject: "",
          recipient: "",
          opening: "",
          body: "",
          closing: "",
          templateId: null,
          signatureId: null,
          variableValues: {
            担当者名: "佐藤",
            会社名: "株式会社〇〇",
          },
        },
      ),
    ).toBe(true);

    expect(
      draftHasMeaningfulContent({
        id: "draft-1",
        title: "",
        isPinned: false,
        subject: "",
        recipient: "",
        opening: "",
        body: "",
        closing: "",
        templateId: null,
        signatureId: null,
        variableValues: {
          会社名: "株式会社〇〇",
        },
      }),
    ).toBe(true);
  });
});
