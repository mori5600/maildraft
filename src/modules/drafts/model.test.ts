import { describe, expect, it } from "vitest";

import type { TemplateInput } from "../templates/model";
import {
  applyTemplateToDraft,
  createDraftFromMemoInput,
  createDraftFromTemplateInput,
  createTemplateFromDraftInput,
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
  tags: ["社外", "お礼"],
};

describe("draft model", () => {
  it("creates a draft from a template and prefers the template signature", () => {
    expect(createDraftFromTemplateInput(baseTemplate, "signature-default")).toMatchObject({
      title: "お礼メール",
      subject: "お打ち合わせのお礼",
      templateId: "template-1",
      signatureId: "signature-template",
      tags: ["社外", "お礼"],
    });
  });

  it("creates a draft from a memo and keeps the subject empty", () => {
    expect(
      createDraftFromMemoInput(
        {
          title: "",
          body: "会議メモ\n宿題を確認",
          tags: ["議事録"],
        },
        "signature-default",
      ),
    ).toMatchObject({
      title: "会議メモ",
      subject: "",
      body: "会議メモ\n宿題を確認",
      templateId: null,
      signatureId: "signature-default",
      tags: ["議事録"],
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
          tags: ["既存", "営業"],
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
      tags: ["既存", "営業", "社外", "お礼"],
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
          tags: ["社外", "営業"],
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
          tags: ["社外", "営業"],
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
        tags: [],
      }),
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
        signatureId: "signature-default",
        variableValues: {},
        tags: [],
      }),
    ).toBe(false);

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
        variableValues: {},
        tags: ["社外"],
      }),
    ).toBe(true);
  });
});
