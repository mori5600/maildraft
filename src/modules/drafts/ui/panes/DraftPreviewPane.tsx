import { PaneHeader } from "../../../../shared/ui/PaneHeader";
import { Button, Field, Input, Panel, Select } from "../../../../shared/ui/primitives";
import type { DraftInput } from "../../model";
import type { VariablePreset } from "../../variable-presets";
import { DraftCheckList } from "./DraftCheckList";

interface DraftPreviewPaneProps {
  draftForm: DraftInput;
  draftHistoryCount: number;
  previewSubject: string;
  previewBodyText: string;
  checks: string[];
  variableNames: string[];
  variablePresets: VariablePreset[];
  selectedVariablePresetId: string | null;
  variablePresetName: string;
  previewDescription: string;
  showWhitespace: boolean;
  canCopyPreview: boolean;
  canExpandPreview: boolean;
  canSaveVariablePreset: boolean;
  canApplyVariablePreset: boolean;
  onOpenHistory: () => void;
  onOpenPreview: () => void;
  onCopyPreview: () => Promise<void>;
  onChangeDraftVariable: (name: string, value: string) => void;
  onSelectVariablePreset: (id: string | null) => void;
  onChangeVariablePresetName: (value: string) => void;
  onCreateVariablePreset: () => void;
  onApplyVariablePreset: () => void;
  onSaveVariablePreset: () => Promise<void>;
  onDeleteVariablePreset: () => Promise<void>;
}

export function DraftPreviewPane({
  draftForm,
  draftHistoryCount,
  previewSubject,
  previewBodyText,
  checks,
  variableNames,
  variablePresets,
  selectedVariablePresetId,
  variablePresetName,
  previewDescription,
  showWhitespace,
  canCopyPreview,
  canExpandPreview,
  canSaveVariablePreset,
  canApplyVariablePreset,
  onOpenHistory,
  onOpenPreview,
  onCopyPreview,
  onChangeDraftVariable,
  onSelectVariablePreset,
  onChangeVariablePresetName,
  onCreateVariablePreset,
  onApplyVariablePreset,
  onSaveVariablePreset,
  onDeleteVariablePreset,
}: DraftPreviewPaneProps) {
  return (
    <Panel className="flex min-h-0 flex-col overflow-hidden">
      <PaneHeader
        action={
          <div className="flex gap-2">
            <Button
              disabled={draftHistoryCount === 0}
              size="sm"
              variant="ghost"
              onClick={onOpenHistory}
            >
              履歴
            </Button>
            <Button
              disabled={!canExpandPreview}
              size="sm"
              variant="ghost"
              onClick={onOpenPreview}
            >
              拡大
            </Button>
            <Button
              disabled={!canCopyPreview}
              size="sm"
              title="Ctrl/Cmd+Shift+C"
              variant="ghost"
              onClick={() => void onCopyPreview()}
            >
              コピー
            </Button>
          </div>
        }
        description={previewDescription}
        title="プレビュー"
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="border-b border-(--color-panel-border-strong) px-3.5 py-3">
          <div className="text-[10px] tracking-[0.14em] text-(--color-text-subtle) uppercase">
            差し込み項目
          </div>
          <div className="mt-2.5 space-y-2.5">
            {variableNames.length === 0 ? (
              <div className="rounded-[7px] border border-(--color-panel-border-strong) bg-(--color-field-bg) px-3 py-2.5 text-[13px] leading-6 text-(--color-text-muted)">
                この下書きには差し込み変数がありません。
              </div>
            ) : (
              <>
                <div className="rounded-[7px] border border-(--color-panel-border-strong) bg-(--color-field-bg) px-3 py-3">
                  <div className="grid gap-3">
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                      <Field label="差し込みセット">
                        <Select
                          value={selectedVariablePresetId ?? ""}
                          onChange={(event) => onSelectVariablePreset(event.currentTarget.value || null)}
                        >
                          <option value="">保存済みセットを選択</option>
                          {variablePresets.map((preset) => (
                            <option key={preset.id} value={preset.id}>
                              {preset.name}
                            </option>
                          ))}
                        </Select>
                      </Field>

                      <Field label="セット名">
                        <Input
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
                    <Input
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
            )}
          </div>
        </div>

        <div className="border-b border-(--color-panel-border-strong) px-3.5 py-3">
          <div className="text-[10px] tracking-[0.14em] text-(--color-text-subtle) uppercase">
            件名
          </div>
          <div className="mt-1.5 text-[13px] text-(--color-text-strong)">
            {previewSubject || "件名未設定"}
          </div>
        </div>

        <div className="border-b border-(--color-panel-border-strong) px-3.5 py-3">
          <div className="text-[10px] tracking-[0.14em] text-(--color-text-subtle) uppercase">
            確認
          </div>
          <DraftCheckList checks={checks} />
        </div>

        <div className="px-3.5 py-3">
          <div className="text-[10px] tracking-[0.14em] text-(--color-text-subtle) uppercase">
            本文
          </div>
          <pre className="mail-preview-text mt-2 overflow-x-auto rounded-[7px] border border-(--color-panel-border-strong) bg-(--color-preview-bg) px-3.5 py-3 whitespace-pre-wrap text-(--color-preview-text)">
            {previewBodyText}
          </pre>
        </div>
      </div>
    </Panel>
  );
}
