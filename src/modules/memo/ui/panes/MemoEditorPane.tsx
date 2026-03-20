import { DocumentTextIcon } from "@heroicons/react/24/outline";

import { truncate } from "../../../../shared/lib/text";
import { formatStoredTime } from "../../../../shared/lib/time";
import { visualizeWhitespace } from "../../../../shared/lib/whitespace";
import { CodeEditor } from "../../../../shared/ui/code-editor/CodeEditor";
import { PaneHeader } from "../../../../shared/ui/PaneHeader";
import { Button, Input, Panel } from "../../../../shared/ui/primitives";
import {
  memoCharacterCount,
  type MemoInput,
  memoLineCount,
} from "../../model";

interface MemoEditorPaneProps {
  activeMemoUpdatedAt: string | null;
  autoSaveLabel: string;
  memoForm: MemoInput;
  onChangeMemo: <K extends keyof MemoInput>(field: K, value: MemoInput[K]) => void;
  onCreateMemo: () => void;
  onDeleteMemo: () => Promise<void>;
  onSaveMemo: () => Promise<void>;
  selectedMemoId: string | null;
  showWhitespace: boolean;
}

export function MemoEditorPane({
  activeMemoUpdatedAt,
  autoSaveLabel,
  memoForm,
  onChangeMemo,
  onCreateMemo,
  onDeleteMemo,
  onSaveMemo,
  selectedMemoId,
  showWhitespace,
}: MemoEditorPaneProps) {
  const previewBody = showWhitespace ? visualizeWhitespace(memoForm.body) : memoForm.body;

  return (
    <Panel className="flex min-h-0 flex-col overflow-hidden">
      <PaneHeader
        action={
          <div className="flex gap-2">
            <Button size="sm" title="Ctrl/Cmd+N" variant="ghost" onClick={onCreateMemo}>
              新規
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void onDeleteMemo()}>
              {selectedMemoId ? "削除" : "リセット"}
            </Button>
            <Button size="sm" title="Ctrl/Cmd+S" variant="primary" onClick={() => void onSaveMemo()}>
              保存
            </Button>
          </div>
        }
        description={autoSaveLabel}
        title="メモエディタ"
      />

      <div className="mail-note-editor-shell min-h-0 flex-1 overflow-hidden">
        <div className="mail-note-titlebar">
          <DocumentTextIcon
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-(--color-text-subtle)"
          />
          <Input
            aria-label="メモタイトル"
            className="mail-note-title-input flex-1"
            placeholder="タイトル"
            value={memoForm.title}
            onChange={(event) => onChangeMemo("title", event.currentTarget.value)}
          />
        </div>

        <div className="flex min-h-0 flex-1">
          <CodeEditor
            ariaLabel="メモ本文"
            className="mail-note-editor-frame h-full min-h-[24rem] flex-1 xl:min-h-[32rem]"
            placeholder="箇条書き、会話ログ、確認事項、メール化前の断片を書き留めます。"
            showLineNumbers
            showWhitespace={showWhitespace}
            textClassName="mail-note-editor-text"
            value={memoForm.body}
            onChange={(value) => onChangeMemo("body", value)}
          />
        </div>
      </div>

      <div className="flex items-center gap-4 border-t border-(--color-panel-border-strong) bg-(--color-sidebar-bg) px-4 py-2 text-[11px] text-(--color-text-muted)">
        <div>行 {memoLineCount(memoForm)}</div>
        <div>文字 {memoCharacterCount(memoForm)}</div>
        <div>{activeMemoUpdatedAt ? `保存: ${formatStoredTime(activeMemoUpdatedAt)}` : "未保存"}</div>
        <div className="ml-auto truncate text-(--color-text-subtle)">
          {previewBody.trim() ? truncate(previewBody.replace(/\s+/g, " "), 64) : "本文なし"}
        </div>
      </div>
    </Panel>
  );
}
