import { confirm } from "@tauri-apps/plugin-dialog";
import type { Dispatch, SetStateAction } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { maildraftApi } from "../../../shared/api/maildraft-api";
import { applyVariablePresetResult } from "../../../shared/lib/store-snapshot";
import type { StoreSnapshot } from "../../../shared/types/store";
import type { DraftInput } from "../model";
import type { VariablePresetInput } from "../variable-presets";
import {
  applyVariablePresetValues,
  collectMeaningfulVariableValues,
  hasMeaningfulVariableValues,
} from "../variable-presets";
import { toDraftWorkspaceErrorMessage } from "./draft-workspace-helpers";

interface DraftVariablePresetsStateOptions {
  draftForm: DraftInput;
  draftVariableNames: string[];
  onClearError: () => void;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
  onSnapshotChange: (snapshot: StoreSnapshot) => void;
  setDraftForm: Dispatch<SetStateAction<DraftInput>>;
  snapshot: StoreSnapshot;
}

/**
 * Coordinates variable preset selection, application, and persistence for the active draft form.
 *
 * @remarks
 * Preset selection is resolved against the current snapshot on every render so deleted presets do
 * not leave stale local state behind. Save and delete operations patch only the preset collection
 * into the current snapshot.
 */
export function useDraftVariablePresetsState({
  draftForm,
  draftVariableNames,
  onClearError,
  onError,
  onNotice,
  onSnapshotChange,
  setDraftForm,
  snapshot,
}: DraftVariablePresetsStateOptions) {
  const [selectedVariablePresetId, setSelectedVariablePresetId] = useState<string | null>(null);
  const [variablePresetName, setVariablePresetName] = useState("");
  const snapshotRef = useRef(snapshot);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  const resolvedSelectedVariablePresetId =
    selectedVariablePresetId !== null &&
    snapshot.variablePresets.some((preset) => preset.id === selectedVariablePresetId)
      ? selectedVariablePresetId
      : null;
  const resolvedVariablePresetName =
    selectedVariablePresetId !== null && resolvedSelectedVariablePresetId === null
      ? ""
      : variablePresetName;

  const selectedVariablePreset = useMemo(
    () =>
      snapshot.variablePresets.find((preset) => preset.id === resolvedSelectedVariablePresetId) ??
      null,
    [resolvedSelectedVariablePresetId, snapshot.variablePresets],
  );
  const canSaveVariablePreset =
    resolvedVariablePresetName.trim().length > 0 &&
    hasMeaningfulVariableValues(draftVariableNames, draftForm.variableValues);
  const canApplyVariablePreset =
    selectedVariablePreset !== null &&
    draftVariableNames.some((name) => typeof selectedVariablePreset.values[name] === "string");

  function resetVariablePresetSelection() {
    setSelectedVariablePresetId(null);
    setVariablePresetName("");
  }

  function selectVariablePreset(id: string | null) {
    if (!id) {
      resetVariablePresetSelection();
      return;
    }

    const preset = snapshot.variablePresets.find((item) => item.id === id);
    if (!preset) {
      return;
    }

    setSelectedVariablePresetId(preset.id);
    setVariablePresetName(preset.name);
  }

  function createVariablePreset() {
    resetVariablePresetSelection();
  }

  function changeVariablePresetName(value: string) {
    setVariablePresetName(value);
  }

  function applyVariablePreset() {
    if (!selectedVariablePreset) {
      return;
    }

    setDraftForm((current) => ({
      ...current,
      variableValues: applyVariablePresetValues(
        current.variableValues,
        selectedVariablePreset.values,
        draftVariableNames,
      ),
    }));
    onNotice(`変数値セット「${selectedVariablePreset.name}」を適用しました。`);
  }

  async function saveVariablePreset() {
    if (!canSaveVariablePreset) {
      return;
    }

    const input: VariablePresetInput = {
      id: resolvedSelectedVariablePresetId ?? crypto.randomUUID(),
      name: resolvedVariablePresetName.trim(),
      values: collectMeaningfulVariableValues(draftVariableNames, draftForm.variableValues),
    };

    try {
      onClearError();
      const savedVariablePreset = await maildraftApi.saveVariablePreset(input);
      const nextSnapshot = applyVariablePresetResult(snapshotRef.current, savedVariablePreset);
      onSnapshotChange(nextSnapshot);
      setSelectedVariablePresetId(input.id);
      setVariablePresetName(input.name);
      onNotice(
        resolvedSelectedVariablePresetId
          ? "変数値セットを更新しました。"
          : "変数値セットを保存しました。",
      );
    } catch (saveError) {
      onError(toDraftWorkspaceErrorMessage(saveError));
    }
  }

  async function deleteVariablePreset() {
    if (!selectedVariablePreset) {
      return;
    }

    const confirmed = await confirm(
      `変数値セット「${selectedVariablePreset.name}」を削除します。続けますか？`,
      {
        title: "MailDraft",
        kind: "warning",
        okLabel: "削除",
        cancelLabel: "キャンセル",
      },
    );

    if (!confirmed) {
      return;
    }

    try {
      onClearError();
      const deletedVariablePreset = await maildraftApi.deleteVariablePreset(
        selectedVariablePreset.id,
      );
      const nextSnapshot = applyVariablePresetResult(snapshotRef.current, deletedVariablePreset);
      onSnapshotChange(nextSnapshot);
      resetVariablePresetSelection();
      onNotice("変数値セットを削除しました。");
    } catch (deleteError) {
      onError(toDraftWorkspaceErrorMessage(deleteError));
    }
  }

  return {
    applyVariablePreset,
    canApplyVariablePreset,
    canSaveVariablePreset,
    changeVariablePresetName,
    createVariablePreset,
    deleteVariablePreset,
    resetVariablePresetSelection,
    saveVariablePreset,
    selectVariablePreset,
    selectedVariablePresetId: resolvedSelectedVariablePresetId,
    variablePresetName: resolvedVariablePresetName,
  };
}
