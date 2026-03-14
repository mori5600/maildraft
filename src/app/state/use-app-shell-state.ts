import { useEffect, useState } from "react";

import {
  applyTheme,
  type AppTheme,
  persistTheme,
  resolveInitialTheme,
} from "../../shared/lib/theme";
import type { StoreSnapshot, WorkspaceView } from "../../shared/types/store";

export function useAppShellState(initialSnapshot: StoreSnapshot) {
  const [snapshot, setSnapshot] = useState<StoreSnapshot>(initialSnapshot);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("ローカル保存の準備をしています。");
  const [view, setViewState] = useState<WorkspaceView>("drafts");
  const [theme, setTheme] = useState<AppTheme>(() => resolveInitialTheme());
  const [showWhitespace, setShowWhitespace] = useState(false);
  const [selectedTrashItemKey, setSelectedTrashItemKey] = useState<string | null>(null);

  useEffect(() => {
    applyTheme(theme);
    persistTheme(theme);
  }, [theme]);

  function clearError() {
    setError(null);
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
    setSelectedTrashItemKey,
    setSnapshot,
    setViewState,
    showWhitespace,
    snapshot,
    theme,
    toggleTheme,
    toggleWhitespace,
    view,
  };
}
