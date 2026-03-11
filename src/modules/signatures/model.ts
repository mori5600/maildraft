export interface Signature {
  id: string;
  name: string;
  body: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SignatureInput {
  id: string;
  name: string;
  body: string;
  isDefault: boolean;
}

export function createEmptySignature(isDefault: boolean): SignatureInput {
  return {
    id: crypto.randomUUID(),
    name: "新しい署名",
    body: "",
    isDefault,
  };
}

export function toSignatureInput(signature: Signature): SignatureInput {
  return {
    id: signature.id,
    name: signature.name,
    body: signature.body,
    isDefault: signature.isDefault,
  };
}

export function duplicateSignatureInput(signature: SignatureInput): SignatureInput {
  return {
    ...signature,
    id: crypto.randomUUID(),
    name: withCopySuffix(signature.name),
    isDefault: false,
  };
}

function withCopySuffix(value: string): string {
  return value.trim() ? `${value.trim()} コピー` : "コピー";
}
