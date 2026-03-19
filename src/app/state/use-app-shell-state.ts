import { useEffect, useState } from "react";

import {
  applyTheme,
  type AppTheme,
  persistTheme,
  resolveInitialTheme,
} from "../../shared/lib/theme";
import type { StoreSnapshot, WorkspaceView } from "../../shared/types/store";

/**
 * Owns app-level shell state shared across workspaces.
 *
 * @remarks
 * The shell keeps the current snapshot, active workspace, theme, loading state, and user-facing
 * status messages together. Error and warning messages are mutually exclusive so the shell never
 * shows both states at once.
 */
export function useAppShellState(initialSnapshot: StoreSnapshot) {
  const [snapshot, setSnapshot] = useState<StoreSnapshot>(initialSnapshot);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setErrorState] = useState<string | null>(null);
  const [warning, setWarningState] = useState<string | null>(null);
  const [notice, setNoticeState] = useState("ローカル保存の準備をしています。");
  const [view, setViewState] = useState<WorkspaceView>("drafts");
  const [theme, setTheme] = useState<AppTheme>(() => resolveInitialTheme());
  const [showWhitespace, setShowWhitespace] = useState(false);
  const [selectedTrashItemKey, setSelectedTrashItemKey] = useState<string | null>(null);

  useEffect(() => {
    applyTheme(theme);
    persistTheme(theme);
  }, [theme]);

  function clearError() {
    setErrorState(null);
    setWarningState(null);
  }

  function setError(message: string) {
    setErrorState(message);
    setWarningState(null);
  }

  function setNotice(message: string) {
    setNoticeState(message);
    setWarningState(null);
  }

  function setWarning(message: string) {
    setWarningState(message);
    setErrorState(null);
  }

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    setNotice(
      nextTheme === "dark" ? "ダーク表示に切り替えました。" : "ライト表示に切り替えました。",
    );
  }

  function toggleWhitespace() {
    setShowWhitespace((current) => !current);
  }

  return {
    clearError,
    error,
    isLoading,
    notice,
    selectedTrashItemKey,
    setError,
    setIsLoading,
    setNotice,
    setWarning,
    setSelectedTrashItemKey,
    setSnapshot,
    setViewState,
    showWhitespace,
    snapshot,
    theme,
    toggleTheme,
    toggleWhitespace,
    view,
    warning,
  };
}
