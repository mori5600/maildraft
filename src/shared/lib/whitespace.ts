export function visualizeWhitespace(text: string): string {
  return text.replace(/ /g, "·").replace(/\u3000/g, "□");
}
