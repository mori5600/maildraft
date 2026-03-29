import { useMemo } from "react";

import { Button, Field, Select } from "../../../../shared/ui/primitives";
import { WhitespaceInput } from "../../../../shared/ui/WhitespaceInput";
import type { DraftInput } from "../../model";
import { buildVariablePresetRecommendationViewModel } from "../../variable-preset-recommendations";
import type { VariablePreset } from "../../variable-presets";

interface DraftVariablePresetPanelProps {
  draftForm: DraftInput;
  variableNames: string[];
  variablePresets: VariablePreset[];
  selectedVariablePresetId: string | null;
  variablePresetName: string;
  showWhitespace: boolean;
  canSaveVariablePreset: boolean;
  canApplyVariablePreset: boolean;
  onChangeDraftVariable: (name: string, value: string) => void;
  onSelectVariablePreset: (id: string | null) => void;
  onChangeVariablePresetName: (value: string) => void;
  onCreateVariablePreset: () => void;
  onApplyVariablePreset: () => Promise<void>;
  onApplyRecommendedVariablePreset: (presetId: string) => Promise<void>;
  onSaveVariablePreset: () => Promise<void>;
  onDeleteVariablePreset: () => Promise<void>;
}

export function DraftVariablePresetPanel({
  draftForm,
  variableNames,
  variablePresets,
  selectedVariablePresetId,
  variablePresetName,
  showWhitespace,
  canSaveVariablePreset,
  canApplyVariablePreset,
  onChangeDraftVariable,
  onSelectVariablePreset,
  onChangeVariablePresetName,
  onCreateVariablePreset,
  onApplyVariablePreset,
  onApplyRecommendedVariablePreset,
  onSaveVariablePreset,
  onDeleteVariablePreset,
}: DraftVariablePresetPanelProps) {
  const variablePresetViewModel = useMemo(
    () => buildVariablePresetRecommendationViewModel(variablePresets, draftForm),
    [draftForm, variablePresets],
  );

  if (variableNames.length === 0) {
    return (
      <div className="rounded-[7px] border border-(--color-panel-border-strong) bg-(--color-field-bg) px-3 py-2.5 text-[13px] leading-6 text-(--color-text-muted)">
        この下書きには差し込み変数がありません。
      </div>
    );
  }

  return (
    <>
      <div className="rounded-[7px] border border-(--color-panel-border-strong) bg-(--color-field-bg) px-3 py-3">
        <div className="grid gap-3">
          {variablePresetViewModel.recommendedPresets.length > 0 ? (
            <Field label="おすすめ" wrapWithLabel={false}>
              <div className="flex flex-wrap gap-2">
                {variablePresetViewModel.recommendedPresets.map(({ preset, reasonLabel }) => (
                  <Button
                    key={preset.id}
                    size="sm"
                    title={reasonLabel}
                    variant={selectedVariablePresetId === preset.id ? "secondary" : "ghost"}
                    onClick={() => void onApplyRecommendedVariablePreset(preset.id)}
                  >
                    {preset.name}
                  </Button>
                ))}
              </div>
            </Field>
          ) : null}

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Field label="差し込みセット">
              <Select
                value={selectedVariablePresetId ?? ""}
                onChange={(event) => onSelectVariablePreset(event.currentTarget.value || null)}
              >
                <option value="">保存済みセットを選択</option>
                {variablePresetViewModel.orderedPresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="セット名">
              <WhitespaceInput
                placeholder="A社向け"
                showWhitespace={showWhitespace}
                value={variablePresetName}
                onChange={(event) => onChangeVariablePresetName(event.currentTarget.value)}
              />
            </Field>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              disabled={!canApplyVariablePreset}
              size="sm"
              variant="secondary"
              onClick={() => void onApplyVariablePreset()}
            >
              適用
            </Button>
            <Button size="sm" variant="ghost" onClick={onCreateVariablePreset}>
              新規セット
            </Button>
            <Button
              disabled={!canSaveVariablePreset}
              size="sm"
              variant="primary"
              onClick={() => void onSaveVariablePreset()}
            >
              値を保存
            </Button>
            <Button
              disabled={!selectedVariablePresetId}
              size="sm"
              variant="danger"
              onClick={() => void onDeleteVariablePreset()}
            >
              削除
            </Button>
          </div>
        </div>
      </div>

      {variableNames.map((name) => (
        <Field key={name} hint={`{{${name}}}`} label={name}>
          <WhitespaceInput
            placeholder={`{{${name}}} に入れる値`}
            showWhitespace={showWhitespace}
            value={draftForm.variableValues[name] ?? ""}
            onChange={(event) => onChangeDraftVariable(name, event.currentTarget.value)}
          />
        </Field>
      ))}
      <div className="rounded-[7px] border border-(--color-panel-border-strong) bg-(--color-field-bg) px-3 py-2.5 text-[13px] leading-6 text-(--color-text-muted)">
        本文中の <code>{`{{...}}`}</code> はそのまま保存し、プレビューとコピー時に差し込みます。
      </div>
    </>
  );
}
