import { describe, expect, it } from "vitest";

import {
  applyVariablePresetValues,
  collectMeaningfulVariableValues,
  hasMeaningfulVariableValues,
} from "./variable-presets";

describe("variable-presets", () => {
  it("collects only non-empty values for variables used in the current draft", () => {
    expect(
      collectMeaningfulVariableValues(["会社名", "担当者名"], {
        会社名: "株式会社〇〇",
        担当者名: "  ",
        部署名: "営業部",
      }),
    ).toEqual({
      会社名: "株式会社〇〇",
    });
  });

  it("applies only values that match the current variable names", () => {
    expect(
      applyVariablePresetValues(
        {
          会社名: "旧会社",
          担当者名: "旧担当",
          案件名: "旧案件",
        },
        {
          会社名: "株式会社△△",
          担当者名: "山田",
          署名名: "営業署名",
        },
        ["会社名", "担当者名"],
      ),
    ).toEqual({
      会社名: "株式会社△△",
      担当者名: "山田",
      案件名: "旧案件",
    });
  });

  it("detects whether there are any meaningful values to save", () => {
    expect(hasMeaningfulVariableValues(["会社名", "担当者名"], { 会社名: "株式会社〇〇" })).toBe(
      true,
    );
    expect(hasMeaningfulVariableValues(["会社名", "担当者名"], { 会社名: " ", 担当者名: "" })).toBe(
      false,
    );
  });
});
