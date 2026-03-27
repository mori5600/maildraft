import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MAX_TAG_LENGTH, MAX_TAGS_PER_ITEM } from "../lib/tags";
import { useTagPickerState } from "./use-tag-picker-state";

function createKeyEvent(
  key: string,
  options: {
    isComposing?: boolean;
  } = {},
) {
  return {
    key,
    nativeEvent: {
      isComposing: options.isComposing ?? false,
    },
    preventDefault: vi.fn(),
  } as const;
}

describe("useTagPickerState", () => {
  it("wraps keyboard navigation and commits the highlighted suggestion", () => {
    const onChangeTags = vi.fn();

    const { result } = renderHook(() =>
      useTagPickerState({
        availableTags: ["社外", "営業"],
        hint: "Enter で追加",
        onChangeTags,
        tags: [],
      }),
    );

    act(() => {
      result.current.handleInputFocus();
    });

    const arrowUpEvent = createKeyEvent("ArrowUp");
    act(() => {
      result.current.handleInputKeyDown(arrowUpEvent as never);
    });

    expect(arrowUpEvent.preventDefault).toHaveBeenCalledTimes(1);
    expect(result.current.highlightedIndex).toBe(1);
    expect(result.current.activeOption?.value).toBe("営業");

    const enterEvent = createKeyEvent("Enter");
    act(() => {
      result.current.handleInputKeyDown(enterEvent as never);
    });

    expect(enterEvent.preventDefault).toHaveBeenCalledTimes(1);
    expect(onChangeTags).toHaveBeenCalledWith(["営業"]);
    expect(result.current.pendingTag).toBe("");
    expect(result.current.highlightedIndex).toBe(0);
    expect(result.current.isPickerOpen).toBe(true);
  });

  it("surfaces validation state and closes only when blur leaves the picker", () => {
    const onChangeTags = vi.fn();

    const { result } = renderHook(() =>
      useTagPickerState({
        availableTags: [],
        hint: "Enter で追加",
        onChangeTags,
        tags: Array.from({ length: MAX_TAGS_PER_ITEM }, (_, index) => `タグ${index}`),
      }),
    );

    expect(result.current.limitReached).toBe(true);
    expect(result.current.helperMessage).toBe(`タグは ${MAX_TAGS_PER_ITEM} 件までです。`);

    act(() => {
      result.current.handleInputChange("x".repeat(MAX_TAG_LENGTH + 1));
    });

    expect(result.current.helperMessage).toBe(`${MAX_TAG_LENGTH}文字以内で入力してください。`);

    act(() => {
      result.current.handleInputFocus();
    });
    expect(result.current.isPickerOpen).toBe(true);

    act(() => {
      result.current.handleRootBlur({
        currentTarget: { contains: () => true },
        relatedTarget: {},
      } as never);
    });
    expect(result.current.isPickerOpen).toBe(true);

    act(() => {
      result.current.handleRootBlur({
        currentTarget: { contains: () => false },
        relatedTarget: null,
      } as never);
    });
    expect(result.current.isPickerOpen).toBe(false);
  });

  it("ignores Enter while IME composition is active", () => {
    const onChangeTags = vi.fn();

    const { result } = renderHook(() =>
      useTagPickerState({
        availableTags: ["採用"],
        hint: "Enter で追加",
        onChangeTags,
        tags: [],
      }),
    );

    act(() => {
      result.current.handleInputChange("採用");
    });

    const enterEvent = createKeyEvent("Enter", { isComposing: true });
    act(() => {
      result.current.handleInputKeyDown(enterEvent as never);
    });

    expect(enterEvent.preventDefault).not.toHaveBeenCalled();
    expect(onChangeTags).not.toHaveBeenCalled();
  });
});
