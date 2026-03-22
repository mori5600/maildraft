import { useMemo } from "react";

import type { DraftSortOption } from "../../../shared/lib/list-sort";
import type { StoreSnapshot } from "../../../shared/types/store";
import { buildDraftRenderResult, collectDraftVariableNames } from "../../renderer/render-draft";
import { findTrashSignature } from "../../trash/model";
import type { DraftInput } from "../model";
import {
  createDraftSearchIndex,
  selectDraftHistory,
  selectFilteredDrafts,
} from "./draft-workspace-selectors";

interface UseDraftWorkspaceDerivationsOptions {
  deferredDraftSearchQuery: string;
  draftForm: DraftInput;
  draftSort: DraftSortOption;
  snapshot: StoreSnapshot;
}

export function useDraftWorkspaceDerivations({
  deferredDraftSearchQuery,
  draftForm,
  draftSort,
  snapshot,
}: UseDraftWorkspaceDerivationsOptions) {
  const selectedDraftSignature = useMemo(
    () => findTrashSignature(snapshot.signatures, snapshot.trash.signatures, draftForm.signatureId),
    [draftForm.signatureId, snapshot.signatures, snapshot.trash.signatures],
  );
  const draftVariableNames = useMemo(
    () => collectDraftVariableNames(draftForm, selectedDraftSignature),
    [draftForm, selectedDraftSignature],
  );
  const draftRenderResult = useMemo(
    () => buildDraftRenderResult(draftForm, selectedDraftSignature),
    [draftForm, selectedDraftSignature],
  );
  const draftHistory = useMemo(
    () => selectDraftHistory(snapshot.draftHistory, draftForm.id),
    [draftForm.id, snapshot.draftHistory],
  );
  const draftSearchIndex = useMemo(
    () => createDraftSearchIndex(snapshot.drafts),
    [snapshot.drafts],
  );
  const filteredDrafts = useMemo(
    () => selectFilteredDrafts(draftSearchIndex, deferredDraftSearchQuery, draftSort),
    [deferredDraftSearchQuery, draftSearchIndex, draftSort],
  );

  return {
    draftHistory,
    draftRenderResult,
    draftVariableNames,
    filteredDrafts,
    selectedDraftSignature,
  };
}
