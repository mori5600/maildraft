import { describe, expect, it } from "vitest";

import { createDraftInput, createVariablePreset } from "../../test/ui-fixtures";
import {
  collectRecommendedVariablePresets,
  orderVariablePresetsForDraft,
} from "./variable-preset-recommendations";

describe("variable preset recommendations", () => {
  it("prioritizes recently used presets before other recommendation signals", () => {
    const draftForm = createDraftInput({
      subject: "A社向けのご案内",
      tags: ["社外"],
      title: "A社フォロー",
    });
    const presets = [
      createVariablePreset({
        id: "preset-recent",
        lastUsedAt: "30",
        name: "別案件",
        tags: [],
      }),
      createVariablePreset({
        id: "preset-tagged",
        lastUsedAt: null,
        name: "A社向け",
        tags: ["社外"],
      }),
      createVariablePreset({
        id: "preset-other",
        lastUsedAt: null,
        name: "B社向け",
        tags: [],
      }),
    ];

    expect(orderVariablePresetsForDraft(presets, draftForm).map((preset) => preset.id)).toEqual([
      "preset-recent",
      "preset-tagged",
      "preset-other",
    ]);
  });

  it("returns only presets with recommendation signals and exposes the top reasons", () => {
    const draftForm = createDraftInput({
      subject: "営業会議のご案内",
      tags: ["営業"],
      title: "営業会議",
    });
    const recommendations = collectRecommendedVariablePresets(
      [
        createVariablePreset({
          id: "preset-tag",
          lastUsedAt: null,
          name: "通常",
          tags: ["営業"],
        }),
        createVariablePreset({
          id: "preset-name",
          lastUsedAt: null,
          name: "営業会議向け",
          tags: [],
        }),
        createVariablePreset({
          id: "preset-none",
          lastUsedAt: null,
          name: "社内通常",
          tags: [],
        }),
      ],
      draftForm,
      5,
    );

    expect(recommendations).toEqual([
      expect.objectContaining({
        preset: expect.objectContaining({ id: "preset-tag" }),
        reasonLabel: "タグ一致: 営業",
      }),
      expect.objectContaining({
        preset: expect.objectContaining({ id: "preset-name" }),
        reasonLabel: "件名/一覧名に近い",
      }),
    ]);
  });
});
