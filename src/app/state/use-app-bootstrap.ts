import { useEffect, useRef } from "react";

import type {
  EditorSettingsSnapshot,
  LoggingSettingsSnapshot,
  ProofreadingSettingsSnapshot,
} from "../../modules/settings/model";
import { maildraftApi } from "../../shared/api/maildraft-api";
import type { StartupNoticeSnapshot, StoreSnapshot } from "../../shared/types/store";
import { toErrorMessage } from "./maildraft-app-helpers";

interface AppBootstrapOptions {
  hydrateEditorSettings: (settings: EditorSettingsSnapshot) => void;
  hydrateLoggingSettings: (settings: LoggingSettingsSnapshot) => void;
  hydrateProofreadingSettings: (settings: ProofreadingSettingsSnapshot) => void;
  hydrateSnapshot: (snapshot: StoreSnapshot) => void;
  onClearError: () => void;
  onError: (message: string) => void;
  onLoadingChange: (isLoading: boolean) => void;
  onNotice: (message: string) => void;
  onWarning: (message: string) => void;
}

function applyStartupNotice(
  startupNotice: StartupNoticeSnapshot | null,
  onNotice: (message: string) => void,
  onWarning: (message: string) => void,
) {
  if (!startupNotice) {
    onNotice("ローカルデータと設定を読み込みました。");
    return;
  }

  if (startupNotice.tone === "warning") {
    onWarning(startupNotice.message);
    return;
  }

  onNotice(startupNotice.message);
}

/**
 * Loads the initial snapshot, logging settings, and startup notice once at app startup.
 *
 * @remarks
 * Handler refs keep the bootstrap effect single-shot while still calling the latest callbacks after rerenders.
 */
export function useAppBootstrap({
  hydrateEditorSettings,
  hydrateLoggingSettings,
  hydrateProofreadingSettings,
  hydrateSnapshot,
  onClearError,
  onError,
  onLoadingChange,
  onNotice,
  onWarning,
}: AppBootstrapOptions) {
  const hydrateEditorSettingsRef = useRef(hydrateEditorSettings);
  const hydrateLoggingSettingsRef = useRef(hydrateLoggingSettings);
  const hydrateProofreadingSettingsRef = useRef(hydrateProofreadingSettings);
  const hydrateSnapshotRef = useRef(hydrateSnapshot);
  const clearErrorRef = useRef(onClearError);
  const errorRef = useRef(onError);
  const loadingChangeRef = useRef(onLoadingChange);
  const noticeRef = useRef(onNotice);
  const warningRef = useRef(onWarning);

  useEffect(() => {
    hydrateEditorSettingsRef.current = hydrateEditorSettings;
  }, [hydrateEditorSettings]);

  useEffect(() => {
    hydrateLoggingSettingsRef.current = hydrateLoggingSettings;
  }, [hydrateLoggingSettings]);

  useEffect(() => {
    hydrateProofreadingSettingsRef.current = hydrateProofreadingSettings;
  }, [hydrateProofreadingSettings]);

  useEffect(() => {
    hydrateSnapshotRef.current = hydrateSnapshot;
  }, [hydrateSnapshot]);

  useEffect(() => {
    clearErrorRef.current = onClearError;
  }, [onClearError]);

  useEffect(() => {
    errorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    loadingChangeRef.current = onLoadingChange;
  }, [onLoadingChange]);

  useEffect(() => {
    noticeRef.current = onNotice;
  }, [onNotice]);

  useEffect(() => {
    warningRef.current = onWarning;
  }, [onWarning]);

  useEffect(() => {
    void (async () => {
      try {
        loadingChangeRef.current(true);
        clearErrorRef.current();
        const [
          nextSnapshot,
          nextLoggingSettings,
          nextEditorSettings,
          nextProofreadingSettings,
          startupNotice,
        ] = await Promise.all([
          maildraftApi.loadSnapshot(),
          maildraftApi.loadLoggingSettings(),
          maildraftApi.loadEditorSettings(),
          maildraftApi.loadProofreadingSettings(),
          maildraftApi.loadStartupNotice(),
        ]);
        hydrateSnapshotRef.current(nextSnapshot);
        hydrateLoggingSettingsRef.current(nextLoggingSettings);
        hydrateEditorSettingsRef.current(nextEditorSettings);
        hydrateProofreadingSettingsRef.current(nextProofreadingSettings);
        applyStartupNotice(startupNotice, noticeRef.current, warningRef.current);
      } catch (loadError) {
        errorRef.current(toErrorMessage(loadError));
      } finally {
        loadingChangeRef.current(false);
      }
    })();
  }, []);
}
