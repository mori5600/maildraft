import { isTauri } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";

export async function copyPlainText(text: string): Promise<void> {
  if (isTauri()) {
    await writeText(text);
    return;
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  throw new Error("この環境ではクリップボードにコピーできません。");
}
