export interface Memo {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface MemoInput {
  id: string;
  title: string;
  body: string;
}

export type MemoLike = Pick<MemoInput, "title" | "body">;

const MEMO_LINE_BREAK_PATTERN = /\r\n|\r|\n/;

export function createEmptyMemo(): MemoInput {
  return {
    id: crypto.randomUUID(),
    title: "",
    body: "",
  };
}

export function toMemoInput(memo: Memo): MemoInput {
  return {
    id: memo.id,
    title: memo.title,
    body: memo.body,
  };
}

export function memoMatchesPersistedMemo(left: MemoInput, right: Memo | null): boolean {
  if (!right) {
    return false;
  }

  return left.id === right.id && left.title === right.title && left.body === right.body;
}

export function memoHasMeaningfulContent(input: MemoLike): boolean {
  return Boolean(input.title.trim() || input.body.trim());
}

export function memoLabel(input: MemoLike): string {
  const title = input.title.trim();
  if (title) {
    return title;
  }

  const firstBodyLine = findFirstMeaningfulMemoLine(input);

  return firstBodyLine ?? "無題のメモ";
}

export function memoExcerpt(input: MemoLike): string {
  const firstMeaningfulLine = findFirstMeaningfulMemoLine(input);

  if (firstMeaningfulLine && firstMeaningfulLine !== memoLabel(input)) {
    return firstMeaningfulLine;
  }

  return input.title.trim() ? "本文なし" : "空のメモ";
}

export function memoLineCount(input: MemoLike): number {
  return Math.max(1, input.body.split(MEMO_LINE_BREAK_PATTERN).length);
}

export function memoCharacterCount(input: MemoLike): number {
  return input.title.length + input.body.length;
}

function findFirstMeaningfulMemoLine(input: MemoLike): string | null {
  return (
    input.body
      .split(MEMO_LINE_BREAK_PATTERN)
      .map((line) => line.trim())
      .find(Boolean) ?? null
  );
}
