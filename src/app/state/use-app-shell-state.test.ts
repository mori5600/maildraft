import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createStoreSnapshot } from "../../test/ui-fixtures";

const themeMocks = vi.hoisted(() => ({
  applyTheme: vi.fn(),
  persistTheme: vi.fn(),
  resolveInitialTheme: vi.fn(() => "dark" as const),
}));

vi.mock("../../shared/lib/theme", () => ({
  applyTheme: themeMocks.applyTheme,
  persistTheme: themeMocks.persistTheme,
  resolveInitialTheme: themeMocks.resolveInitialTheme,
}));

import { useAppShellState } from "./use-app-shell-state";

describe("useAppShellState", () => {
  afterEach(() => {
    vi.clearAllMocks();
    themeMocks.resolveInitialTheme.mockReturnValue("dark");
  });

  it("keeps error, warning, and notice state transitions explicit", () => {
    const { result } = renderHook(() => useAppShellState(createStoreSnapshot()));

    expect(result.current.notice).toBe("ローカル保存の準備をしています。");
    expect(result.current.error).toBeNull();
    expect(result.current.warning).toBeNull();
    expect(themeMocks.applyTheme).toHaveBeenCalledWith("dark");
    expect(themeMocks.persistTheme).toHaveBeenCalledWith("dark");

    act(() => {
      result.current.setWarning("復旧しました。");
    });
    expect(result.current.warning).toBe("復旧しました。");
    expect(result.current.error).toBeNull();

    act(() => {
      result.current.setError("読み込みに失敗しました。");
    });
    expect(result.current.error).toBe("読み込みに失敗しました。");
    expect(result.current.warning).toBeNull();

    act(() => {
      result.current.setNotice("保存しました。");
    });
    expect(result.current.notice).toBe("保存しました。");
    expect(result.current.error).toBe("読み込みに失敗しました。");
    expect(result.current.warning).toBeNull();

    act(() => {
      result.current.clearError();
    });
    expect(result.current.error).toBeNull();
    expect(result.current.warning).toBeNull();
  });

  it("updates theme, snapshot, view, and whitespace flags as shell state", () => {
    const nextSnapshot = createStoreSnapshot({
      memos: [],
      trash: {
        drafts: [],
        templates: [],
        signatures: [],
        memos: [],
      },
    });
    const { result } = renderHook(() => useAppShellState(createStoreSnapshot()));

    act(() => {
      result.current.setSnapshot(nextSnapshot);
      result.current.setViewState("trash");
      result.current.setSelectedTrashItemKey("draft:draft-1");
      result.current.setIsLoading(false);
      result.current.toggleWhitespace();
      result.current.toggleTheme();
    });

    expect(result.current.snapshot).toEqual(nextSnapshot);
    expect(result.current.view).toBe("trash");
    expect(result.current.selectedTrashItemKey).toBe("draft:draft-1");
    expect(result.current.isLoading).toBe(false);
    expect(result.current.showWhitespace).toBe(true);
    expect(result.current.theme).toBe("light");
    expect(result.current.notice).toBe("ライト表示に切り替えました。");
    expect(themeMocks.applyTheme).toHaveBeenLastCalledWith("light");
    expect(themeMocks.persistTheme).toHaveBeenLastCalledWith("light");
  });
});
