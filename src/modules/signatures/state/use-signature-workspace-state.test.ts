import { afterAll, describe, expect, it, vi } from "vitest";

import type { StoreSnapshot } from "../../../shared/types/store";
import { buildSignatureEditingState } from "./use-signature-workspace-state";

const randomUuidSpy = vi
  .spyOn(crypto, "randomUUID")
  .mockReturnValue("00000000-0000-4000-8000-000000000002");

const snapshot: StoreSnapshot = {
  drafts: [],
  draftHistory: [],
  variablePresets: [],
  templates: [],
  signatures: [
    {
      id: "signature-1",
      name: "標準署名",
      isPinned: false,
      body: "本文",
      isDefault: true,
      createdAt: "1",
      updatedAt: "2",
    },
    {
      id: "signature-2",
      name: "営業署名",
      isPinned: true,
      body: "営業部",
      isDefault: false,
      createdAt: "1",
      updatedAt: "1",
    },
  ],
  trash: {
    drafts: [],
    templates: [],
    signatures: [],
  },
};

describe("signature workspace state", () => {
  it("picks the preferred signature when it exists", () => {
    expect(buildSignatureEditingState(snapshot, "signature-2")).toMatchObject({
      selectedSignatureId: "signature-2",
      signatureForm: {
        id: "signature-2",
        name: "営業署名",
      },
    });
  });

  it("falls back to the first signature and creates an empty form when none exists", () => {
    expect(buildSignatureEditingState(snapshot, "missing")).toMatchObject({
      selectedSignatureId: "signature-1",
      signatureForm: {
        id: "signature-1",
        isDefault: true,
      },
    });

    expect(
      buildSignatureEditingState({
        drafts: [],
        draftHistory: [],
        variablePresets: [],
        templates: [],
        signatures: [],
        trash: {
          drafts: [],
          templates: [],
          signatures: [],
        },
      }),
    ).toMatchObject({
      selectedSignatureId: null,
      signatureForm: {
        id: "00000000-0000-4000-8000-000000000002",
        isDefault: true,
      },
    });
  });
});

afterAll(() => {
  randomUuidSpy.mockRestore();
});
