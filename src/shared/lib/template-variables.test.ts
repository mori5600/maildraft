import { describe, expect, it } from "vitest";

import {
  collectMissingVariableNames,
  extractVariableNames,
  resolveVariableTokens,
} from "./template-variables";

describe("template-variables", () => {
  it("extracts variable names in first-seen order without duplicates", () => {
    expect(
      extractVariableNames([
        "{{ 会社名 }} ご担当の {{担当者名}} 様",
        "案件 {{案件名}} と {{担当者名}} の確認",
      ]),
    ).toEqual(["会社名", "担当者名", "案件名"]);
  });

  it("resolves only filled variables and keeps unresolved tokens", () => {
    expect(
      resolveVariableTokens("{{会社名}}の{{担当者名}}様へ {{日付}} 送付", {
        会社名: "株式会社〇〇",
        担当者名: "佐藤",
        日付: " ",
      }),
    ).toBe("株式会社〇〇の佐藤様へ {{日付}} 送付");
  });

  it("collects missing variable names from empty values", () => {
    expect(
      collectMissingVariableNames(["会社名", "担当者名", "案件名"], {
        会社名: "株式会社〇〇",
        担当者名: "",
        案件名: "   ",
      }),
    ).toEqual(["担当者名", "案件名"]);
  });
});
