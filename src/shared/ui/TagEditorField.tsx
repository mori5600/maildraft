import { useId } from "react";

import { MAX_TAG_LENGTH, MAX_TAGS_PER_ITEM } from "../lib/tags";
import { Field } from "./primitives";
import { TagChipList } from "./TagChipList";
import { TagSuggestionList } from "./TagSuggestionList";
import { useTagPickerState } from "./use-tag-picker-state";

function cn(...classNames: Array<string | false | null | undefined>): string {
  return classNames.filter(Boolean).join(" ");
}

export interface TagEditorFieldProps {
  availableTags?: string[];
  hint?: string;
  label?: string;
  placeholder?: string;
  tags: string[];
  onChangeTags: (tags: string[]) => void;
}

export function TagEditorField({
  availableTags = [],
  hint = "Enter で追加",
  label = "タグ",
  placeholder = "タグを追加",
  tags,
  onChangeTags,
}: TagEditorFieldProps) {
  const listboxId = useId();
  const {
    activeOption,
    commitTag,
    handleInputChange,
    handleInputFocus,
    handleInputKeyDown,
    handleRootBlur,
    helperMessage,
    highlightedIndex,
    inputRef,
    isPickerOpen,
    limitReached,
    pendingTag,
    removeSelectedTag,
    setHighlightedIndex,
    suggestionOptions,
  } = useTagPickerState({
    availableTags,
    hint,
    onChangeTags,
    tags,
  });

  return (
    <Field label={label} wrapWithLabel={false}>
      <div className="grid gap-1.5" onBlur={handleRootBlur}>
        <div
          className={cn(
            "mail-editor-frame flex min-h-10 flex-wrap items-center gap-1.5 rounded-[7px] px-2 py-1.5",
            isPickerOpen &&
              "border-(--color-field-focus) shadow-[inset_0_1px_0_var(--color-panel-highlight),0_0_0_1px_var(--color-field-focus),0_0_0_4px_var(--color-focus-ring)]",
          )}
        >
          <TagChipList tags={tags} onRemoveTag={removeSelectedTag} />

          <input
            ref={inputRef}
            aria-activedescendant={activeOption ? `${listboxId}-${highlightedIndex}` : undefined}
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded={isPickerOpen && suggestionOptions.length > 0}
            aria-label={label}
            aria-haspopup="listbox"
            className="min-w-[7rem] flex-1 border-0 bg-transparent px-1 py-1 text-[13px] text-(--color-text-strong) outline-none placeholder:text-(--color-text-placeholder) disabled:cursor-not-allowed disabled:text-(--color-text-muted)"
            disabled={limitReached}
            maxLength={MAX_TAG_LENGTH}
            placeholder={tags.length === 0 ? placeholder : "タグを追加"}
            role="combobox"
            value={pendingTag}
            onChange={(event) => handleInputChange(event.currentTarget.value)}
            onFocus={handleInputFocus}
            onKeyDown={handleInputKeyDown}
          />
        </div>

        {isPickerOpen && suggestionOptions.length > 0 ? (
          <TagSuggestionList
            highlightedIndex={highlightedIndex}
            listboxId={listboxId}
            onHighlight={setHighlightedIndex}
            onSelect={commitTag}
            options={suggestionOptions}
          />
        ) : null}

        {helperMessage ? (
          <div className="text-[11px] text-(--color-text-hint)">
            {helperMessage}
            {limitReached ? ` (${tags.length}/${MAX_TAGS_PER_ITEM})` : null}
          </div>
        ) : null}
      </div>
    </Field>
  );
}
