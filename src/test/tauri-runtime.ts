import { clearMocks, mockIPC, mockWindows } from "@tauri-apps/api/mocks";

import type { Draft, DraftInput } from "../modules/drafts/model";
import type {
  LogEntrySnapshot,
  LoggingSettingsInput,
  LoggingSettingsSnapshot,
} from "../modules/settings/model";
import type { StartupNoticeSnapshot, StoreSnapshot } from "../shared/types/store";
import {
  createDraft,
  createLogEntry,
  createLoggingSettingsSnapshot,
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

export interface MockTauriRuntime {
  commandCalls: Array<{ cmd: string; payload?: unknown }>;
  getLoggingSettings: () => LoggingSettingsSnapshot;
  getRecentLogs: () => LogEntrySnapshot[];
  getSnapshot: () => StoreSnapshot;
}

interface MockTauriRuntimeOptions {
  loggingSettings?: LoggingSettingsSnapshot;
  recentLogs?: LogEntrySnapshot[];
  snapshot?: StoreSnapshot;
  startupNotice?: StartupNoticeSnapshot | null;
}

export function installMockTauriRuntime(options: MockTauriRuntimeOptions = {}): MockTauriRuntime {
  const snapshot = cloneData(options.snapshot ?? createStoreSnapshot());
  let loggingSettings = cloneData(options.loggingSettings ?? createLoggingSettingsSnapshot());
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

        return cloneData(snapshot);
      }
      case "save_logging_settings": {
        const input = (payload as { input: LoggingSettingsInput }).input;
        loggingSettings = {
          ...loggingSettings,
          ...input,
        };
        return cloneData(loggingSettings);
      }
      case "restore_draft_from_trash": {
        const id = (payload as { id: string }).id;
        const trashedIndex = snapshot.trash.drafts.findIndex((entry) => entry.draft.id === id);
        if (trashedIndex < 0) {
          throw new Error("指定した項目がゴミ箱に見つかりませんでした。");
        }

        const [restored] = snapshot.trash.drafts.splice(trashedIndex, 1);
        snapshot.drafts.unshift(restored.draft);
        return cloneData(snapshot);
      }
      default:
        throw new Error(`Unhandled mocked Tauri command: ${cmd}`);
    }
  });

  return {
    commandCalls,
    getLoggingSettings: () => cloneData(loggingSettings),
    getRecentLogs: () => cloneData(recentLogs),
    getSnapshot: () => cloneData(snapshot),
  };
}

export function resetMockTauriRuntime() {
  clearMocks();
}

export function createSeededRuntimeSnapshot(overrides: Partial<StoreSnapshot> = {}): StoreSnapshot {
  return createStoreSnapshot({
    trash: {
      drafts: [],
      templates: [],
      signatures: [],
    },
    ...overrides,
  });
}

export function createRuntimeDraft(overrides: Partial<Draft> = {}): Draft {
  return createDraft(overrides);
}
