/**
 * This is for preview only.
 *
 * Clipboard paths must use the original text.
 */
export function visualizeWhitespace(text: string): string {
  return text.replace(/ /g, "·").replace(/\u3000/g, "□");
}
