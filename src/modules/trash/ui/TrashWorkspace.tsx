import type { ReactNode } from "react";

import { formatStoredTime } from "../../../shared/lib/time";
import { visualizeWhitespace } from "../../../shared/lib/whitespace";
import { Button, Panel, Pill } from "../../../shared/ui/primitives";
import { toDraftInput } from "../../drafts/model";
import {
  renderDraftPreview,
  renderDraftSubject,
  renderTemplatePreview,
} from "../../renderer/render-draft";
import type { Signature } from "../../signatures/model";
import { toTemplateInput } from "../../templates/model";
import {
  findTrashSignature,
  type TrashedSignature,
  type TrashItem,
  trashItemTypeLabel,
} from "../model";

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
      <Panel className="flex min-h-0 flex-col overflow-hidden">
        <PaneHeader
          action={
            <Button
              disabled={items.length === 0}
              size="sm"
              variant="ghost"
              onClick={() => void onEmptyTrash()}
            >
              Empty trash
            </Button>
          }
          description={`${items.length} items`}
          title="Trash"
        />

        <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {items.length === 0 ? (
            <div className="rounded-[7px] border border-[var(--color-panel-border-strong)] bg-[var(--color-field-bg)] px-3 py-2.5 text-[13px] leading-6 text-[var(--color-text-muted)]">
              ゴミ箱は空です。
            </div>
          ) : (
            <div className="space-y-1">
              {items.map((item) => {
                const active = item.key === selectedItem?.key;

                return (
                  <button
                    key={item.key}
                    className={`w-full rounded-[7px] border px-2.5 py-2 text-left transition-colors ${
                      active
                        ? "border-[var(--color-list-active-border)] bg-[var(--color-list-active-bg)]"
                        : "border-transparent hover:border-[var(--color-list-hover-border)] hover:bg-[var(--color-list-hover-bg)]"
                    }`}
                    type="button"
                    onClick={() => onSelectItem(item.key)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate text-[13px] font-medium text-[var(--color-text-strong)]">
                        {item.label}
                      </div>
                      <Pill tone="neutral">{trashItemTypeLabel(item.kind)}</Pill>
                    </div>
                    <div className="mt-1.5 text-[10px] text-[var(--color-text-subtle)]">
                      {formatStoredTime(item.deletedAt)}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </Panel>

      <Panel className="flex min-h-0 flex-col overflow-hidden">
        <PaneHeader
          action={
            selectedItem ? (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void onRestoreItem(selectedItem)}
                >
                  Restore
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => void onDeleteItemPermanently(selectedItem)}
                >
                  Delete forever
                </Button>
              </div>
            ) : null
          }
          description={selectedItem ? "削除済みの項目を復元または完全削除できます。" : "削除済みの項目はありません。"}
          title="Details"
        />

        <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3.5">
          {selectedItem ? (
            <TrashItemDetail
              item={selectedItem}
              signatures={signatures}
              showWhitespace={showWhitespace}
              trashedSignatures={trashedSignatures}
            />
          ) : (
            <div className="rounded-[8px] border border-[var(--color-panel-border-strong)] bg-[var(--color-field-bg)] px-4 py-3 text-[13px] leading-6 text-[var(--color-text-muted)]">
              ゴミ箱に移動した下書き、テンプレート、署名がここに表示されます。
            </div>
          )}
        </div>
      </Panel>
    </div>
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
  const detail = buildDetail(item, signatures, trashedSignatures);
  const bodyText = showWhitespace ? visualizeWhitespace(detail.body) : detail.body;

  return (
    <div className="grid gap-3">
      <section className="rounded-[8px] border border-[var(--color-panel-border-strong)] bg-[var(--color-field-bg)] px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="neutral">{trashItemTypeLabel(item.kind)}</Pill>
          <div className="text-[11px] text-[var(--color-text-subtle)]">
            {formatStoredTime(item.deletedAt)} にゴミ箱へ移動
          </div>
        </div>
        <div className="mt-2.5 text-[15px] font-medium text-[var(--color-text-strong)]">
          {item.label}
        </div>
        {detail.meta ? (
          <div className="mt-1.5 text-[13px] text-[var(--color-text-muted)]">{detail.meta}</div>
        ) : null}
      </section>

      {detail.subject ? (
        <section className="rounded-[8px] border border-[var(--color-panel-border-strong)] bg-[var(--color-field-bg)] px-4 py-3">
          <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-subtle)]">
            Subject
          </div>
          <div className="mt-2.5 text-[13px] text-[var(--color-text-strong)]">
            {detail.subject}
          </div>
        </section>
      ) : null}

      <section className="rounded-[8px] border border-[var(--color-panel-border-strong)] bg-[var(--color-preview-bg)] px-4 py-3">
        <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-subtle)]">
          Body
        </div>
        <pre className="mail-preview-text mt-2.5 min-h-[380px] overflow-x-auto whitespace-pre-wrap text-[var(--color-preview-text)]">
          {bodyText || "表示できる本文はありません。"}
        </pre>
      </section>
    </div>
  );
}

function buildDetail(
  item: TrashItem,
  signatures: Signature[],
  trashedSignatures: TrashedSignature[],
): {
  subject: string;
  body: string;
  meta: string;
} {
  switch (item.kind) {
    case "draft": {
      const signature = findTrashSignature(
        signatures,
        trashedSignatures,
        item.draft.signatureId,
      );
      return {
        subject: renderDraftSubject(toDraftInput(item.draft)),
        body: renderDraftPreview(toDraftInput(item.draft), signature),
        meta: `${item.history.length} 件の履歴を保持`,
      };
    }
    case "template": {
      const signature = findTrashSignature(
        signatures,
        trashedSignatures,
        item.template.signatureId,
      );
      return {
        subject: item.template.subject,
        body: renderTemplatePreview(toTemplateInput(item.template), signature),
        meta: item.template.signatureId ? "署名参照あり" : "署名参照なし",
      };
    }
    case "signature":
      return {
        subject: "",
        body: item.signature.body,
        meta: item.signature.isDefault ? "削除時点では既定の署名" : "通常の署名",
      };
  }
}

function PaneHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 border-b border-[var(--color-panel-border-strong)] px-3.5">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-[var(--color-text-strong)]">{title}</div>
        <div className="truncate text-[11px] text-[var(--color-text-subtle)]">{description}</div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
