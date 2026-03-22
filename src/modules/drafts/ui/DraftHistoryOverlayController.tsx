import type { Signature } from "../../signatures/model";
import type { DraftHistoryEntry } from "../model";
import { DraftHistoryOverlay } from "./DraftHistoryOverlay";

interface DraftHistoryOverlayControllerProps {
  historyEntries: DraftHistoryEntry[];
  isOpen: boolean;
  showWhitespace: boolean;
  signatures: Signature[];
  onClose: () => void;
  onRestoreDraftHistory: (historyId: string) => Promise<void>;
}

export function DraftHistoryOverlayController({
  historyEntries,
  isOpen,
  showWhitespace,
  signatures,
  onClose,
  onRestoreDraftHistory,
}: DraftHistoryOverlayControllerProps) {
  return (
    <DraftHistoryOverlay
      historyEntries={historyEntries}
      isOpen={isOpen}
      showWhitespace={showWhitespace}
      signatures={signatures}
      onClose={onClose}
      onRestore={async (historyId) => {
        await onRestoreDraftHistory(historyId);
        onClose();
      }}
    />
  );
}
