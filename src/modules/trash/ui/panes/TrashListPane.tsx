import { formatStoredTime } from "../../../../shared/lib/time";
import { PaneHeader } from "../../../../shared/ui/PaneHeader";
import { Button, Panel, Pill } from "../../../../shared/ui/primitives";
import { useListContextMenu } from "../../../../shared/ui/use-list-context-menu";
import { type TrashItem, trashItemTypeLabel } from "../../model";

interface TrashListPaneProps {
  items: TrashItem[];
  selectedItemKey: string | null;
  onDeleteItemPermanently: (item: TrashItem) => Promise<void>;
  onSelectItem: (key: string) => void;
  onEmptyTrash: () => Promise<void>;
  onRestoreItem: (item: TrashItem) => Promise<void>;
}

export function TrashListPane({
  items,
  selectedItemKey,
  onDeleteItemPermanently,
  onSelectItem,
  onEmptyTrash,
  onRestoreItem,
}: TrashListPaneProps) {
  const { contextMenu, openItemContextMenu } = useListContextMenu<TrashItem>({
    createItems: (item) => [
      {
        id: "restore",
        label: "復元",
        onSelect: () => onRestoreItem(item),
      },
      {
        id: "delete",
        label: "完全削除",
        onSelect: () => onDeleteItemPermanently(item),
        tone: "danger",
      },
    ],
  });

  return (
    <Panel className="flex min-h-0 flex-col overflow-hidden">
      <PaneHeader
        action={
          <Button
            disabled={items.length === 0}
            size="sm"
            variant="ghost"
            onClick={() => void onEmptyTrash()}
          >
            ゴミ箱を空にする
          </Button>
        }
        description={`${items.length}件`}
        title="ゴミ箱"
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {items.length === 0 ? (
          <div className="rounded-[7px] border border-(--color-panel-border-strong) bg-(--color-field-bg) px-3 py-2.5 text-[13px] leading-6 text-(--color-text-muted)">
            ゴミ箱は空です。
          </div>
        ) : (
          <div className="space-y-1">
            {items.map((item) => {
              const active = item.key === selectedItemKey;

              return (
                <button
                  key={item.key}
                  className={`w-full rounded-[7px] border px-2.5 py-2 text-left transition-colors ${
                    active
                      ? "border-(--color-list-active-border) bg-(--color-list-active-bg)"
                      : "border-transparent hover:border-(--color-list-hover-border) hover:bg-(--color-list-hover-bg)"
                  }`}
                  type="button"
                  onClick={() => onSelectItem(item.key)}
                  onContextMenu={(event) => openItemContextMenu(event, item)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-[13px] font-medium text-(--color-text-strong)">
                      {item.label}
                    </div>
                    <Pill tone="neutral">{trashItemTypeLabel(item.kind)}</Pill>
                  </div>
                  <div className="mt-1.5 text-[10px] text-(--color-text-subtle)">
                    {formatStoredTime(item.deletedAt)}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
      {contextMenu}
    </Panel>
  );
}
