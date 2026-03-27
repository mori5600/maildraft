import { type FocusEvent, type KeyboardEvent, useCallback, useMemo, useRef, useState } from "react";

import {
  addTag,
  canAddTag,
  MAX_TAG_LENGTH,
  MAX_TAGS_PER_ITEM,
  normalizeTag,
  removeTag,
} from "../lib/tags";
import { buildTagSuggestionOptions } from "./tag-picker-options";

interface UseTagPickerStateOptions {
  availableTags: string[];
  hint: string;
  onChangeTags: (tags: string[]) => void;
  tags: string[];
}

export function useTagPickerState({
  availableTags,
  hint,
  onChangeTags,
  tags,
}: UseTagPickerStateOptions) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingTag, setPendingTag] = useState("");
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [highlightedIndexState, setHighlightedIndex] = useState(0);

  const normalizedPendingTag = normalizeTag(pendingTag);
  const canSubmit = canAddTag(tags, pendingTag);
  const limitReached = tags.length >= MAX_TAGS_PER_ITEM;
  const suggestionOptions = useMemo(
    () => buildTagSuggestionOptions(availableTags, tags, normalizedPendingTag, canSubmit),
    [availableTags, canSubmit, normalizedPendingTag, tags],
  );
  const highlightedIndex =
    suggestionOptions.length === 0
      ? 0
      : Math.min(highlightedIndexState, suggestionOptions.length - 1);
  const activeOption = suggestionOptions[highlightedIndex] ?? null;
  const helperMessage =
    pendingTag.trim().length > MAX_TAG_LENGTH
      ? `${MAX_TAG_LENGTH}文字以内で入力してください。`
      : limitReached
        ? `タグは ${MAX_TAGS_PER_ITEM} 件までです。`
        : isPickerOpen && suggestionOptions.length > 0
          ? hint
          : null;

  const commitTag = useCallback(
    (tag: string) => {
      if (!canAddTag(tags, tag)) {
        return;
      }

      onChangeTags(addTag(tags, tag));
      setPendingTag("");
      setHighlightedIndex(0);
      setIsPickerOpen(true);
      inputRef.current?.focus();
    },
    [onChangeTags, tags],
  );

  const removeSelectedTag = useCallback(
    (tag: string) => {
      onChangeTags(removeTag(tags, tag));
    },
    [onChangeTags, tags],
  );

  const handleInputChange = useCallback((value: string) => {
    setPendingTag(value);
    setIsPickerOpen(true);
    setHighlightedIndex(0);
  }, []);

  const handleInputFocus = useCallback(() => {
    setIsPickerOpen(true);
  }, []);

  const handleRootBlur = useCallback((event: FocusEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget)) {
      return;
    }

    setIsPickerOpen(false);
  }, []);

  const handleInputKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
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
        setHighlightedIndex((current) =>
          current >= suggestionOptions.length - 1 ? 0 : current + 1,
        );
        return;
      }

      if (event.key === "ArrowUp") {
        if (suggestionOptions.length === 0) {
          return;
        }

        event.preventDefault();
        setIsPickerOpen(true);
        setHighlightedIndex((current) =>
          current <= 0 ? suggestionOptions.length - 1 : current - 1,
        );
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
    },
    [activeOption, commitTag, onChangeTags, pendingTag, suggestionOptions.length, tags],
  );

  return {
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
  };
}
