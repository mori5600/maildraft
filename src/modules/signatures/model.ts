export interface Signature {
  id: string;
  name: string;
  isPinned: boolean;
  body: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SignatureInput {
  id: string;
  name: string;
  isPinned: boolean;
  body: string;
  isDefault: boolean;
}

export function createEmptySignature(isDefault: boolean): SignatureInput {
  return {
    id: crypto.randomUUID(),
    name: "新しい署名",
    isPinned: false,
    body: "",
    isDefault,
  };
}

export function toSignatureInput(signature: Signature): SignatureInput {
  return {
    id: signature.id,
    name: signature.name,
    isPinned: signature.isPinned,
    body: signature.body,
    isDefault: signature.isDefault,
  };
}

export function duplicateSignatureInput(signature: SignatureInput): SignatureInput {
  return {
    ...signature,
    id: crypto.randomUUID(),
    name: withCopySuffix(signature.name),
    isPinned: false,
    isDefault: false,
  };
}

function withCopySuffix(value: string): string {
  return value.trim() ? `${value.trim()} コピー` : "コピー";
}
