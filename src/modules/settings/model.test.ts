import { describe, expect, it } from "vitest";

import {
  createDefaultLoggingSettingsSnapshot,
  loggingModeDescription,
  toLoggingSettingsInput,
} from "./model";

describe("settings model", () => {
  it("creates the expected default logging snapshot", () => {
    expect(createDefaultLoggingSettingsSnapshot()).toEqual({
      mode: "errors_only",
      retentionDays: 14,
      directoryPath: "",
      totalBytes: 0,
      fileCount: 0,
      maxFileSizeBytes: 1024 * 1024,
      maxRotatedFiles: 5,
    });
  });

  it("converts a logging snapshot back to editable input", () => {
    expect(
      toLoggingSettingsInput({
        ...createDefaultLoggingSettingsSnapshot(),
        mode: "standard",
        retentionDays: 30,
      }),
    ).toEqual({
      mode: "standard",
      retentionDays: 30,
    });
  });

  it("returns a fallback description for an unknown logging mode", () => {
    expect(loggingModeDescription("off")).toBe("ログを書き込みません。");
    expect(loggingModeDescription("unexpected" as never)).toBe(
      "ログ設定を選択してください。",
    );
  });
});
