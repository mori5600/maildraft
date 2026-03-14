import { useEffect, useRef } from "react";

import type { LoggingSettingsSnapshot } from "../../modules/settings/model";
import { maildraftApi } from "../../shared/api/maildraft-api";
import type { StoreSnapshot } from "../../shared/types/store";
import { toErrorMessage } from "./maildraft-app-helpers";

interface AppBootstrapOptions {
  hydrateLoggingSettings: (settings: LoggingSettingsSnapshot) => void;
  hydrateSnapshot: (snapshot: StoreSnapshot) => void;
  onClearError: () => void;
  onError: (message: string) => void;
  onLoadingChange: (isLoading: boolean) => void;
  onNotice: (message: string) => void;
}

export function useAppBootstrap({
  hydrateLoggingSettings,
  hydrateSnapshot,
  onClearError,
  onError,
  onLoadingChange,
  onNotice,
}: AppBootstrapOptions) {
  const hydrateLoggingSettingsRef = useRef(hydrateLoggingSettings);
  const hydrateSnapshotRef = useRef(hydrateSnapshot);
  const clearErrorRef = useRef(onClearError);
  const errorRef = useRef(onError);
  const loadingChangeRef = useRef(onLoadingChange);
  const noticeRef = useRef(onNotice);

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
    void (async () => {
      try {
        loadingChangeRef.current(true);
        clearErrorRef.current();
        const nextSnapshot = await maildraftApi.loadSnapshot();
        const nextLoggingSettings = await maildraftApi.loadLoggingSettings();
        hydrateSnapshotRef.current(nextSnapshot);
        hydrateLoggingSettingsRef.current(nextLoggingSettings);
        noticeRef.current("ローカルデータと診断設定を読み込みました。");
      } catch (loadError) {
        errorRef.current(toErrorMessage(loadError));
      } finally {
        loadingChangeRef.current(false);
      }
    })();
  }, []);
}
