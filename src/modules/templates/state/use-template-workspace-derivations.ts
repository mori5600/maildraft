import { useMemo } from "react";

import type { TemplateSortOption } from "../../../shared/lib/list-sort";
import { collectUniqueTags, resolveActiveTagFilter } from "../../../shared/lib/tags";
import type { StoreSnapshot } from "../../../shared/types/store";
import { renderTemplatePreview } from "../../renderer/render-draft";
import { findTrashSignature } from "../../trash/model";
import type { TemplateInput } from "../model";
import { createTemplateSearchIndex, selectFilteredTemplates } from "./template-workspace-selectors";

interface UseTemplateWorkspaceDerivationsOptions {
  deferredTemplateSearchQuery: string;
  requestedTagFilter: string | null;
  snapshot: StoreSnapshot;
  templateForm: TemplateInput;
  templateSort: TemplateSortOption;
}

export function useTemplateWorkspaceDerivations({
  deferredTemplateSearchQuery,
  requestedTagFilter,
  snapshot,
  templateForm,
  templateSort,
}: UseTemplateWorkspaceDerivationsOptions) {
  const selectedTemplateSignature = useMemo(
    () =>
      findTrashSignature(snapshot.signatures, snapshot.trash.signatures, templateForm.signatureId),
    [snapshot.signatures, snapshot.trash.signatures, templateForm.signatureId],
  );
  const templatePreviewText = useMemo(
    () => renderTemplatePreview(templateForm, selectedTemplateSignature),
    [selectedTemplateSignature, templateForm],
  );
  const templateSearchIndex = useMemo(
    () => createTemplateSearchIndex(snapshot.templates),
    [snapshot.templates],
  );
  const availableTemplateTags = useMemo(
    () => collectUniqueTags(snapshot.templates),
    [snapshot.templates],
  );
  const activeTemplateTagFilter = useMemo(
    () => resolveActiveTagFilter(availableTemplateTags, requestedTagFilter),
    [availableTemplateTags, requestedTagFilter],
  );
  const filteredTemplates = useMemo(
    () =>
      selectFilteredTemplates(
        templateSearchIndex,
        deferredTemplateSearchQuery,
        activeTemplateTagFilter,
        templateSort,
      ),
    [activeTemplateTagFilter, deferredTemplateSearchQuery, templateSearchIndex, templateSort],
  );

  return {
    activeTemplateTagFilter,
    availableTemplateTags,
    filteredTemplates,
    templatePreviewText,
  };
}
