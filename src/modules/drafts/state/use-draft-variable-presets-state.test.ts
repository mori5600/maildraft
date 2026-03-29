import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { maildraftApi } from "../../../shared/api/maildraft-api";
import {
  createDraftInput,
  createStoreSnapshot,
  createVariablePreset,
} from "../../../test/ui-fixtures";
import { useDraftVariablePresetsState } from "./use-draft-variable-presets-state";

const { confirmMock } = vi.hoisted(() => ({
  confirmMock: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  confirm: confirmMock,
}));

describe("draft variable presets state", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("saves a variable preset through a compact payload", async () => {
    const randomUuidSpy = vi
      .spyOn(crypto, "randomUUID")
      .mockReturnValue("00000000-0000-4000-8000-000000000011");
    const snapshot = createStoreSnapshot({
      variablePresets: [],
    });
    const onSnapshotChange = vi.fn();
    const onNotice = vi.fn();

    vi.spyOn(maildraftApi, "saveVariablePreset").mockResolvedValue({
      variablePresets: [
        createVariablePreset({
          id: "00000000-0000-4000-8000-000000000011",
          name: "A社向け",
          tags: ["社外"],
          values: { 相手名: "佐藤様" },
        }),
      ],
    });

    const { result, rerender } = renderHook(
      ({ currentSnapshot }) =>
        useDraftVariablePresetsState({
          draftForm: createDraftInput({
            tags: ["社外"],
            variableValues: {
              相手名: "佐藤様",
            },
          }),
          draftVariableNames: ["相手名"],
          onClearError: vi.fn(),
          onError: vi.fn(),
          onNotice,
          onSnapshotChange,
          setDraftForm: vi.fn(),
          snapshot: currentSnapshot,
        }),
      {
        initialProps: {
          currentSnapshot: snapshot,
        },
      },
    );

    act(() => {
      result.current.changeVariablePresetName("A社向け");
    });

    await act(async () => {
      await result.current.saveVariablePreset();
    });

    await waitFor(() => {
      expect(onSnapshotChange).toHaveBeenCalledTimes(1);
    });

    const nextSnapshot = onSnapshotChange.mock.calls[0][0];
    rerender({ currentSnapshot: nextSnapshot });
    expect(nextSnapshot.variablePresets.map((preset: { id: string }) => preset.id)).toEqual([
      "00000000-0000-4000-8000-000000000011",
    ]);
    expect(nextSnapshot.variablePresets[0].tags).toEqual(["社外"]);
    expect(result.current.selectedVariablePresetId).toBe("00000000-0000-4000-8000-000000000011");
    expect(result.current.variablePresetName).toBe("A社向け");
    expect(onNotice).toHaveBeenCalledWith("変数値セットを保存しました。");
    randomUuidSpy.mockRestore();
  });

  it("applies a preset and records its usage through the compact payload", async () => {
    const snapshot = createStoreSnapshot({
      variablePresets: [
        createVariablePreset({
          id: "preset-apply",
          lastUsedAt: null,
          values: { 相手名: "田中様" },
        }),
      ],
    });
    const onSnapshotChange = vi.fn();
    const setDraftForm = vi.fn();
    const onNotice = vi.fn();

    vi.spyOn(maildraftApi, "recordVariablePresetUsage").mockResolvedValue({
      variablePresets: [
        createVariablePreset({
          id: "preset-apply",
          lastUsedAt: "40",
          updatedAt: "40",
          values: { 相手名: "田中様" },
        }),
      ],
    });

    const { result, rerender } = renderHook(
      ({ currentSnapshot }) =>
        useDraftVariablePresetsState({
          draftForm: createDraftInput({ variableValues: { 相手名: "" } }),
          draftVariableNames: ["相手名"],
          onClearError: vi.fn(),
          onError: vi.fn(),
          onNotice,
          onSnapshotChange,
          setDraftForm,
          snapshot: currentSnapshot,
        }),
      {
        initialProps: {
          currentSnapshot: snapshot,
        },
      },
    );

    act(() => {
      result.current.selectVariablePreset("preset-apply");
    });

    await act(async () => {
      await result.current.applyVariablePreset();
    });

    expect(setDraftForm).toHaveBeenCalledTimes(1);
    expect(onNotice).toHaveBeenCalledWith("変数値セット「A社向け」を適用しました。");
    await waitFor(() => {
      expect(onSnapshotChange).toHaveBeenCalledTimes(1);
    });

    const nextSnapshot = onSnapshotChange.mock.calls[0][0];
    rerender({ currentSnapshot: nextSnapshot });
    expect(nextSnapshot.variablePresets[0].lastUsedAt).toBe("40");
  });

  it("keeps the newer usage timestamps when usage responses resolve out of order", async () => {
    const snapshot = createStoreSnapshot({
      variablePresets: [
        createVariablePreset({
          id: "preset-first",
          name: "A社向け",
          lastUsedAt: null,
          updatedAt: "10",
          values: { 相手名: "佐藤様" },
        }),
        createVariablePreset({
          id: "preset-second",
          name: "B社向け",
          lastUsedAt: null,
          updatedAt: "11",
          values: { 相手名: "高橋様" },
        }),
      ],
    });
    const onSnapshotChange = vi.fn();
    const setDraftForm = vi.fn();

    let resolveFirstUsage:
      | ((value: { variablePresets: ReturnType<typeof createVariablePreset>[] }) => void)
      | null = null;
    let resolveSecondUsage:
      | ((value: { variablePresets: ReturnType<typeof createVariablePreset>[] }) => void)
      | null = null;

    vi.spyOn(maildraftApi, "recordVariablePresetUsage")
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirstUsage = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecondUsage = resolve;
          }),
      );

    const { result } = renderHook(() =>
      useDraftVariablePresetsState({
        draftForm: createDraftInput({ variableValues: { 相手名: "" } }),
        draftVariableNames: ["相手名"],
        onClearError: vi.fn(),
        onError: vi.fn(),
        onNotice: vi.fn(),
        onSnapshotChange,
        setDraftForm,
        snapshot,
      }),
    );

    let firstApplyPromise: Promise<void> | undefined;
    let secondApplyPromise: Promise<void> | undefined;

    await act(async () => {
      firstApplyPromise = result.current.applyVariablePresetById("preset-first");
      secondApplyPromise = result.current.applyVariablePresetById("preset-second");
    });

    await act(async () => {
      resolveSecondUsage?.({
        variablePresets: [
          createVariablePreset({
            id: "preset-second",
            name: "B社向け",
            lastUsedAt: "200",
            updatedAt: "200",
            values: { 相手名: "高橋様" },
          }),
        ],
      });
      await secondApplyPromise;
    });

    await act(async () => {
      resolveFirstUsage?.({
        variablePresets: [
          createVariablePreset({
            id: "preset-first",
            name: "A社向け",
            lastUsedAt: "100",
            updatedAt: "100",
            values: { 相手名: "佐藤様" },
          }),
        ],
      });
      await firstApplyPromise;
    });

    expect(setDraftForm).toHaveBeenCalledTimes(2);
    expect(onSnapshotChange).toHaveBeenCalledTimes(2);
    expect(onSnapshotChange.mock.calls[1][0].variablePresets).toEqual([
      expect.objectContaining({ id: "preset-second", lastUsedAt: "200" }),
      expect.objectContaining({ id: "preset-first", lastUsedAt: "100" }),
    ]);
  });

  it("deletes a variable preset through a compact payload", async () => {
    const snapshot = createStoreSnapshot({
      variablePresets: [
        createVariablePreset({
          id: "preset-delete",
          name: "削除対象",
          values: { 相手名: "佐藤様" },
        }),
      ],
    });
    const onSnapshotChange = vi.fn();
    const onNotice = vi.fn();

    confirmMock.mockResolvedValue(true);
    vi.spyOn(maildraftApi, "deleteVariablePreset").mockResolvedValue({
      variablePresets: [],
    });

    const { result, rerender } = renderHook(
      ({ currentSnapshot }) =>
        useDraftVariablePresetsState({
          draftForm: createDraftInput(),
          draftVariableNames: ["相手名"],
          onClearError: vi.fn(),
          onError: vi.fn(),
          onNotice,
          onSnapshotChange,
          setDraftForm: vi.fn(),
          snapshot: currentSnapshot,
        }),
      {
        initialProps: {
          currentSnapshot: snapshot,
        },
      },
    );

    act(() => {
      result.current.selectVariablePreset("preset-delete");
    });

    await act(async () => {
      await result.current.deleteVariablePreset();
    });

    await waitFor(() => {
      expect(onSnapshotChange).toHaveBeenCalledTimes(1);
    });

    const nextSnapshot = onSnapshotChange.mock.calls[0][0];
    rerender({ currentSnapshot: nextSnapshot });
    expect(nextSnapshot.variablePresets).toEqual([]);
    expect(result.current.selectedVariablePresetId).toBeNull();
    expect(result.current.variablePresetName).toBe("");
    expect(onNotice).toHaveBeenCalledWith("変数値セットを削除しました。");
  });
});
