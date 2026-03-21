import type { Signature } from "../../signatures/model";
import { type TrashedSignature, type TrashItem } from "../model";
import { TrashDetailPane } from "./panes/TrashDetailPane";
import { TrashListPane } from "./panes/TrashListPane";

interface TrashWorkspaceProps {
  items: TrashItem[];
  selectedItemKey: string | null;
  signatures: Signature[];
  trashedSignatures: TrashedSignature[];
  showWhitespace: boolean;
  onSelectItem: (key: string) => void;
  onRestoreItem: (item: TrashItem) => Promise<void>;
  onDeleteItemPermanently: (item: TrashItem) => Promise<void>;
  onEmptyTrash: () => Promise<void>;
}

export function TrashWorkspace({
  items,
  selectedItemKey,
  signatures,
  trashedSignatures,
  showWhitespace,
  onSelectItem,
  onRestoreItem,
  onDeleteItemPermanently,
  onEmptyTrash,
}: TrashWorkspaceProps) {
  const selectedItem = items.find((item) => item.key === selectedItemKey) ?? items[0] ?? null;

  return (
    <div className="grid h-full min-h-0 gap-3 xl:grid-cols-[260px_minmax(0,1fr)]">
      <TrashListPane
        items={items}
        selectedItemKey={selectedItem?.key ?? null}
        onEmptyTrash={onEmptyTrash}
        onSelectItem={onSelectItem}
      />

      <TrashDetailPane
        item={selectedItem}
        showWhitespace={showWhitespace}
        signatures={signatures}
        trashedSignatures={trashedSignatures}
        onDeleteItemPermanently={onDeleteItemPermanently}
        onRestoreItem={onRestoreItem}
      />
    </div>
  );
}
