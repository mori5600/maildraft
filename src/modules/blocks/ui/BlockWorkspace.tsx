import type { EditorSettings } from "../../../shared/ui/code-editor/editor-settings";
import type { ContentBlock, ContentBlockInput } from "../model";
import { BlockEditorPane } from "./panes/BlockEditorPane";
import { BlockListPane } from "./panes/BlockListPane";

interface BlockWorkspaceProps {
  activeTagFilter: string | null;
  autoSaveLabel: string;
  availableTags: string[];
  tagCounts?: Record<string, number>;
  blockForm: ContentBlockInput;
  blocks: ContentBlock[];
  editorSettings?: EditorSettings;
  onChangeBlock: <K extends keyof ContentBlockInput>(field: K, value: ContentBlockInput[K]) => void;
  onChangeSearchQuery: (value: string) => void;
  onChangeTagFilter: (tag: string | null) => void;
  onCreateBlock: () => void;
  onDeleteBlock: () => Promise<void>;
  onDuplicateBlock: () => Promise<void>;
  onSaveBlock: () => Promise<void>;
  onSelectBlock: (id: string) => void;
  searchQuery: string;
  selectedBlockId: string | null;
  selectedBlockUpdatedAt: string | null;
  showWhitespace: boolean;
  totalBlockCount: number;
}

export function BlockWorkspace({
  activeTagFilter,
  autoSaveLabel,
  availableTags,
  tagCounts,
  blockForm,
  blocks,
  editorSettings,
  onChangeBlock,
  onChangeSearchQuery,
  onChangeTagFilter,
  onCreateBlock,
  onDeleteBlock,
  onDuplicateBlock,
  onSaveBlock,
  onSelectBlock,
  searchQuery,
  selectedBlockId,
  selectedBlockUpdatedAt,
  showWhitespace,
  totalBlockCount,
}: BlockWorkspaceProps) {
  return (
    <div className="grid h-full min-h-0 gap-3 xl:grid-cols-[248px_minmax(0,1fr)]">
      <BlockListPane
        activeTagFilter={activeTagFilter}
        availableTags={availableTags}
        tagCounts={tagCounts}
        blocks={blocks}
        onChangeSearchQuery={onChangeSearchQuery}
        onChangeTagFilter={onChangeTagFilter}
        onCreateBlock={onCreateBlock}
        onSelectBlock={onSelectBlock}
        searchQuery={searchQuery}
        selectedBlockId={selectedBlockId}
        totalBlockCount={totalBlockCount}
      />

      <BlockEditorPane
        autoSaveLabel={autoSaveLabel}
        availableTags={availableTags}
        blockForm={blockForm}
        editorSettings={editorSettings}
        selectedBlockId={selectedBlockId}
        selectedBlockUpdatedAt={selectedBlockUpdatedAt}
        showWhitespace={showWhitespace}
        onChangeBlock={onChangeBlock}
        onCreateBlock={onCreateBlock}
        onDeleteBlock={onDeleteBlock}
        onDuplicateBlock={onDuplicateBlock}
        onSaveBlock={onSaveBlock}
      />
    </div>
  );
}
