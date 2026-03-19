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

export const DEFAULT_SIGNATURE_NAME = "新しい署名";

export function createEmptySignature(isDefault: boolean): SignatureInput {
  return {
    id: crypto.randomUUID(),
    name: DEFAULT_SIGNATURE_NAME,
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

export function signatureHasMeaningfulContent(signature: SignatureInput): boolean {
  return Boolean(
    signature.isPinned ||
    (signature.name.trim() && signature.name.trim() !== DEFAULT_SIGNATURE_NAME) ||
    signature.body.trim(),
  );
}

export function signatureInputsEqual(left: SignatureInput, right: SignatureInput | null): boolean {
  if (!right) {
    return false;
  }

  return (
    left.id === right.id &&
    left.name === right.name &&
    left.isPinned === right.isPinned &&
    left.body === right.body &&
    left.isDefault === right.isDefault
  );
}

export function signatureMatchesPersistedSignature(
  left: SignatureInput,
  right: Signature | null,
): boolean {
  if (!right) {
    return false;
  }

  return (
    left.id === right.id &&
    left.name === right.name &&
    left.isPinned === right.isPinned &&
    left.body === right.body &&
    left.isDefault === right.isDefault
  );
}

function withCopySuffix(value: string): string {
  return value.trim() ? `${value.trim()} コピー` : "コピー";
}
