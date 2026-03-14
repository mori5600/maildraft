import { type ReactNode, useState } from "react";

import { TEMPLATE_SORT_OPTIONS, type TemplateSortOption } from "../../../shared/lib/list-sort";
import { truncate } from "../../../shared/lib/text";
import { formatStoredTime } from "../../../shared/lib/time";
import { visualizeWhitespace } from "../../../shared/lib/whitespace";
import { PreviewOverlay } from "../../../shared/ui/PreviewOverlay";
import { Button, Field, Input, Panel, Select, Textarea } from "../../../shared/ui/primitives";
import type { Signature } from "../../signatures/model";
import type { Template, TemplateInput } from "../model";

interface TemplateWorkspaceProps {
  templates: Template[];
  totalTemplateCount: number;
  signatures: Signature[];
  selectedTemplateId: string | null;
  templateForm: TemplateInput;
  previewText: string;
  showWhitespace: boolean;
  searchQuery: string;
  sort: TemplateSortOption;
  canDuplicate: boolean;
  onSelectTemplate: (id: string) => void;
  onCreateTemplate: () => void;
  onChangeSearchQuery: (value: string) => void;
  onChangeSort: (value: TemplateSortOption) => void;
  onChangeTemplate: <K extends keyof TemplateInput>(field: K, value: TemplateInput[K]) => void;
  onSaveTemplate: () => Promise<void>;
  onDeleteTemplate: () => Promise<void>;
  onDuplicateTemplate: () => Promise<void>;
  onStartDraftFromTemplate: () => void;
  onTogglePinned: () => void;
}

export function TemplateWorkspace({
  templates,
  totalTemplateCount,
  signatures,
  selectedTemplateId,
  templateForm,
  previewText,
  showWhitespace,
  searchQuery,
  sort,
  canDuplicate,
  onSelectTemplate,
  onCreateTemplate,
  onChangeSearchQuery,
  onChangeSort,
  onChangeTemplate,
  onSaveTemplate,
  onDeleteTemplate,
  onDuplicateTemplate,
  onStartDraftFromTemplate,
  onTogglePinned,
}: TemplateWorkspaceProps) {
  const [isWidePreviewOpen, setIsWidePreviewOpen] = useState(false);
  const hasMissingSignature = Boolean(
    templateForm.signatureId &&
    !signatures.some((signature) => signature.id === templateForm.signatureId),
  );
  const canExpandPreview = previewText.trim().length > 0 || templateForm.subject.trim().length > 0;
  const previewBodyText =
    (showWhitespace ? visualizeWhitespace(previewText) : previewText) ||
    "テンプレートのプレビューがここに表示されます。";
  const templateCountLabel = searchQuery.trim()
    ? `${templates.length} / ${totalTemplateCount}件`
    : `${totalTemplateCount}件`;

  return (
    <>
      <div className="grid h-full min-h-0 gap-3 xl:grid-cols-[248px_minmax(0,1fr)_300px]">
        <Panel className="flex min-h-0 flex-col overflow-hidden">
          <PaneHeader
            action={
              <Button size="sm" title="Ctrl/Cmd+N" variant="ghost" onClick={onCreateTemplate}>
                新規
              </Button>
            }
            description={templateCountLabel}
            title="テンプレート一覧"
          />
          <div className="border-b border-(--color-panel-border-strong) px-1.5 py-1.5">
            <div className="grid gap-2 rounded-[7px] border border-(--color-panel-border-strong) bg-(--color-field-bg) px-2.5 py-2">
              <div className="grid gap-1.5">
                <div className="text-[10px] tracking-[0.14em] text-(--color-text-subtle) uppercase">
                  検索
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    className="flex-1"
                    data-maildraft-search="templates"
                    placeholder="テンプレートを検索"
                    title="Ctrl/Cmd+K"
                    type="search"
                    value={searchQuery}
                    onChange={(event) => onChangeSearchQuery(event.currentTarget.value)}
                  />
                  <Button
                    disabled={!searchQuery}
                    size="sm"
                    variant="ghost"
                    onClick={() => onChangeSearchQuery("")}
                  >
                    消去
                  </Button>
                </div>
              </div>

              <div className="grid gap-1.5">
                <div className="text-[10px] tracking-[0.14em] text-(--color-text-subtle) uppercase">
                  並び順
                </div>
                <Select
                  value={sort}
                  onChange={(event) =>
                    onChangeSort(event.currentTarget.value as TemplateSortOption)
                  }
                >
                  {TEMPLATE_SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {templates.length === 0 ? (
              <div className="rounded-[7px] border border-(--color-panel-border-strong) bg-(--color-field-bg) px-3 py-2.5 text-[13px] leading-6 text-(--color-text-muted)">
                {searchQuery.trim()
                  ? "検索に一致するテンプレートはありません。"
                  : "まだテンプレートはありません。"}
              </div>
            ) : (
              <div className="space-y-1">
                {templates.map((template) => {
                  const isActive = template.id === selectedTemplateId;

                  return (
                    <button
                      key={template.id}
                      className={`w-full rounded-[7px] border px-2.5 py-2 text-left transition-colors ${
                        isActive
                          ? "border-(--color-list-active-border) bg-(--color-list-active-bg)"
                          : "border-transparent hover:border-(--color-list-hover-border) hover:bg-(--color-list-hover-bg)"
                      }`}
                      onClick={() => onSelectTemplate(template.id)}
                      type="button"
                    >
                      <div className="flex items-center gap-2">
                        <div className="truncate text-[13px] font-medium text-(--color-text-strong)">
                          {template.name}
                        </div>
                        {template.isPinned ? (
                          <span className="rounded-md border border-(--color-panel-border-strong) bg-(--color-field-bg) px-1.5 py-0.5 text-[9px] tracking-[0.14em] text-(--color-text-subtle) uppercase">
                            固定
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 truncate text-[11px] text-(--color-text-muted)">
                        {truncate(template.subject || "件名未設定")}
                      </div>
                      <div className="mt-1.5 text-[10px] text-(--color-text-subtle)">
                        {formatStoredTime(template.updatedAt)}
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
              <div className="flex gap-2">
                <Button size="sm" title="Ctrl/Cmd+Shift+P" variant="ghost" onClick={onTogglePinned}>
                  {templateForm.isPinned ? "固定解除" : "固定"}
                </Button>
                <Button
                  disabled={!canDuplicate}
                  size="sm"
                  variant="ghost"
                  onClick={() => void onDuplicateTemplate()}
                >
                  複製
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void onDeleteTemplate()}>
                  {selectedTemplateId ? "ゴミ箱へ移動" : "リセット"}
                </Button>
                <Button
                  size="sm"
                  title="Ctrl/Cmd+S"
                  variant="primary"
                  onClick={() => void onSaveTemplate()}
                >
                  保存
                </Button>
              </div>
            }
            description={`${templateForm.isPinned ? "固定・" : ""}${templateForm.name}`}
            title="テンプレート編集"
          />

          <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3.5">
            <div className="grid gap-3">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="名前">
                  <Input
                    showWhitespace={showWhitespace}
                    value={templateForm.name}
                    onChange={(event) => onChangeTemplate("name", event.currentTarget.value)}
                  />
                </Field>
                <Field label="件名">
                  <Input
                    showWhitespace={showWhitespace}
                    value={templateForm.subject}
                    onChange={(event) => onChangeTemplate("subject", event.currentTarget.value)}
                  />
                </Field>
              </div>

              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_200px]">
                <Field label="署名">
                  <Select
                    value={templateForm.signatureId ?? ""}
                    onChange={(event) =>
                      onChangeTemplate("signatureId", event.currentTarget.value || null)
                    }
                  >
                    <option value="">署名なし</option>
                    {hasMissingSignature ? (
                      <option value={templateForm.signatureId ?? ""}>ゴミ箱の署名</option>
                    ) : null}
                    {signatures.map((signature) => (
                      <option key={signature.id} value={signature.id}>
                        {signature.name}
                        {signature.isDefault ? " (既定)" : ""}
                      </option>
                    ))}
                  </Select>
                </Field>

                <div className="rounded-[7px] border border-(--color-panel-border-strong) bg-(--color-field-bg) px-3 py-2.5 text-[13px] leading-6 text-(--color-text-muted)">
                  {"`{{相手名}}` や `{{日付}}` をそのまま保存できます。"}
                </div>
              </div>

              <Field label="宛名メモ" hint="社名や担当者など">
                <Textarea
                  className="min-h-24"
                  placeholder={"株式会社〇〇\n営業部\n佐藤 様"}
                  rows={3}
                  showWhitespace={showWhitespace}
                  textClassName="mail-compose-text"
                  value={templateForm.recipient}
                  onChange={(event) => onChangeTemplate("recipient", event.currentTarget.value)}
                />
              </Field>

              <Field label="書き出し">
                <Textarea
                  className="min-h-33"
                  rows={5}
                  showWhitespace={showWhitespace}
                  textClassName="mail-compose-text"
                  value={templateForm.opening}
                  onChange={(event) => onChangeTemplate("opening", event.currentTarget.value)}
                />
              </Field>

              <Field label="本文">
                <Textarea
                  className="min-h-70"
                  rows={12}
                  showWhitespace={showWhitespace}
                  textClassName="mail-compose-text"
                  value={templateForm.body}
                  onChange={(event) => onChangeTemplate("body", event.currentTarget.value)}
                />
              </Field>

              <Field label="結び">
                <Textarea
                  className="min-h-33"
                  rows={5}
                  showWhitespace={showWhitespace}
                  textClassName="mail-compose-text"
                  value={templateForm.closing}
                  onChange={(event) => onChangeTemplate("closing", event.currentTarget.value)}
                />
              </Field>
            </div>
          </div>
        </Panel>

        <Panel className="flex min-h-0 flex-col overflow-hidden">
          <PaneHeader
            action={
              <div className="flex gap-2">
                <Button
                  disabled={!canExpandPreview}
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsWidePreviewOpen(true)}
                >
                  拡大
                </Button>
                <Button size="sm" variant="ghost" onClick={onStartDraftFromTemplate}>
                  下書きを作成
                </Button>
              </div>
            }
            description="仕上がり表示"
            title="プレビュー"
          />

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="border-b border-(--color-panel-border-strong) px-3.5 py-3">
              <div className="text-[10px] tracking-[0.14em] text-(--color-text-subtle) uppercase">
                件名
              </div>
              <div className="mt-1.5 text-[13px] text-(--color-text-strong)">
                {templateForm.subject || "件名未設定"}
              </div>
            </div>
            <div className="px-3.5 py-3">
              <div className="text-[10px] tracking-[0.14em] text-(--color-text-subtle) uppercase">
                本文
              </div>
              <pre className="mail-preview-text mt-2 overflow-x-auto rounded-[7px] border border-(--color-panel-border-strong) bg-(--color-preview-bg) px-3.5 py-3 whitespace-pre-wrap text-(--color-preview-text)">
                {previewBodyText}
              </pre>
            </div>
          </div>
        </Panel>
      </div>

      <PreviewOverlay
        action={
          <Button size="sm" variant="ghost" onClick={onStartDraftFromTemplate}>
            下書きを作成
          </Button>
        }
        description="仕上がり表示"
        isOpen={isWidePreviewOpen}
        title="テンプレートプレビュー"
        onClose={() => setIsWidePreviewOpen(false)}
      >
        <div className="grid gap-3 xl:grid-cols-[260px_minmax(0,1fr)]">
          <section className="rounded-lg border border-(--color-panel-border-strong) bg-(--color-field-bg) p-4">
            <div className="text-[10px] tracking-[0.14em] text-(--color-text-subtle) uppercase">
              件名
            </div>
            <div className="mt-2.5 text-[13px] text-(--color-text-strong)">
              {templateForm.subject || "件名未設定"}
            </div>
          </section>

          <section className="rounded-lg border border-(--color-panel-border-strong) bg-(--color-preview-bg) p-4">
            <div className="text-[10px] tracking-[0.14em] text-(--color-text-subtle) uppercase">
              本文
            </div>
            <pre className="mail-preview-text mt-2.5 min-h-120 overflow-x-auto whitespace-pre-wrap text-(--color-preview-text)">
              {previewBodyText}
            </pre>
          </section>
        </div>
      </PreviewOverlay>
    </>
  );
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
    <div className="flex min-h-11 items-center justify-between gap-3 border-b border-(--color-panel-border-strong) px-3.5">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-(--color-text-strong)">{title}</div>
        <div className="truncate text-[11px] text-(--color-text-subtle)">{description}</div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
