import { describe, expect, it } from "vitest";

import { BACKUP_FILE_FILTER, createBackupDefaultFileName } from "./backup";
import { formatBytes } from "./bytes";
import { truncate } from "./text";
import { visualizeWhitespace } from "./whitespace";

describe("formatting utilities", () => {
  it("keeps the backup filter stable and formats zero-padded backup file names", () => {
    expect(BACKUP_FILE_FILTER).toEqual({
      name: "MailDraft バックアップ",
      extensions: ["json"],
    });
    expect(createBackupDefaultFileName(new Date(2024, 0, 2, 3, 4))).toBe(
      "maildraft-backup-20240102-0304.json",
    );
  });

  it.each([
    { value: Number.NaN, expected: "0 B" },
    { value: -1, expected: "0 B" },
    { value: 0, expected: "0 B" },
    { value: 512, expected: "512 B" },
    { value: 1024, expected: "1.0 KB" },
    { value: 1536, expected: "1.5 KB" },
    { value: 1024 * 1024, expected: "1.0 MB" },
    { value: 5 * 1024 * 1024 + 1200, expected: "5.0 MB" },
  ])("formats byte sizes for $value", ({ value, expected }) => {
    expect(formatBytes(value)).toBe(expected);
  });

  it("truncates only over the limit and handles one-character limits", () => {
    expect(truncate("abc", 3)).toBe("abc");
    expect(truncate("abcd", 3)).toBe("ab…");
    expect(truncate("a", 1)).toBe("a");
    expect(truncate("ab", 1)).toBe("…");
  });

  it("visualizes half-width and full-width spaces without touching other text", () => {
    expect(visualizeWhitespace("A B　C")).toBe("A·B□C");
  });
});
