import { describe, expect, it } from "vitest";

import {
  createEmptySignature,
  duplicateSignatureInput,
  toSignatureInput,
} from "./model";

describe("signature model", () => {
  it("creates an empty signature with the requested default flag", () => {
    expect(createEmptySignature(true)).toMatchObject({
      name: "新しい署名",
      isPinned: false,
      body: "",
      isDefault: true,
    });
    expect(createEmptySignature(false)).toMatchObject({
      name: "新しい署名",
      isDefault: false,
    });
  });

  it("converts a signature to editable input", () => {
    expect(
      toSignatureInput({
        id: "signature-1",
        name: "営業署名",
        isPinned: true,
        body: "株式会社△△\n山田 太郎",
        isDefault: true,
        createdAt: "1",
        updatedAt: "2",
      }),
    ).toEqual({
      id: "signature-1",
      name: "営業署名",
      isPinned: true,
      body: "株式会社△△\n山田 太郎",
      isDefault: true,
    });
  });

  it("duplicates a signature into a non-default unpinned copy", () => {
    const duplicate = duplicateSignatureInput({
      id: "signature-1",
      name: "営業署名",
      isPinned: true,
      body: "本文",
      isDefault: true,
    });

    expect(duplicate.id).not.toBe("signature-1");
    expect(duplicate).toMatchObject({
      name: "営業署名 コピー",
      isPinned: false,
      body: "本文",
      isDefault: false,
    });
  });
});
