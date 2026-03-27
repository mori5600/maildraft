import { type FocusEvent, type KeyboardEvent, useId, useMemo, useRef, useState } from "react";

import {
  addTag,
  canAddTag,
  MAX_TAG_LENGTH,
  MAX_TAGS_PER_ITEM,
  normalizeTag,
  removeTag,
} from "../lib/tags";
import { Field } from "./primitives";

function cn(...classNames: Array<string | false | null | undefined>): string {
  return classNames.filter(Boolean).join(" ");
}

interface TagEditorFieldProps {
  availableTags?: string[];
  hint?: string;
  label?: string;
  placeholder?: string;
  tags: string[];
  onChangeTags: (tags: string[]) => void;
}

interface SuggestionOption {
  kind: "existing" | "create";
  label: string;
  value: string;
}

export function TagEditorField({
  availableTags = [],
  hint = "Enter で追加",
  label = "タグ",
  placeholder = "タグを追加",
  tags,
  onChangeTags,
}: TagEditorFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const [pendingTag, setPendingTag] = useState("");
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const normalizedPendingTag = normalizeTag(pendingTag);
  const canSubmit = canAddTag(tags, pendingTag);
  const limitReached = tags.length >= MAX_TAGS_PER_ITEM;
  const suggestionOptions = useMemo(
    () => buildSuggestionOptions(availableTags, tags, normalizedPendingTag, canSubmit),
    [availableTags, canSubmit, normalizedPendingTag, tags],
  );
  const resolvedHighlightedIndex =
    suggestionOptions.length === 0 ? 0 : Math.min(highlightedIndex, suggestionOptions.length - 1);
  const activeOption = suggestionOptions[resolvedHighlightedIndex] ?? null;
  const helperMessage =
    pendingTag.trim().length > MAX_TAG_LENGTH
      ? `${MAX_TAG_LENGTH}文字以内で入力してください。`
      : limitReached
        ? `タグは ${MAX_TAGS_PER_ITEM} 件までです。`
        : isPickerOpen && suggestionOptions.length > 0
          ? hint
          : null;

  function commitTag(tag: string) {
    if (!canAddTag(tags, tag)) {
      return;
    }

    onChangeTags(addTag(tags, tag));
    setPendingTag("");
    setHighlightedIndex(0);
    setIsPickerOpen(true);
    inputRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && pendingTag.length === 0 && tags.length > 0) {
      event.preventDefault();
      onChangeTags(removeTag(tags, tags[tags.length - 1]));
      return;
    }

    if (event.key === "Escape") {
      setIsPickerOpen(false);
      return;
    }

    if (event.key === "ArrowDown") {
      if (suggestionOptions.length === 0) {
        return;
      }

      event.preventDefault();
      setIsPickerOpen(true);
      setHighlightedIndex((current) => (current >= suggestionOptions.length - 1 ? 0 : current + 1));
      return;
    }

    if (event.key === "ArrowUp") {
      if (suggestionOptions.length === 0) {
        return;
      }

      event.preventDefault();
      setIsPickerOpen(true);
      setHighlightedIndex((current) => (current <= 0 ? suggestionOptions.length - 1 : current - 1));
      return;
    }

    if (event.key !== "Enter" || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();

    if (activeOption) {
      commitTag(activeOption.value);
      return;
    }

    commitTag(pendingTag);
  }

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (event.currentTarget.contains(event.relatedTarget)) {
      return;
    }

    setIsPickerOpen(false);
  }

  return (
    <Field label={label} wrapWithLabel={false}>
      <div className="grid gap-1.5" onBlur={handleBlur}>
        <div
          className={cn(
            "mail-editor-frame flex min-h-10 flex-wrap items-center gap-1.5 rounded-[7px] px-2 py-1.5",
            isPickerOpen &&
              "border-(--color-field-focus) shadow-[inset_0_1px_0_var(--color-panel-highlight),0_0_0_1px_var(--color-field-focus),0_0_0_4px_var(--color-focus-ring)]",
          )}
        >
          {tags.map((tag) => (
            <button
              key={tag}
              aria-label={`タグ「${tag}」を削除`}
              className={cn(
                "mail-button-focus inline-flex items-center gap-1 rounded-[999px] border border-(--color-pill-neutral-border) bg-(--color-panel-bg) px-2.5 py-1 text-[11px] text-(--color-text-muted)",
              )}
              type="button"
              onClick={() => onChangeTags(removeTag(tags, tag))}
            >
              <span>{tag}</span>
              <span aria-hidden="true" className="text-[10px] text-(--color-text-overlay)">
                ×
              </span>
            </button>
          ))}

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
            onChange={(event) => {
              setPendingTag(event.currentTarget.value);
              setIsPickerOpen(true);
              setHighlightedIndex(0);
            }}
            onFocus={() => setIsPickerOpen(true)}
            onKeyDown={handleKeyDown}
          />
        </div>

        {isPickerOpen && suggestionOptions.length > 0 ? (
          <div
            className="rounded-[7px] border border-(--color-panel-border-strong) bg-(--color-panel-bg) py-1 shadow-[0_8px_28px_rgba(8,12,18,0.18)]"
            id={listboxId}
            role="listbox"
          >
            {suggestionOptions.map((option, index) => (
              <button
                key={`${option.kind}:${option.value}`}
                aria-selected={index === resolvedHighlightedIndex}
                className={cn(
                  "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px] text-(--color-text) transition-colors",
                  index === resolvedHighlightedIndex
                    ? "bg-(--color-list-active-bg) text-(--color-text-strong)"
                    : "hover:bg-(--color-list-hover-bg)",
                )}
                id={`${listboxId}-${index}`}
                role="option"
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => commitTag(option.value)}
              >
                <span className="truncate">{option.label}</span>
                <span className="text-[10px] tracking-[0.08em] text-(--color-text-subtle) uppercase">
                  {option.kind === "existing" ? "既存" : "新規"}
                </span>
              </button>
            ))}
          </div>
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

function buildSuggestionOptions(
  availableTags: string[],
  tags: string[],
  normalizedPendingTag: string,
  canCreateTag: boolean,
): SuggestionOption[] {
  const lowerCaseQuery = normalizedPendingTag.toLocaleLowerCase();
  const selectedTags = new Set(tags);
  const prefixMatches: SuggestionOption[] = [];
  const partialMatches: SuggestionOption[] = [];

  for (const tag of availableTags) {
    if (selectedTags.has(tag)) {
      continue;
    }

    const lowerCaseTag = tag.toLocaleLowerCase();
    if (lowerCaseQuery && !lowerCaseTag.includes(lowerCaseQuery)) {
      continue;
    }

    const option: SuggestionOption = {
      kind: "existing",
      label: tag,
      value: tag,
    };

    if (lowerCaseQuery && lowerCaseTag.startsWith(lowerCaseQuery)) {
      prefixMatches.push(option);
    } else {
      partialMatches.push(option);
    }
  }

  const options = [...prefixMatches, ...partialMatches].slice(0, 8);
  const shouldShowCreateOption =
    canCreateTag && !options.some((option) => option.value === normalizedPendingTag);

  if (shouldShowCreateOption) {
    options.push({
      kind: "create",
      label: `「${normalizedPendingTag}」を追加`,
      value: normalizedPendingTag,
    });
  }

  return options;
}
