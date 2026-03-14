import { useEffect, useRef } from "react";

import type { LoggingSettingsSnapshot } from "../../modules/settings/model";
import { maildraftApi } from "../../shared/api/maildraft-api";
import type { StartupNoticeSnapshot, StoreSnapshot } from "../../shared/types/store";
import { toErrorMessage } from "./maildraft-app-helpers";

interface AppBootstrapOptions {
  hydrateLoggingSettings: (settings: LoggingSettingsSnapshot) => void;
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
    onNotice("ローカルデータと診断設定を読み込みました。");
    return;
  }

  if (startupNotice.tone === "warning") {
    onWarning(startupNotice.message);
    return;
  }

  onNotice(startupNotice.message);
}

export function useAppBootstrap({
  hydrateLoggingSettings,
  hydrateSnapshot,
  onClearError,
  onError,
  onLoadingChange,
  onNotice,
  onWarning,
}: AppBootstrapOptions) {
  const hydrateLoggingSettingsRef = useRef(hydrateLoggingSettings);
  const hydrateSnapshotRef = useRef(hydrateSnapshot);
  const clearErrorRef = useRef(onClearError);
  const errorRef = useRef(onError);
  const loadingChangeRef = useRef(onLoadingChange);
  const noticeRef = useRef(onNotice);
  const warningRef = useRef(onWarning);

  useEffect(() => {
    hydrateLoggingSettingsRef.current = hydrateLoggingSettings;
  }, [hydrateLoggingSettings]);

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
        const [nextSnapshot, nextLoggingSettings, startupNotice] = await Promise.all([
          maildraftApi.loadSnapshot(),
          maildraftApi.loadLoggingSettings(),
          maildraftApi.loadStartupNotice(),
        ]);
        hydrateSnapshotRef.current(nextSnapshot);
        hydrateLoggingSettingsRef.current(nextLoggingSettings);
        applyStartupNotice(startupNotice, noticeRef.current, warningRef.current);
      } catch (loadError) {
        errorRef.current(toErrorMessage(loadError));
      } finally {
        loadingChangeRef.current(false);
      }
    })();
  }, []);
}
