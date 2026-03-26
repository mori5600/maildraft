import { useState } from "react";

import type { SignatureSortOption } from "../../../shared/lib/list-sort";
import { visualizeWhitespace } from "../../../shared/lib/whitespace";
import type { EditorSettings } from "../../../shared/ui/code-editor/editor-settings";
import { PreviewOverlay } from "../../../shared/ui/PreviewOverlay";
import type { Signature, SignatureInput } from "../model";
import { SignatureEditorPane } from "./panes/SignatureEditorPane";
import { SignatureListPane } from "./panes/SignatureListPane";
import { SignaturePreviewPane } from "./panes/SignaturePreviewPane";

interface SignatureWorkspaceProps {
  signatures: Signature[];
  totalSignatureCount: number;
  selectedSignatureId: string | null;
  signatureForm: SignatureInput;
  autoSaveLabel: string;
  editorSettings?: EditorSettings;
  showWhitespace: boolean;
  searchQuery: string;
  sort: SignatureSortOption;
  canDuplicate: boolean;
  onSelectSignature: (id: string) => void;
  onCreateSignature: () => void;
  onChangeSearchQuery: (value: string) => void;
  onChangeSort: (value: SignatureSortOption) => void;
  onChangeSignature: <K extends keyof SignatureInput>(field: K, value: SignatureInput[K]) => void;
  onSaveSignature: () => Promise<void>;
  onDeleteSignature: () => Promise<void>;
  onDuplicateSignature: () => Promise<void>;
  onTogglePinned: () => void;
}

export function SignatureWorkspace({
  signatures,
  totalSignatureCount,
  selectedSignatureId,
  signatureForm,
  autoSaveLabel,
  editorSettings,
  showWhitespace,
  searchQuery,
  sort,
  canDuplicate,
  onSelectSignature,
  onCreateSignature,
  onChangeSearchQuery,
  onChangeSort,
  onChangeSignature,
  onSaveSignature,
  onDeleteSignature,
  onDuplicateSignature,
  onTogglePinned,
}: SignatureWorkspaceProps) {
  const [isWidePreviewOpen, setIsWidePreviewOpen] = useState(false);
  const canExpandPreview = signatureForm.body.trim().length > 0;
  const previewBodyText =
    (showWhitespace ? visualizeWhitespace(signatureForm.body) : signatureForm.body) ||
    "署名プレビューがここに表示されます。";

  return (
    <>
      <div className="grid h-full min-h-0 gap-3 xl:grid-cols-[248px_minmax(0,1fr)_280px]">
        <SignatureListPane
          searchQuery={searchQuery}
          selectedSignatureId={selectedSignatureId}
          signatures={signatures}
          sort={sort}
          totalSignatureCount={totalSignatureCount}
          onChangeSearchQuery={onChangeSearchQuery}
          onChangeSort={onChangeSort}
          onCreateSignature={onCreateSignature}
          onSelectSignature={onSelectSignature}
        />

        <SignatureEditorPane
          autoSaveLabel={autoSaveLabel}
          canDuplicate={canDuplicate}
          editorSettings={editorSettings}
          selectedSignatureId={selectedSignatureId}
          showWhitespace={showWhitespace}
          signatureForm={signatureForm}
          onChangeSignature={onChangeSignature}
          onDeleteSignature={onDeleteSignature}
          onDuplicateSignature={onDuplicateSignature}
          onSaveSignature={onSaveSignature}
          onTogglePinned={onTogglePinned}
        />

        <SignaturePreviewPane
          canExpandPreview={canExpandPreview}
          previewBodyText={previewBodyText}
          onOpenPreview={() => setIsWidePreviewOpen(true)}
        />
      </div>

      <PreviewOverlay
        description="仕上がり表示"
        isOpen={isWidePreviewOpen}
        title="署名プレビュー"
        onClose={() => setIsWidePreviewOpen(false)}
      >
        <section className="rounded-lg border border-(--color-panel-border-strong) bg-(--color-preview-bg) p-4">
          <div className="text-[10px] tracking-[0.14em] text-(--color-text-subtle) uppercase">
            本文
          </div>
          <pre className="mail-signature-text mt-2.5 min-h-120 overflow-x-auto whitespace-pre-wrap text-(--color-preview-text)">
            {previewBodyText}
          </pre>
        </section>
      </PreviewOverlay>
    </>
  );
}
