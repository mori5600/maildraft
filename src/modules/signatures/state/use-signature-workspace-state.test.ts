import { act, renderHook, waitFor } from "@testing-library/react";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { maildraftApi } from "../../../shared/api/maildraft-api";
import type { StoreSnapshot } from "../../../shared/types/store";
import { buildTrashItemKey } from "../../trash/model";
import {
  buildSignatureEditingState,
  useSignatureWorkspaceState,
} from "./use-signature-workspace-state";

const randomUuidSpy = vi
  .spyOn(crypto, "randomUUID")
  .mockReturnValue("00000000-0000-4000-8000-000000000002");

const snapshot: StoreSnapshot = {
  drafts: [],
  draftHistory: [],
  variablePresets: [],
  templates: [],
  signatures: [
    {
      id: "signature-1",
      name: "標準署名",
      isPinned: false,
      body: "本文",
      isDefault: true,
      createdAt: "1",
      updatedAt: "2",
    },
    {
      id: "signature-2",
      name: "営業署名",
      isPinned: true,
      body: "営業部",
      isDefault: false,
      createdAt: "1",
      updatedAt: "1",
    },
  ],
  memos: [],
  trash: {
    drafts: [],
    templates: [],
    signatures: [],
  },
};

describe("signature workspace state", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("picks the preferred signature when it exists", () => {
    expect(buildSignatureEditingState(snapshot, "signature-2")).toMatchObject({
      selectedSignatureId: "signature-2",
      signatureForm: {
        id: "signature-2",
        name: "営業署名",
      },
    });
  });

  it("falls back to the first signature and creates an empty form when none exists", () => {
    expect(buildSignatureEditingState(snapshot, "missing")).toMatchObject({
      selectedSignatureId: "signature-1",
      signatureForm: {
        id: "signature-1",
        isDefault: true,
      },
    });

    expect(
      buildSignatureEditingState({
        drafts: [],
        draftHistory: [],
        variablePresets: [],
        templates: [],
        signatures: [],
        memos: [],
        trash: {
          drafts: [],
          templates: [],
          signatures: [],
        },
      }),
    ).toMatchObject({
      selectedSignatureId: null,
      signatureForm: {
        id: "00000000-0000-4000-8000-000000000002",
        isDefault: true,
      },
    });
  });
  it("deletes a signature via compact payload and keeps the remaining signature selected", async () => {
    const onSnapshotChange = vi.fn();
    const onSignatureSnapshotChange = vi.fn();
    const onTrashItemSelect = vi.fn();
    const onNotice = vi.fn();

    vi.spyOn(maildraftApi, "deleteSignature").mockResolvedValue({
      signatures: [snapshot.signatures[0]],
      trashedSignature: {
        signature: snapshot.signatures[1],
        deletedAt: "20",
      },
    });

    const { result } = renderHook(() =>
      useSignatureWorkspaceState({
        onClearError: vi.fn(),
        onError: vi.fn(),
        onFlushDraft: vi.fn(),
        onNotice,
        onSignatureSnapshotChange,
        onSnapshotChange,
        onTrashItemSelect,
        onViewChange: vi.fn(),
        snapshot,
      }),
    );

    expect(result.current.signatureWorkspaceProps.selectedSignatureId).toBe("signature-1");

    act(() => {
      result.current.signatureWorkspaceProps.onSelectSignature("signature-2");
    });
    expect(result.current.signatureWorkspaceProps.selectedSignatureId).toBe("signature-2");

    await act(async () => {
      await result.current.signatureWorkspaceProps.onDeleteSignature();
    });

    await waitFor(() => {
      expect(onSnapshotChange).toHaveBeenCalledTimes(1);
    });

    const nextSnapshot = onSnapshotChange.mock.calls[0][0];
    expect(nextSnapshot.signatures.map((signature: { id: string }) => signature.id)).toEqual([
      "signature-1",
    ]);
    expect(nextSnapshot.trash.signatures[0]?.signature.id).toBe("signature-2");

    await waitFor(() => {
      expect(result.current.signatureWorkspaceProps.selectedSignatureId).toBe("signature-1");
    });
    expect(onSignatureSnapshotChange).toHaveBeenCalledWith(nextSnapshot);
    expect(onTrashItemSelect).toHaveBeenCalledWith(buildTrashItemKey("signature", "signature-2"));
    expect(onNotice).toHaveBeenCalledWith("署名をゴミ箱に移動しました。");
  });

  it("saves the active signature through a compact payload", async () => {
    const savedSignature = {
      ...snapshot.signatures[0],
      name: "更新済み署名",
      updatedAt: "3",
    };
    const onSnapshotChange = vi.fn();
    const onSignatureSnapshotChange = vi.fn();
    const onNotice = vi.fn();
    const saveSignatureSpy = vi.spyOn(maildraftApi, "saveSignature").mockResolvedValue({
      signatures: [savedSignature, snapshot.signatures[1]],
    });

    const { result } = renderHook(() =>
      useSignatureWorkspaceState({
        onClearError: vi.fn(),
        onError: vi.fn(),
        onFlushDraft: vi.fn(),
        onNotice,
        onSignatureSnapshotChange,
        onSnapshotChange,
        onTrashItemSelect: vi.fn(),
        onViewChange: vi.fn(),
        snapshot,
      }),
    );

    act(() => {
      result.current.signatureWorkspaceProps.onChangeSignature("name", "更新済み署名");
    });

    await act(async () => {
      await result.current.signatureWorkspaceProps.onSaveSignature();
    });

    await waitFor(() => {
      expect(onSnapshotChange).toHaveBeenCalledTimes(1);
    });

    expect(saveSignatureSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "signature-1",
        name: "更新済み署名",
      }),
    );
    const nextSnapshot = onSnapshotChange.mock.calls[0][0];
    expect(
      nextSnapshot.signatures.some(
        (signature: { name: string }) => signature.name === "更新済み署名",
      ),
    ).toBe(true);
    expect(result.current.signatureWorkspaceProps.selectedSignatureId).toBe("signature-1");
    expect(onSignatureSnapshotChange).toHaveBeenCalledWith(nextSnapshot);
    expect(onNotice).toHaveBeenCalledWith("署名を保存しました。");
  });

  it("autosaves a dirty signature after the debounce interval", async () => {
    vi.useFakeTimers();

    const savedSignature = {
      ...snapshot.signatures[0],
      body: "自動保存の本文",
      updatedAt: "3",
    };
    const onSnapshotChange = vi.fn();
    const onSignatureSnapshotChange = vi.fn();
    const onNotice = vi.fn();
    const saveSignatureSpy = vi.spyOn(maildraftApi, "saveSignature").mockResolvedValue({
      signatures: [savedSignature, snapshot.signatures[1]],
    });

    const { result } = renderHook(() =>
      useSignatureWorkspaceState({
        onClearError: vi.fn(),
        onError: vi.fn(),
        onFlushDraft: vi.fn(),
        onNotice,
        onSignatureSnapshotChange,
        onSnapshotChange,
        onTrashItemSelect: vi.fn(),
        onViewChange: vi.fn(),
        snapshot,
      }),
    );

    act(() => {
      result.current.signatureWorkspaceProps.onChangeSignature("body", "自動保存の本文");
    });

    expect(result.current.signatureWorkspaceProps.autoSaveLabel).toBe("未保存の変更があります");
    expect(saveSignatureSpy).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });

    expect(onSnapshotChange).toHaveBeenCalledTimes(1);
    expect(saveSignatureSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "signature-1",
        body: "自動保存の本文",
      }),
    );
    expect(onSignatureSnapshotChange).toHaveBeenCalledTimes(1);
    expect(onNotice).not.toHaveBeenCalled();
  });

  it("duplicates the active signature through a compact save payload", async () => {
    const duplicatedSignature = {
      ...snapshot.signatures[1],
      id: "00000000-0000-4000-8000-000000000002",
      name: "営業署名 コピー",
      isPinned: false,
      isDefault: false,
      updatedAt: "3",
    };
    const onSnapshotChange = vi.fn();
    const onSignatureSnapshotChange = vi.fn();
    const onNotice = vi.fn();

    vi.spyOn(maildraftApi, "saveSignature").mockResolvedValue({
      signatures: [duplicatedSignature, ...snapshot.signatures],
    });

    const { result } = renderHook(() =>
      useSignatureWorkspaceState({
        onClearError: vi.fn(),
        onError: vi.fn(),
        onFlushDraft: vi.fn(),
        onNotice,
        onSignatureSnapshotChange,
        onSnapshotChange,
        onTrashItemSelect: vi.fn(),
        onViewChange: vi.fn(),
        snapshot,
      }),
    );

    act(() => {
      result.current.signatureWorkspaceProps.onSelectSignature("signature-2");
    });

    await act(async () => {
      await result.current.signatureWorkspaceProps.onDuplicateSignature();
    });

    await waitFor(() => {
      expect(onSnapshotChange).toHaveBeenCalledTimes(1);
    });

    const nextSnapshot = onSnapshotChange.mock.calls[0][0];
    expect(nextSnapshot.signatures.map((signature: { id: string }) => signature.id)).toEqual(
      expect.arrayContaining([
        "00000000-0000-4000-8000-000000000002",
        "signature-1",
        "signature-2",
      ]),
    );
    await waitFor(() => {
      expect(result.current.signatureWorkspaceProps.selectedSignatureId).toBe(
        "00000000-0000-4000-8000-000000000002",
      );
    });
    expect(result.current.signatureWorkspaceProps.signatureForm.name).toBe("営業署名 コピー");
    expect(onSignatureSnapshotChange).toHaveBeenCalledWith(nextSnapshot);
    expect(onNotice).toHaveBeenCalledWith("署名を複製しました。");
  });

  it("creates a new signature instead of deleting when nothing is selected", async () => {
    const deleteSignatureSpy = vi.spyOn(maildraftApi, "deleteSignature");
    const onNotice = vi.fn();
    const onViewChange = vi.fn();

    const { result } = renderHook(() =>
      useSignatureWorkspaceState({
        onClearError: vi.fn(),
        onError: vi.fn(),
        onFlushDraft: vi.fn(),
        onNotice,
        onSignatureSnapshotChange: vi.fn(),
        onSnapshotChange: vi.fn(),
        onTrashItemSelect: vi.fn(),
        onViewChange,
        snapshot: {
          ...snapshot,
          signatures: [],
        },
      }),
    );

    await act(async () => {
      await result.current.signatureWorkspaceProps.onDeleteSignature();
    });

    expect(deleteSignatureSpy).not.toHaveBeenCalled();
    expect(result.current.signatureWorkspaceProps.selectedSignatureId).toBeNull();
    expect(onViewChange).toHaveBeenCalledWith("signatures");
    expect(onNotice).toHaveBeenCalledWith("新しい署名を作成しています。");
  });
});

afterAll(() => {
  randomUuidSpy.mockRestore();
});
