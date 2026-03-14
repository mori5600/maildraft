import { describe, expect, it } from "vitest";

import type { Draft } from "../../modules/drafts/model";
import type { Signature } from "../../modules/signatures/model";
import type { Template } from "../../modules/templates/model";
import { sortDrafts, sortSignatures, sortTemplates } from "./list-sort";

const drafts: Draft[] = [
  {
    id: "draft-1",
    title: "",
    isPinned: false,
    subject: "B件名",
    recipient: "",
    opening: "",
    body: "",
    closing: "",
    templateId: null,
    signatureId: null,
    variableValues: {},
    createdAt: "1",
    updatedAt: "10",
  },
  {
    id: "draft-2",
    title: "A下書き",
    isPinned: true,
    subject: "Z件名",
    recipient: "",
    opening: "",
    body: "",
    closing: "",
    templateId: null,
    signatureId: null,
    variableValues: {},
    createdAt: "1",
    updatedAt: "5",
  },
  {
    id: "draft-3",
    title: "C下書き",
    isPinned: false,
    subject: "A件名",
    recipient: "",
    opening: "",
    body: "",
    closing: "",
    templateId: null,
    signatureId: null,
    variableValues: {},
    createdAt: "1",
    updatedAt: "20",
  },
];

const templates: Template[] = [
  {
    id: "template-1",
    name: "営業",
    isPinned: false,
    subject: "",
    recipient: "",
    opening: "",
    body: "",
    closing: "",
    signatureId: null,
    createdAt: "1",
    updatedAt: "5",
  },
  {
    id: "template-2",
    name: "お礼",
    isPinned: true,
    subject: "",
    recipient: "",
    opening: "",
    body: "",
    closing: "",
    signatureId: null,
    createdAt: "1",
    updatedAt: "3",
  },
];

const signatures: Signature[] = [
  {
    id: "signature-1",
    name: "田中",
    isPinned: false,
    body: "",
    isDefault: false,
    createdAt: "1",
    updatedAt: "2",
  },
  {
    id: "signature-2",
    name: "佐藤",
    isPinned: true,
    body: "",
    isDefault: true,
    createdAt: "1",
    updatedAt: "1",
  },
];

describe("list-sort", () => {
  it("sorts drafts with pinned items first and then by requested strategy", () => {
    expect(sortDrafts(drafts, "recent").map((draft) => draft.id)).toEqual([
      "draft-2",
      "draft-3",
      "draft-1",
    ]);
    expect(sortDrafts(drafts, "oldest").map((draft) => draft.id)).toEqual([
      "draft-2",
      "draft-1",
      "draft-3",
    ]);
    expect(sortDrafts(drafts, "label").map((draft) => draft.id)).toEqual([
      "draft-2",
      "draft-1",
      "draft-3",
    ]);
  });

  it("sorts templates and signatures with pinned items before the rest", () => {
    expect(sortTemplates(templates, "name").map((template) => template.id)).toEqual([
      "template-2",
      "template-1",
    ]);
    expect(sortTemplates(templates, "oldest").map((template) => template.id)).toEqual([
      "template-2",
      "template-1",
    ]);
    expect(sortSignatures(signatures, "name").map((signature) => signature.id)).toEqual([
      "signature-2",
      "signature-1",
    ]);
    expect(sortSignatures(signatures, "recent").map((signature) => signature.id)).toEqual([
      "signature-2",
      "signature-1",
    ]);
  });
});
