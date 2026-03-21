import { describe, expect, it } from "vitest";

import type { DraftInput } from "../drafts/model";
import type { Signature } from "../signatures/model";
import {
  buildDraftRenderResult,
  collectDraftChecks,
  collectDraftVariableNames,
  renderDraftPreview,
  renderDraftSubject,
  renderTemplatePreview,
} from "./render-draft";

const baseDraft: DraftInput = {
  id: "draft-1",
  title: "打ち合わせお礼",
  isPinned: false,
  subject: "{{案件名}}のお礼",
  recipient: "{{会社名}}\n{{担当者名}} 様",
  opening: "いつもお世話になっております。",
  body: "{{案件名}} についてお時間をいただきありがとうございました。",
  closing: "引き続きよろしくお願いいたします。",
  templateId: "template-1",
  signatureId: "signature-1",
  variableValues: {
    会社名: "株式会社〇〇",
    担当者名: "佐藤",
    案件名: "導入相談",
  },
};

const signature: Signature = {
  id: "signature-1",
  name: "標準署名",
  isPinned: false,
  body: "株式会社△△\n山田 太郎",
  isDefault: true,
  createdAt: "0",
  updatedAt: "0",
};

describe("render-draft", () => {
  it("builds preview, subject, checks, and variable names together", () => {
    expect(buildDraftRenderResult(baseDraft, signature)).toEqual({
      checks: ["送信前チェックはすべて通っています。"],
      previewSubject: "導入相談のお礼",
      previewText: [
        "株式会社〇〇\n佐藤 様",
        "いつもお世話になっております。",
        "導入相談 についてお時間をいただきありがとうございました。",
        "引き続きよろしくお願いいたします。",
        "株式会社△△\n山田 太郎",
      ].join("\n\n"),
      variableNames: ["案件名", "会社名", "担当者名"],
    });
  });

  it("renders preview text with resolved variables and joined sections", () => {
    expect(renderDraftPreview(baseDraft, signature)).toBe(
      [
        "株式会社〇〇\n佐藤 様",
        "いつもお世話になっております。",
        "導入相談 についてお時間をいただきありがとうございました。",
        "引き続きよろしくお願いいたします。",
        "株式会社△△\n山田 太郎",
      ].join("\n\n"),
    );
  });

  it("renders subject and template preview independently", () => {
    expect(renderDraftSubject(baseDraft)).toBe("導入相談のお礼");
    expect(
      renderTemplatePreview(
        {
          id: "template-1",
          name: "お礼",
          isPinned: false,
          subject: "お礼",
          recipient: "株式会社〇〇",
          opening: "お世話になっております。",
          body: "ありがとうございます。",
          closing: "",
          signatureId: signature.id,
        },
        signature,
      ),
    ).toBe(
      [
        "株式会社〇〇",
        "お世話になっております。",
        "ありがとうございます。",
        "株式会社△△\n山田 太郎",
      ].join("\n\n"),
    );
  });

  it("collects draft checks and variable names from draft and signature", () => {
    expect(collectDraftVariableNames(baseDraft, { ...signature, body: "{{署名名}}" })).toEqual([
      "案件名",
      "会社名",
      "担当者名",
      "署名名",
    ]);

    expect(
      collectDraftChecks(
        {
          ...baseDraft,
          subject: "",
          opening: "",
          recipient: "",
          body: "",
          variableValues: {
            会社名: "株式会社〇〇",
          },
        },
        undefined,
      ),
    ).toEqual([
      "件名が未入力です。",
      "宛名または書き出しが未入力です。",
      "本文が未入力です。",
      "署名が未設定です。",
    ]);

    expect(
      collectDraftChecks(
        {
          ...baseDraft,
          variableValues: {
            会社名: "株式会社〇〇",
          },
        },
        signature,
      ),
    ).toEqual(["未置換の変数があります: 案件名, 担当者名"]);
  });
});
