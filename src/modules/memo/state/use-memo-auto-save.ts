import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { maildraftApi } from "../../../shared/api/maildraft-api";
import { applySavedMemoResult, pickMemoInput } from "../../../shared/lib/store-snapshot";
import type { StoreSnapshot } from "../../../shared/types/store";
import {
  memoHasMeaningfulContent,
  type MemoInput,
  memoMatchesPersistedMemo,
} from "../model";
import {
  formatMemoAutoSaveState,
  type MemoAutoSaveState,
  shouldAutoPersistMemo,
  toMemoWorkspaceErrorMessage,
} from "./memo-workspace-helpers";

const AUTO_SAVE_DELAY_MS = 900;

interface TransientMemoAutoSaveState {
  kind: "error" | "saving";
  memoRevision: string;
}

interface MemoAutoSaveOptions {
  initialAutoSaveState: MemoAutoSaveState;
  memoForm: MemoInput;
  memoFormRef: RefObject<MemoInput>;
  onClearError: () => void;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
  onSnapshotChange: (snapshot: StoreSnapshot) => void;
  selectedMemoId: string | null;
  setMemoForm: Dispatch<SetStateAction<MemoInput>>;
  setSelectedMemoId: Dispatch<SetStateAction<string | null>>;
  snapshot: StoreSnapshot;
  snapshotRef: RefObject<StoreSnapshot>;
}

export function useMemoAutoSave({
  initialAutoSaveState,
  memoForm,
  memoFormRef,
  onClearError,
  onError,
  onNotice,
  onSnapshotChange,
  selectedMemoId,
  setMemoForm,
  setSelectedMemoId,
  snapshot,
  snapshotRef,
}: MemoAutoSaveOptions) {
  const [transientMemoAutoSaveState, setTransientMemoAutoSaveState] =
    useState<TransientMemoAutoSaveState | null>(() =>
      initialAutoSaveState === "error" || initialAutoSaveState === "saving"
        ? {
            kind: initialAutoSaveState,
            memoRevision: serializeMemoRevision(memoForm),
          }
        : null,
    );

  const persistMemo = useCallback(
    async ({ input, mode }: { input: MemoInput; mode: "manual" | "auto" }) => {
      const affectsCurrentMemo = memoFormRef.current.id === input.id;

      if (mode === "auto" && !shouldAutoPersistMemo(input, snapshotRef.current)) {
        return;
      }

      try {
        if (mode === "auto" && affectsCurrentMemo) {
          setTransientMemoAutoSaveState({
            kind: "saving",
            memoRevision: serializeMemoRevision(input),
          });
        }

        if (mode === "manual") {
          onClearError();
        }

        const savedMemo = await maildraftApi.saveMemo(input);
        const nextSnapshot = applySavedMemoResult(snapshotRef.current, savedMemo);
        onSnapshotChange(nextSnapshot);

        if (memoFormRef.current.id === input.id) {
          setSelectedMemoId(savedMemo.id);
          setMemoForm(pickMemoInput(nextSnapshot, savedMemo.id));
        }

        if (mode === "manual") {
          setTransientMemoAutoSaveState(null);
          onNotice("メモを保存しました。");
        } else if (affectsCurrentMemo) {
          setTransientMemoAutoSaveState(null);
        }
      } catch (saveError) {
        if (affectsCurrentMemo) {
          setTransientMemoAutoSaveState({
            kind: "error",
            memoRevision: serializeMemoRevision(input),
          });
        }

        onError(toMemoWorkspaceErrorMessage(saveError));
      }
    },
    [
      memoFormRef,
      onClearError,
      onError,
      onNotice,
      onSnapshotChange,
      setMemoForm,
      setSelectedMemoId,
      snapshotRef,
    ],
  );

  const persistedMemoIndex = useMemo(
    () => new Map(snapshot.memos.map((memo) => [memo.id, memo] as const)),
    [snapshot.memos],
  );
  const persistedMemo = persistedMemoIndex.get(memoForm.id) ?? null;
  const memoShouldPersist = selectedMemoId !== null || memoHasMeaningfulContent(memoForm);
  const memoIsDirty = memoShouldPersist && !memoMatchesPersistedMemo(memoForm, persistedMemo);
  const memoRevision = useMemo(() => serializeMemoRevision(memoForm), [memoForm]);
  const baseMemoAutoSaveState: MemoAutoSaveState = !memoShouldPersist
    ? "idle"
    : memoIsDirty
      ? "dirty"
      : "saved";
  const memoAutoSaveState =
    transientMemoAutoSaveState?.memoRevision === memoRevision
      ? transientMemoAutoSaveState.kind
      : baseMemoAutoSaveState;

  useEffect(() => {
    if (!memoShouldPersist || !memoIsDirty) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void persistMemo({
        input: memoForm,
        mode: "auto",
      });
    }, AUTO_SAVE_DELAY_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [memoForm, memoIsDirty, memoShouldPersist, persistMemo]);

  const flushPendingMemo = useCallback(() => {
    if (!shouldAutoPersistMemo(memoFormRef.current, snapshotRef.current)) {
      return;
    }

    void persistMemo({
      input: memoFormRef.current,
      mode: "auto",
    });
  }, [memoFormRef, persistMemo, snapshotRef]);

  const saveMemo = useCallback(async () => {
    await persistMemo({
      input: memoForm,
      mode: "manual",
    });
  }, [memoForm, persistMemo]);

  return {
    autoSaveLabel: formatMemoAutoSaveState(memoAutoSaveState),
    flushPendingMemo,
    saveMemo,
  };
}

function serializeMemoRevision(input: MemoInput): string {
  return JSON.stringify({
    body: input.body,
    id: input.id,
    title: input.title,
  });
}
