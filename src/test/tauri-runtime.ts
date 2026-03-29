import { clearMocks, mockIPC, mockWindows } from "@tauri-apps/api/mocks";

import type { ContentBlock, ContentBlockInput } from "../modules/blocks/model";
import type { Draft, DraftInput } from "../modules/drafts/model";
import type { VariablePresetInput } from "../modules/drafts/variable-presets";
import type { MemoInput } from "../modules/memo/model";
import type {
  EditorSettingsInput,
  EditorSettingsSnapshot,
  LogEntrySnapshot,
  LoggingSettingsInput,
  LoggingSettingsSnapshot,
  ProofreadingSettingsInput,
  ProofreadingSettingsSnapshot,
} from "../modules/settings/model";
import type { StartupNoticeSnapshot, StoreSnapshot } from "../shared/types/store";
import {
  createContentBlock,
  createDraft,
  createEditorSettingsSnapshot,
  createLogEntry,
  createLoggingSettingsSnapshot,
  createProofreadingSettingsSnapshot,
  createStoreSnapshot,
} from "./ui-fixtures";

function cloneData<T>(value: T): T {
  if (value === undefined) {
    return value;
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function toStoredDraft(input: DraftInput, previous: Draft | null): Draft {
  return {
    ...input,
    createdAt: previous?.createdAt ?? "1710000000000",
    updatedAt: String(Date.now()),
  };
}

function toStoredBlock(input: ContentBlockInput, previous: ContentBlock | null): ContentBlock {
  return {
    ...input,
    createdAt: previous?.createdAt ?? "1710000000000",
    updatedAt: String(Date.now()),
  };
}

export interface MockTauriRuntime {
  commandCalls: Array<{ cmd: string; payload?: unknown }>;
  getEditorSettings: () => EditorSettingsSnapshot;
  getLoggingSettings: () => LoggingSettingsSnapshot;
  getProofreadingSettings: () => ProofreadingSettingsSnapshot;
  getRecentLogs: () => LogEntrySnapshot[];
  getSnapshot: () => StoreSnapshot;
}

interface MockTauriRuntimeOptions {
  editorSettings?: EditorSettingsSnapshot;
  loggingSettings?: LoggingSettingsSnapshot;
  proofreadingSettings?: ProofreadingSettingsSnapshot;
  recentLogs?: LogEntrySnapshot[];
  snapshot?: StoreSnapshot;
  startupNotice?: StartupNoticeSnapshot | null;
}

type StoreSnapshotOverrides = Partial<Omit<StoreSnapshot, "trash">> & {
  trash?: Partial<StoreSnapshot["trash"]>;
};

export function installMockTauriRuntime(options: MockTauriRuntimeOptions = {}): MockTauriRuntime {
  const snapshot = cloneData(options.snapshot ?? createStoreSnapshot());
  let editorSettings = cloneData(options.editorSettings ?? createEditorSettingsSnapshot());
  let loggingSettings = cloneData(options.loggingSettings ?? createLoggingSettingsSnapshot());
  let proofreadingSettings = cloneData(
    options.proofreadingSettings ?? createProofreadingSettingsSnapshot(),
  );
  const recentLogs = cloneData(options.recentLogs ?? [createLogEntry()]);
  const startupNotice = cloneData(options.startupNotice ?? null);
  const commandCalls: Array<{ cmd: string; payload?: unknown }> = [];

  mockWindows("main");
  mockIPC((cmd, payload) => {
    commandCalls.push({
      cmd,
      payload: cloneData(payload),
    });

    switch (cmd) {
      case "load_snapshot":
        return cloneData(snapshot);
      case "load_startup_notice":
        return cloneData(startupNotice);
      case "load_logging_settings":
        return cloneData(loggingSettings);
      case "load_editor_settings":
        return cloneData(editorSettings);
      case "load_proofreading_settings":
        return cloneData(proofreadingSettings);
      case "load_recent_logs": {
        const limit =
          typeof (payload as { limit?: number } | undefined)?.limit === "number"
            ? (payload as { limit: number }).limit
            : recentLogs.length;
        return cloneData(recentLogs.slice(0, limit));
      }
      case "save_draft": {
        const input = (payload as { input: DraftInput }).input;
        const currentIndex = snapshot.drafts.findIndex((draft) => draft.id === input.id);
        const previous = currentIndex >= 0 ? snapshot.drafts[currentIndex] : null;
        const nextDraft = toStoredDraft(input, previous);

        if (currentIndex >= 0) {
          snapshot.drafts[currentIndex] = nextDraft;
        } else {
          snapshot.drafts.unshift(nextDraft);
        }

        return cloneData({
          draft: nextDraft,
          draftHistory: snapshot.draftHistory.filter((entry) => entry.draftId === nextDraft.id),
        });
      }
      case "save_block": {
        const input = (payload as { input: ContentBlockInput }).input;
        const currentIndex = snapshot.blocks.findIndex((block) => block.id === input.id);
        const previous = currentIndex >= 0 ? snapshot.blocks[currentIndex] : null;
        const nextBlock = toStoredBlock(input, previous);

        if (currentIndex >= 0) {
          snapshot.blocks[currentIndex] = nextBlock;
        } else {
          snapshot.blocks.unshift(nextBlock);
        }

        return cloneData({
          block: nextBlock,
        });
      }
      case "save_memo": {
        const input = (payload as { input: MemoInput }).input;
        const currentIndex = snapshot.memos.findIndex((memo) => memo.id === input.id);
        const previous = currentIndex >= 0 ? snapshot.memos[currentIndex] : null;
        const nextMemo = {
          id: input.id,
          title: input.title,
          isPinned: input.isPinned,
          body: input.body,
          tags: input.tags,
          createdAt: previous?.createdAt ?? String(Date.now()),
          updatedAt: String(Date.now()),
        };

        if (currentIndex >= 0) {
          snapshot.memos[currentIndex] = nextMemo;
        } else {
          snapshot.memos.unshift(nextMemo);
        }

        return cloneData(nextMemo);
      }
      case "delete_memo": {
        const id = (payload as { id: string }).id;
        const currentIndex = snapshot.memos.findIndex((memo) => memo.id === id);
        if (currentIndex < 0) {
          throw new Error("指定したメモが見つかりませんでした。");
        }

        const [deletedMemo] = snapshot.memos.splice(currentIndex, 1);
        const trashedMemos = snapshot.trash.memos ?? (snapshot.trash.memos = []);
        trashedMemos.unshift({
          memo: deletedMemo,
          deletedAt: String(Date.now()),
        });
        return cloneData({
          trashedMemo: trashedMemos[0],
        });
      }
      case "delete_block": {
        const id = (payload as { id: string }).id;
        const currentIndex = snapshot.blocks.findIndex((block) => block.id === id);
        if (currentIndex < 0) {
          throw new Error("指定した文面ブロックが見つかりませんでした。");
        }

        const [deletedBlock] = snapshot.blocks.splice(currentIndex, 1);
        snapshot.trash.blocks.unshift({
          block: deletedBlock,
          deletedAt: String(Date.now()),
        });
        return cloneData({
          trashedBlock: snapshot.trash.blocks[0],
        });
      }
      case "delete_draft": {
        const id = (payload as { id: string }).id;
        const currentIndex = snapshot.drafts.findIndex((draft) => draft.id === id);
        if (currentIndex < 0) {
          throw new Error("指定した下書きが見つかりませんでした。");
        }

        const [deletedDraft] = snapshot.drafts.splice(currentIndex, 1);
        const history = snapshot.draftHistory.filter((entry) => entry.draftId === id);
        snapshot.draftHistory = snapshot.draftHistory.filter((entry) => entry.draftId !== id);
        snapshot.trash.drafts.unshift({
          draft: deletedDraft,
          history,
          deletedAt: String(Date.now()),
        });
        return cloneData({
          trashedDraft: snapshot.trash.drafts[0],
        });
      }
      case "save_logging_settings": {
        const input = (payload as { input: LoggingSettingsInput }).input;
        loggingSettings = {
          ...loggingSettings,
          ...input,
        };
        return cloneData(loggingSettings);
      }
      case "save_editor_settings": {
        const input = (payload as { input: EditorSettingsInput }).input;
        editorSettings = {
          indentStyle: input.indentStyle === "tabs" ? "tabs" : "spaces",
          tabSize:
            Number.isInteger(input.tabSize) && input.tabSize >= 1 && input.tabSize <= 8
              ? input.tabSize
              : 2,
        };
        return cloneData(editorSettings);
      }
      case "save_proofreading_settings": {
        const input = (payload as { input: ProofreadingSettingsInput }).input;
        proofreadingSettings = {
          disabledRuleIds: [...new Set(input.disabledRuleIds.map((ruleId) => ruleId.trim()))]
            .filter((ruleId) => ruleId.length > 0)
            .sort((left, right) => left.localeCompare(right, "ja")),
        };
        return cloneData(proofreadingSettings);
      }
      case "restore_draft_from_trash": {
        const id = (payload as { id: string }).id;
        const trashedIndex = snapshot.trash.drafts.findIndex((entry) => entry.draft.id === id);
        if (trashedIndex < 0) {
          throw new Error("指定した項目がゴミ箱に見つかりませんでした。");
        }

        const [restored] = snapshot.trash.drafts.splice(trashedIndex, 1);
        snapshot.drafts.unshift(restored.draft);
        snapshot.draftHistory = snapshot.draftHistory
          .filter((entry) => entry.draftId !== id)
          .concat(restored.history);
        return cloneData({
          draft: restored.draft,
          draftHistory: restored.history,
        });
      }
      case "restore_memo_from_trash": {
        const id = (payload as { id: string }).id;
        const trashedMemos = snapshot.trash.memos ?? [];
        const trashedIndex = trashedMemos.findIndex((entry) => entry.memo.id === id);
        if (trashedIndex < 0) {
          throw new Error("指定した項目がゴミ箱に見つかりませんでした。");
        }

        const [restored] = trashedMemos.splice(trashedIndex, 1);
        snapshot.memos.unshift(restored.memo);
        return cloneData(restored.memo);
      }
      case "restore_block_from_trash": {
        const id = (payload as { id: string }).id;
        const trashedIndex = snapshot.trash.blocks.findIndex((entry) => entry.block.id === id);
        if (trashedIndex < 0) {
          throw new Error("指定した項目がゴミ箱に見つかりませんでした。");
        }

        const [restored] = snapshot.trash.blocks.splice(trashedIndex, 1);
        snapshot.blocks.unshift(restored.block);
        return cloneData({
          block: restored.block,
        });
      }
      case "permanently_delete_memo_from_trash": {
        const id = (payload as { id: string }).id;
        const trashedMemos = snapshot.trash.memos ?? [];
        const trashedIndex = trashedMemos.findIndex((entry) => entry.memo.id === id);
        if (trashedIndex < 0) {
          throw new Error("指定した項目がゴミ箱に見つかりませんでした。");
        }

        trashedMemos.splice(trashedIndex, 1);
        return cloneData({
          trash: snapshot.trash,
        });
      }
      case "permanently_delete_block_from_trash": {
        const id = (payload as { id: string }).id;
        const trashedIndex = snapshot.trash.blocks.findIndex((entry) => entry.block.id === id);
        if (trashedIndex < 0) {
          throw new Error("指定した項目がゴミ箱に見つかりませんでした。");
        }

        snapshot.trash.blocks.splice(trashedIndex, 1);
        return cloneData({
          trash: snapshot.trash,
        });
      }
      case "restore_draft_history": {
        const { draftId, historyId } = payload as { draftId: string; historyId: string };
        const currentIndex = snapshot.drafts.findIndex((draft) => draft.id === draftId);
        const historyEntry = snapshot.draftHistory.find(
          (entry) => entry.draftId === draftId && entry.id === historyId,
        );
        if (currentIndex < 0 || !historyEntry) {
          throw new Error("指定した履歴が見つかりませんでした。");
        }

        const currentDraft = snapshot.drafts[currentIndex];
        snapshot.draftHistory = [
          {
            id: crypto.randomUUID(),
            draftId: currentDraft.id,
            title: currentDraft.title,
            subject: currentDraft.subject,
            recipient: currentDraft.recipient,
            opening: currentDraft.opening,
            body: currentDraft.body,
            closing: currentDraft.closing,
            templateId: currentDraft.templateId,
            signatureId: currentDraft.signatureId,
            variableValues: currentDraft.variableValues,
            tags: currentDraft.tags,
            recordedAt: String(Date.now()),
          },
          ...snapshot.draftHistory.filter((entry) => entry.draftId !== draftId),
          ...snapshot.draftHistory.filter((entry) => entry.draftId === draftId),
        ].sort((left, right) => Number(right.recordedAt) - Number(left.recordedAt));
        snapshot.drafts[currentIndex] = {
          ...currentDraft,
          title: historyEntry.title,
          subject: historyEntry.subject,
          recipient: historyEntry.recipient,
          opening: historyEntry.opening,
          body: historyEntry.body,
          closing: historyEntry.closing,
          templateId: historyEntry.templateId,
          signatureId: historyEntry.signatureId,
          variableValues: historyEntry.variableValues,
          tags: historyEntry.tags,
          updatedAt: String(Date.now()),
        };
        return cloneData({
          draft: snapshot.drafts[currentIndex],
          draftHistory: snapshot.draftHistory.filter((entry) => entry.draftId === draftId),
        });
      }
      case "save_variable_preset": {
        const input = (payload as { input: VariablePresetInput }).input;
        const currentIndex = snapshot.variablePresets.findIndex((preset) => preset.id === input.id);
        const previous = currentIndex >= 0 ? snapshot.variablePresets[currentIndex] : null;
        const nextPreset = {
          id: input.id,
          name: input.name,
          values: input.values,
          tags: input.tags,
          createdAt: previous?.createdAt ?? String(Date.now()),
          updatedAt: String(Date.now()),
          lastUsedAt: previous?.lastUsedAt ?? null,
        };

        if (currentIndex >= 0) {
          snapshot.variablePresets[currentIndex] = nextPreset;
        } else {
          snapshot.variablePresets.unshift(nextPreset);
        }

        return cloneData({
          variablePresets: snapshot.variablePresets,
        });
      }
      case "record_variable_preset_usage": {
        const id = (payload as { id: string }).id;
        const currentIndex = snapshot.variablePresets.findIndex((preset) => preset.id === id);
        if (currentIndex < 0) {
          throw new Error("指定した変数値セットが見つかりませんでした。");
        }

        snapshot.variablePresets[currentIndex] = {
          ...snapshot.variablePresets[currentIndex],
          updatedAt: String(Date.now()),
          lastUsedAt: String(Date.now()),
        };
        snapshot.variablePresets.sort(
          (left, right) => Number(right.lastUsedAt ?? 0) - Number(left.lastUsedAt ?? 0),
        );

        return cloneData({
          variablePresets: snapshot.variablePresets,
        });
      }
      case "delete_variable_preset": {
        const id = (payload as { id: string }).id;
        const currentIndex = snapshot.variablePresets.findIndex((preset) => preset.id === id);
        if (currentIndex < 0) {
          throw new Error("指定した変数値セットが見つかりませんでした。");
        }

        snapshot.variablePresets.splice(currentIndex, 1);
        return cloneData({
          variablePresets: snapshot.variablePresets,
        });
      }
      default:
        throw new Error(`Unhandled mocked Tauri command: ${cmd}`);
    }
  });

  return {
    commandCalls,
    getEditorSettings: () => cloneData(editorSettings),
    getLoggingSettings: () => cloneData(loggingSettings),
    getProofreadingSettings: () => cloneData(proofreadingSettings),
    getRecentLogs: () => cloneData(recentLogs),
    getSnapshot: () => cloneData(snapshot),
  };
}

export function resetMockTauriRuntime() {
  clearMocks();
}

export function createSeededRuntimeSnapshot(overrides: StoreSnapshotOverrides = {}): StoreSnapshot {
  const baseSnapshot = createStoreSnapshot({
    blocks: [createContentBlock()],
    trash: {
      drafts: [],
      templates: [],
      signatures: [],
      memos: [],
      blocks: [],
    },
  });

  return {
    ...baseSnapshot,
    ...overrides,
    trash: {
      ...baseSnapshot.trash,
      ...overrides.trash,
    },
  };
}

export function createRuntimeDraft(overrides: Partial<Draft> = {}): Draft {
  return createDraft(overrides);
}
