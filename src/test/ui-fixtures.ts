import type { Draft, DraftHistoryEntry, DraftInput } from "../modules/drafts/model";
import type { VariablePreset } from "../modules/drafts/variable-presets";
import type { Memo, MemoInput } from "../modules/memo/model";
import {
  createDefaultLoggingSettingsSnapshot,
  type LogEntrySnapshot,
  type LoggingSettingsInput,
  type LoggingSettingsSnapshot,
} from "../modules/settings/model";
import type { Signature, SignatureInput } from "../modules/signatures/model";
import type { Template, TemplateInput } from "../modules/templates/model";
import type {
  TrashedMemo,
  TrashedSignature,
  TrashItem,
  TrashSnapshot,
} from "../modules/trash/model";
import type { StoreSnapshot } from "../shared/types/store";

const DEFAULT_TIME = "1710000000000";

export function createSignature(overrides: Partial<Signature> = {}): Signature {
  return {
    id: "signature-1",
    name: "営業署名",
    isPinned: false,
    body: "株式会社△△\n田中 太郎",
    isDefault: false,
    createdAt: DEFAULT_TIME,
    updatedAt: DEFAULT_TIME,
    ...overrides,
  };
}

export function createSignatureInput(overrides: Partial<SignatureInput> = {}): SignatureInput {
  return {
    id: "signature-input-1",
    name: "営業署名",
    isPinned: false,
    body: "株式会社△△\n田中 太郎",
    isDefault: false,
    ...overrides,
  };
}

export function createTemplate(overrides: Partial<Template> = {}): Template {
  return {
    id: "template-1",
    name: "打ち合わせお礼",
    isPinned: false,
    subject: "先日の打ち合わせのお礼",
    recipient: "株式会社〇〇\n佐藤 様",
    opening: "いつもお世話になっております。",
    body: "本日はありがとうございました。",
    closing: "引き続きよろしくお願いいたします。",
    signatureId: "signature-1",
    createdAt: DEFAULT_TIME,
    updatedAt: DEFAULT_TIME,
    ...overrides,
  };
}

export function createTemplateInput(overrides: Partial<TemplateInput> = {}): TemplateInput {
  return {
    id: "template-input-1",
    name: "打ち合わせお礼",
    isPinned: false,
    subject: "先日の打ち合わせのお礼",
    recipient: "株式会社〇〇\n佐藤 様",
    opening: "いつもお世話になっております。",
    body: "本日はありがとうございました。",
    closing: "引き続きよろしくお願いいたします。",
    signatureId: "signature-1",
    ...overrides,
  };
}

export function createDraft(overrides: Partial<Draft> = {}): Draft {
  return {
    id: "draft-1",
    title: "4/12 打ち合わせお礼",
    isPinned: false,
    subject: "先日の打ち合わせのお礼",
    recipient: "株式会社〇〇\n佐藤 様",
    opening: "いつもお世話になっております。",
    body: "本日はありがとうございました。{{相手名}}",
    closing: "引き続きよろしくお願いいたします。",
    templateId: "template-1",
    signatureId: "signature-1",
    variableValues: { 相手名: "佐藤様" },
    createdAt: DEFAULT_TIME,
    updatedAt: DEFAULT_TIME,
    ...overrides,
  };
}

export function createDraftInput(overrides: Partial<DraftInput> = {}): DraftInput {
  return {
    id: "draft-input-1",
    title: "4/12 打ち合わせお礼",
    isPinned: false,
    subject: "先日の打ち合わせのお礼",
    recipient: "株式会社〇〇\n佐藤 様",
    opening: "いつもお世話になっております。",
    body: "本日はありがとうございました。{{相手名}}",
    closing: "引き続きよろしくお願いいたします。",
    templateId: "template-1",
    signatureId: "signature-1",
    variableValues: { 相手名: "佐藤様" },
    ...overrides,
  };
}

export function createDraftHistoryEntry(
  overrides: Partial<DraftHistoryEntry> = {},
): DraftHistoryEntry {
  return {
    id: "history-1",
    draftId: "draft-1",
    title: "4/12 打ち合わせお礼",
    subject: "先日の打ち合わせのお礼",
    recipient: "株式会社〇〇\n佐藤 様",
    opening: "いつもお世話になっております。",
    body: "本日はありがとうございました。",
    closing: "引き続きよろしくお願いいたします。",
    templateId: "template-1",
    signatureId: "signature-1",
    variableValues: { 相手名: "佐藤様" },
    recordedAt: DEFAULT_TIME,
    ...overrides,
  };
}

export function createVariablePreset(overrides: Partial<VariablePreset> = {}): VariablePreset {
  return {
    id: "preset-1",
    name: "A社向け",
    values: { 相手名: "佐藤様" },
    createdAt: DEFAULT_TIME,
    updatedAt: DEFAULT_TIME,
    ...overrides,
  };
}

export function createLoggingSettingsSnapshot(
  overrides: Partial<LoggingSettingsSnapshot> = {},
): LoggingSettingsSnapshot {
  return {
    ...createDefaultLoggingSettingsSnapshot(),
    directoryPath: "/tmp/maildraft/logs",
    totalBytes: 2048,
    fileCount: 2,
    maxFileSizeBytes: 1024 * 1024,
    maxRotatedFiles: 5,
    ...overrides,
  };
}

export function createLoggingSettingsInput(
  overrides: Partial<LoggingSettingsInput> = {},
): LoggingSettingsInput {
  return {
    mode: "errors_only",
    retentionDays: 14,
    ...overrides,
  };
}

export function createMemo(overrides: Partial<Memo> = {}): Memo {
  return {
    id: "memo-1",
    title: "打ち合わせメモ",
    body: "確認事項を整理する",
    createdAt: DEFAULT_TIME,
    updatedAt: DEFAULT_TIME,
    ...overrides,
  };
}

export function createMemoInput(overrides: Partial<MemoInput> = {}): MemoInput {
  return {
    id: "memo-input-1",
    title: "打ち合わせメモ",
    body: "確認事項を整理する",
    ...overrides,
  };
}

export function createLogEntry(overrides: Partial<LogEntrySnapshot> = {}): LogEntrySnapshot {
  return {
    timestampMs: 1710000000000,
    level: "info",
    eventName: "save_draft",
    module: "drafts",
    result: "success",
    sessionId: "session-1",
    durationMs: 12,
    errorCode: null,
    safeContext: { count: 1 },
    ...overrides,
  };
}

export function createTrashSnapshot(overrides: Partial<TrashSnapshot> = {}): TrashSnapshot {
  return {
    drafts: [
      {
        draft: createDraft(),
        history: [createDraftHistoryEntry()],
        deletedAt: DEFAULT_TIME,
      },
    ],
    templates: [
      {
        template: createTemplate(),
        deletedAt: DEFAULT_TIME,
      },
    ],
    signatures: [
      {
        signature: createSignature(),
        deletedAt: DEFAULT_TIME,
      },
    ],
    memos: [],
    ...overrides,
  };
}

export function createTrashedMemo(overrides: Partial<TrashedMemo> = {}): TrashedMemo {
  return {
    memo: createMemo(),
    deletedAt: DEFAULT_TIME,
    ...overrides,
  };
}

export function createTrashedSignature(
  overrides: Partial<TrashedSignature> = {},
): TrashedSignature {
  return {
    signature: createSignature(),
    deletedAt: DEFAULT_TIME,
    ...overrides,
  };
}

export function createTrashDraftItem(): Extract<TrashItem, { kind: "draft" }> {
  const draft = createDraft();
  return {
    kind: "draft",
    key: `draft:${draft.id}`,
    deletedAt: DEFAULT_TIME,
    label: draft.title,
    draft,
    history: [createDraftHistoryEntry()],
  };
}

export function createTrashTemplateItem(): Extract<TrashItem, { kind: "template" }> {
  const template = createTemplate();
  return {
    kind: "template",
    key: `template:${template.id}`,
    deletedAt: DEFAULT_TIME,
    label: template.name,
    template,
  };
}

export function createTrashSignatureItem(): Extract<TrashItem, { kind: "signature" }> {
  const signature = createSignature();
  return {
    kind: "signature",
    key: `signature:${signature.id}`,
    deletedAt: DEFAULT_TIME,
    label: signature.name,
    signature,
  };
}

export function createTrashMemoItem(): Extract<TrashItem, { kind: "memo" }> {
  const memo = createMemo();
  return {
    kind: "memo",
    key: `memo:${memo.id}`,
    deletedAt: DEFAULT_TIME,
    label: memo.title,
    memo,
  };
}

export function createStoreSnapshot(overrides: Partial<StoreSnapshot> = {}): StoreSnapshot {
  const baseSnapshot: StoreSnapshot = {
    drafts: [createDraft()],
    draftHistory: [createDraftHistoryEntry()],
    variablePresets: [createVariablePreset()],
    templates: [createTemplate()],
    signatures: [createSignature()],
    memos: [createMemo()],
    trash: createTrashSnapshot(),
  };

  return {
    ...baseSnapshot,
    ...overrides,
    trash: {
      ...baseSnapshot.trash,
      ...overrides.trash,
    },
  };
}
