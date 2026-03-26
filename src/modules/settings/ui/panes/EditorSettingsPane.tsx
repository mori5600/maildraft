import { editorIndentUnitText } from "../../../../shared/ui/code-editor/editor-settings";
import { PaneHeader } from "../../../../shared/ui/PaneHeader";
import { Button, Field, Panel, Select } from "../../../../shared/ui/primitives";
import {
  EDITOR_INDENT_STYLE_OPTIONS,
  type EditorSettingsInput,
  type EditorSettingsSnapshot,
} from "../../model";

const EDITOR_TAB_SIZE_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

interface EditorSettingsPaneProps {
  editorForm: EditorSettingsInput;
  editorSettings: EditorSettingsSnapshot;
  isDirty: boolean;
  isSaving: boolean;
  onChangeEditor: <K extends keyof EditorSettingsInput>(
    field: K,
    value: EditorSettingsInput[K],
  ) => void;
  onSaveEditorSettings: () => Promise<void>;
}

function describeIndentBehavior(settings: EditorSettingsSnapshot): string {
  if (settings.indentStyle === "tabs") {
    return `Tab キーでタブ文字を挿入し、表示幅は ${settings.tabSize} 文字分です。`;
  }

  return `Tab キーでスペース ${settings.tabSize} 個を挿入します。`;
}

function renderIndentPreview(settings: EditorSettingsInput): string {
  const indentUnit = editorIndentUnitText(settings);

  return indentUnit.split("\t").join("\u21E5").split(" ").join("\u00B7");
}

export function EditorSettingsPane({
  editorForm,
  editorSettings,
  isDirty,
  isSaving,
  onChangeEditor,
  onSaveEditorSettings,
}: EditorSettingsPaneProps) {
  return (
    <Panel className="overflow-hidden">
      <PaneHeader
        action={
          <Button
            disabled={!isDirty || isSaving}
            size="sm"
            title="Ctrl/Cmd+S"
            variant="primary"
            onClick={() => void onSaveEditorSettings()}
          >
            {isSaving ? "保存中" : "保存"}
          </Button>
        }
        description="複数行エディタのインデント方式とタブ幅を決めます。"
        title="エディタ設定"
      />

      <div className="px-3.5 py-3.5">
        <div className="grid gap-3">
          <section className="rounded-lg border border-(--color-panel-border-strong) bg-(--color-field-bg) px-3.5 py-3">
            <div className="text-[10px] tracking-[0.14em] text-(--color-text-subtle) uppercase">
              反映される場所
            </div>
            <div className="mt-2.5 space-y-1.5 text-[13px] leading-6 text-(--color-text-muted)">
              <p>
                本文、書き出し、結び、テンプレート本文、署名本文、メモ本文の Tab 操作に反映します。
              </p>
              <p>単一行の入力欄は従来どおり Tab で次の項目へ移動します。</p>
            </div>
          </section>

          <div className="grid gap-3 md:grid-cols-2">
            <Field
              hint={
                EDITOR_INDENT_STYLE_OPTIONS.find(
                  (option) => option.value === editorForm.indentStyle,
                )?.description
              }
              label="インデント種別"
            >
              <Select
                aria-label="インデント種別"
                value={editorForm.indentStyle}
                onChange={(event) =>
                  onChangeEditor(
                    "indentStyle",
                    event.currentTarget.value as EditorSettingsInput["indentStyle"],
                  )
                }
              >
                {EDITOR_INDENT_STYLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              hint={
                editorForm.indentStyle === "tabs"
                  ? "タブ文字の見た目の幅です。"
                  : "Tab 1 回で挿入するスペース数です。"
              }
              label="タブ幅"
            >
              <Select
                aria-label="タブ幅"
                value={String(editorForm.tabSize)}
                onChange={(event) => onChangeEditor("tabSize", Number(event.currentTarget.value))}
              >
                {EDITOR_TAB_SIZE_OPTIONS.map((tabSize) => (
                  <option key={tabSize} value={tabSize}>
                    {tabSize}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <section className="rounded-lg border border-(--color-panel-border-strong) bg-(--color-field-bg) px-3.5 py-3">
            <div className="text-[10px] tracking-[0.14em] text-(--color-text-subtle) uppercase">
              現在の設定
            </div>
            <div className="mt-2.5 text-[13px] leading-6 text-(--color-text-muted)">
              {describeIndentBehavior(editorSettings)}
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-[7px] border border-(--color-panel-border) bg-(--color-panel-bg) px-3 py-2 text-xs text-(--color-text-subtle)">
              <span className="shrink-0">プレビュー</span>
              <code className="rounded bg-(--color-preview-bg) px-2 py-1 text-(--color-text-strong)">
                {renderIndentPreview(editorForm)}
              </code>
            </div>
          </section>
        </div>
      </div>
    </Panel>
  );
}
