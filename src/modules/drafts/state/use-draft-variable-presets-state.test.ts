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
          values: { 相手名: "佐藤様" },
        }),
      ],
    });

    const { result, rerender } = renderHook(
      ({ currentSnapshot }) =>
        useDraftVariablePresetsState({
          draftForm: createDraftInput({
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
    expect(result.current.selectedVariablePresetId).toBe("00000000-0000-4000-8000-000000000011");
    expect(result.current.variablePresetName).toBe("A社向け");
    expect(onNotice).toHaveBeenCalledWith("変数値セットを保存しました。");
    randomUuidSpy.mockRestore();
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
