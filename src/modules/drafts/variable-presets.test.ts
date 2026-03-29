import { describe, expect, it } from "vitest";

import {
  applyVariablePresetValues,
  collectMeaningfulVariableValues,
  hasMeaningfulVariableValues,
  mergeVariablePresetCollectionsByRecency,
  sortVariablePresetsByRecent,
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

  it("sorts variable presets by recent use, then updated time", () => {
    expect(
      sortVariablePresetsByRecent([
        {
          id: "preset-older",
          name: "older",
          values: {},
          tags: [],
          createdAt: "1",
          updatedAt: "10",
          lastUsedAt: "10",
        },
        {
          id: "preset-recent",
          name: "recent",
          values: {},
          tags: [],
          createdAt: "1",
          updatedAt: "20",
          lastUsedAt: "20",
        },
        {
          id: "preset-never-used",
          name: "never",
          values: {},
          tags: [],
          createdAt: "1",
          updatedAt: "15",
          lastUsedAt: null,
        },
      ]).map((preset) => preset.id),
    ).toEqual(["preset-recent", "preset-never-used", "preset-older"]);
  });

  it("keeps newer variable preset fields when usage responses arrive out of order", () => {
    expect(
      mergeVariablePresetCollectionsByRecency(
        [
          {
            id: "preset-a",
            name: "A社向け",
            values: {},
            tags: [],
            createdAt: "1",
            updatedAt: "30",
            lastUsedAt: "30",
          },
          {
            id: "preset-b",
            name: "B社向け",
            values: {},
            tags: [],
            createdAt: "1",
            updatedAt: "40",
            lastUsedAt: "40",
          },
        ],
        [
          {
            id: "preset-a",
            name: "A社向け",
            values: {},
            tags: [],
            createdAt: "1",
            updatedAt: "35",
            lastUsedAt: "35",
          },
          {
            id: "preset-b",
            name: "B社向け",
            values: {},
            tags: [],
            createdAt: "1",
            updatedAt: "20",
            lastUsedAt: null,
          },
        ],
      ).map((preset) => ({
        id: preset.id,
        lastUsedAt: preset.lastUsedAt,
      })),
    ).toEqual([
      { id: "preset-b", lastUsedAt: "40" },
      { id: "preset-a", lastUsedAt: "35" },
    ]);
  });
});
