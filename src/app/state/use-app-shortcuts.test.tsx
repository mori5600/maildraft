import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { type ShortcutActionSet, useAppShortcuts } from "./use-app-shortcuts";

function createActions(): ShortcutActionSet {
  return {
    changeView: vi.fn(),
    copyDraftPreview: vi.fn(async () => {}),
    createDraft: vi.fn(),
    createMemo: vi.fn(),
    createSignature: vi.fn(),
    createTemplate: vi.fn(),
    saveDraft: vi.fn(async () => {}),
    saveSettingsSection: vi.fn(async () => {}),
    saveMemo: vi.fn(async () => {}),
    saveSignature: vi.fn(async () => {}),
    saveTemplate: vi.fn(async () => {}),
    toggleDraftPinned: vi.fn(),
    toggleMemoPinned: vi.fn(),
    toggleSignaturePinned: vi.fn(),
    toggleTemplatePinned: vi.fn(),
  };
}

function dispatchShortcut(init: KeyboardEventInit): void {
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ...init }));
  });
}

function dispatchShortcutWithFlags(
  init: KeyboardEventInit,
  flags: { isComposing?: boolean; repeat?: boolean },
): void {
  const event = new KeyboardEvent("keydown", { bubbles: true, ...init });
  if (flags.isComposing !== undefined) {
    Object.defineProperty(event, "isComposing", {
      configurable: true,
      value: flags.isComposing,
    });
  }
  if (flags.repeat !== undefined) {
    Object.defineProperty(event, "repeat", {
      configurable: true,
      value: flags.repeat,
    });
  }

  act(() => {
    window.dispatchEvent(event);
  });
}

interface ShortcutHookProps {
  currentActions: ShortcutActionSet;
  isLoading: boolean;
  view: "drafts" | "templates" | "signatures" | "memo" | "trash" | "settings" | "help";
}

describe("app shortcuts", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("routes shortcuts to the current workspace and latest action set", async () => {
    const actions = createActions();
    const nextActions = createActions();
    const searchInput = document.createElement("input");
    searchInput.setAttribute("data-maildraft-search", "memo");
    document.body.append(searchInput);
    const selectSpy = vi.spyOn(searchInput, "select");

    const { rerender } = renderHook<void, ShortcutHookProps>(
      ({ currentActions, isLoading, view }: ShortcutHookProps) =>
        useAppShortcuts({
          actions: currentActions,
          isLoading,
          view,
        }),
      {
        initialProps: {
          currentActions: actions,
          isLoading: false,
          view: "memo" as const,
        } satisfies ShortcutHookProps,
      },
    );

    dispatchShortcut({ ctrlKey: true, key: "k" });
    expect(searchInput).toHaveFocus();
    expect(selectSpy).toHaveBeenCalledTimes(1);

    dispatchShortcut({ ctrlKey: true, key: "n" });
    expect(actions.createMemo).toHaveBeenCalledTimes(1);

    dispatchShortcut({ ctrlKey: true, shiftKey: true, key: "P" });
    expect(actions.toggleMemoPinned).toHaveBeenCalledTimes(1);

    dispatchShortcut({ ctrlKey: true, key: "2" });
    expect(actions.changeView).toHaveBeenCalledWith("templates");

    rerender({
      currentActions: actions,
      isLoading: false,
      view: "drafts",
    } satisfies ShortcutHookProps);

    dispatchShortcut({ ctrlKey: true, shiftKey: true, key: "C" });
    await Promise.resolve();
    expect(actions.copyDraftPreview).toHaveBeenCalledTimes(1);

    rerender({
      currentActions: nextActions,
      isLoading: false,
      view: "settings",
    } satisfies ShortcutHookProps);

    dispatchShortcut({ ctrlKey: true, key: "s" });
    await Promise.resolve();
    expect(nextActions.saveSettingsSection).toHaveBeenCalledTimes(1);
    expect(actions.saveSettingsSection).not.toHaveBeenCalled();
  });

  it("ignores blocked shortcut events and removes the listener on unmount", () => {
    const actions = createActions();
    const { rerender, unmount } = renderHook<void, { isLoading: boolean }>(
      ({ isLoading }: { isLoading: boolean }) =>
        useAppShortcuts({
          actions,
          isLoading,
          view: "drafts",
        }),
      {
        initialProps: {
          isLoading: true,
        },
      },
    );

    dispatchShortcut({ ctrlKey: true, key: "n" });
    expect(actions.createDraft).not.toHaveBeenCalled();

    rerender({ isLoading: false });

    const prevented = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      key: "n",
    });
    prevented.preventDefault();
    act(() => {
      window.dispatchEvent(prevented);
    });

    dispatchShortcut({ ctrlKey: true, altKey: true, key: "n" });
    dispatchShortcutWithFlags({ ctrlKey: true, key: "n" }, { repeat: true });
    dispatchShortcutWithFlags({ ctrlKey: true, key: "n" }, { isComposing: true });
    expect(actions.createDraft).not.toHaveBeenCalled();

    dispatchShortcut({ ctrlKey: true, key: "n" });
    expect(actions.createDraft).toHaveBeenCalledTimes(1);

    unmount();
    dispatchShortcut({ ctrlKey: true, key: "n" });
    expect(actions.createDraft).toHaveBeenCalledTimes(1);
  });
});
