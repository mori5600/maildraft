import { formatStoredTime } from "../../../../shared/lib/time";
import { visualizeWhitespace } from "../../../../shared/lib/whitespace";
import { PaneHeader } from "../../../../shared/ui/PaneHeader";
import { Button, Panel, Pill } from "../../../../shared/ui/primitives";
import type { Signature } from "../../../signatures/model";
import {
  type TrashedSignature,
  type TrashItem,
  trashItemTypeLabel,
} from "../../model";
import { buildTrashDetail } from "../trash-detail";

interface TrashDetailPaneProps {
  item: TrashItem | null;
  signatures: Signature[];
  trashedSignatures: TrashedSignature[];
  showWhitespace: boolean;
  onRestoreItem: (item: TrashItem) => Promise<void>;
  onDeleteItemPermanently: (item: TrashItem) => Promise<void>;
}

export function TrashDetailPane({
  item,
  signatures,
  trashedSignatures,
  showWhitespace,
  onRestoreItem,
  onDeleteItemPermanently,
}: TrashDetailPaneProps) {
  return (
    <Panel className="flex min-h-0 flex-col overflow-hidden">
      <PaneHeader
        action={
          item ? (
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => void onRestoreItem(item)}>
                復元
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => void onDeleteItemPermanently(item)}
              >
                完全削除
              </Button>
            </div>
          ) : null
        }
        description={
          item
            ? "削除済みの項目を復元または完全削除できます。"
            : "削除済みの項目はありません。"
        }
        title="詳細"
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3.5">
        {item ? (
          <TrashItemDetail
            item={item}
            showWhitespace={showWhitespace}
            signatures={signatures}
            trashedSignatures={trashedSignatures}
          />
        ) : (
          <div className="rounded-lg border border-(--color-panel-border-strong) bg-(--color-field-bg) px-4 py-3 text-[13px] leading-6 text-(--color-text-muted)">
            ゴミ箱に移動した下書き、テンプレート、署名、メモがここに表示されます。
          </div>
        )}
      </div>
    </Panel>
  );
}

function TrashItemDetail({
  item,
  signatures,
  showWhitespace,
  trashedSignatures,
}: {
  item: TrashItem;
  signatures: Signature[];
  showWhitespace: boolean;
  trashedSignatures: TrashedSignature[];
}) {
  const detail = buildTrashDetail(item, signatures, trashedSignatures);
  const bodyText = showWhitespace ? visualizeWhitespace(detail.body) : detail.body;

  return (
    <div className="grid gap-3">
      <section className="rounded-lg border border-(--color-panel-border-strong) bg-(--color-field-bg) px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="neutral">{trashItemTypeLabel(item.kind)}</Pill>
          <div className="text-[11px] text-(--color-text-subtle)">
            {formatStoredTime(item.deletedAt)} にゴミ箱へ移動
          </div>
        </div>
        <div className="mt-2.5 text-[15px] font-medium text-(--color-text-strong)">
          {item.label}
        </div>
        {detail.meta ? (
          <div className="mt-1.5 text-[13px] text-(--color-text-muted)">{detail.meta}</div>
        ) : null}
      </section>

      {detail.subject ? (
        <section className="rounded-lg border border-(--color-panel-border-strong) bg-(--color-field-bg) px-4 py-3">
          <div className="text-[10px] tracking-[0.14em] text-(--color-text-subtle) uppercase">
            件名
          </div>
          <div className="mt-2.5 text-[13px] text-(--color-text-strong)">{detail.subject}</div>
        </section>
      ) : null}

      <section className="rounded-lg border border-(--color-panel-border-strong) bg-(--color-preview-bg) px-4 py-3">
        <div className="text-[10px] tracking-[0.14em] text-(--color-text-subtle) uppercase">
          本文
        </div>
        <pre className="mail-preview-text mt-2.5 min-h-95 overflow-x-auto whitespace-pre-wrap text-(--color-preview-text)">
          {bodyText || "表示できる本文はありません。"}
        </pre>
      </section>
    </div>
  );
}
