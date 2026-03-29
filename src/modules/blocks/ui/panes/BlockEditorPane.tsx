import { CodeEditor } from "../../../../shared/ui/code-editor/CodeEditor";
import type { EditorSettings } from "../../../../shared/ui/code-editor/editor-settings";
import { PaneHeader } from "../../../../shared/ui/PaneHeader";
import { Button, Field, Panel, Select } from "../../../../shared/ui/primitives";
import { TagEditorField } from "../../../../shared/ui/TagEditorField";
import {
  CONTENT_BLOCK_CATEGORY_OPTIONS,
  contentBlockCategoryLabel,
  type ContentBlockInput,
} from "../../model";

interface BlockEditorPaneProps {
  autoSaveLabel: string;
  availableTags: string[];
  blockForm: ContentBlockInput;
  editorSettings?: EditorSettings;
  onChangeBlock: <K extends keyof ContentBlockInput>(field: K, value: ContentBlockInput[K]) => void;
  onCreateBlock: () => void;
  onDeleteBlock: () => Promise<void>;
  onDuplicateBlock: () => Promise<void>;
  onSaveBlock: () => Promise<void>;
  selectedBlockId: string | null;
  selectedBlockUpdatedAt: string | null;
  showWhitespace: boolean;
}

export function BlockEditorPane({
  autoSaveLabel,
  availableTags,
  blockForm,
  editorSettings,
  onChangeBlock,
  onCreateBlock,
  onDeleteBlock,
  onDuplicateBlock,
  onSaveBlock,
  selectedBlockId,
  selectedBlockUpdatedAt,
  showWhitespace,
}: BlockEditorPaneProps) {
  return (
    <Panel className="flex min-h-0 flex-col overflow-hidden">
      <PaneHeader
        action={
          <div className="flex gap-2">
            <Button size="sm" title="Ctrl/Cmd+N" variant="ghost" onClick={onCreateBlock}>
              新規
            </Button>
            <Button
              disabled={!selectedBlockId}
              size="sm"
              variant="ghost"
              onClick={() => void onDuplicateBlock()}
            >
              複製
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void onDeleteBlock()}>
              {selectedBlockId ? "ゴミ箱へ移動" : "リセット"}
            </Button>
            <Button
              size="sm"
              title="Ctrl/Cmd+S"
              variant="primary"
              onClick={() => void onSaveBlock()}
            >
              保存
            </Button>
          </div>
        }
        description={`${contentBlockCategoryLabel(blockForm.category)}・${autoSaveLabel}`}
        title="文面ブロック編集"
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3.5">
        <div className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_200px]">
            <Field label="名前" wrapWithLabel={false}>
              <CodeEditor
                ariaLabel="文面ブロック名"
                className="min-h-8.5"
                editorSettings={editorSettings}
                showWhitespace={showWhitespace}
                singleLine
                textClassName="mail-field-text"
                value={blockForm.name}
                onChange={(value) => onChangeBlock("name", value)}
              />
            </Field>

            <Field label="カテゴリ">
              <Select
                value={blockForm.category}
                onChange={(event) =>
                  onChangeBlock(
                    "category",
                    event.currentTarget.value as ContentBlockInput["category"],
                  )
                }
              >
                {CONTENT_BLOCK_CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <TagEditorField
            availableTags={availableTags}
            key={blockForm.id}
            tags={blockForm.tags}
            onChangeTags={(tags) => onChangeBlock("tags", tags)}
          />

          <Field
            hint="下書き画面の書き出し・本文・結びの「挿入」から使えます"
            label="本文"
            wrapWithLabel={false}
          >
            <CodeEditor
              ariaLabel="文面ブロック本文"
              className="min-h-90"
              editorSettings={editorSettings}
              placeholder="よく使う短い定型文を保存します。"
              showWhitespace={showWhitespace}
              textClassName="mail-compose-text"
              value={blockForm.body}
              onChange={(value) => onChangeBlock("body", value)}
            />
          </Field>

          <div className="text-[11px] text-(--color-text-subtle)">
            {selectedBlockUpdatedAt ? `保存: ${selectedBlockUpdatedAt}` : "未保存"}
          </div>
        </div>
      </div>
    </Panel>
  );
}
