import { type MouseEvent, useCallback, useState } from "react";

interface ContextMenuState<T> {
  position: {
    x: number;
    y: number;
  };
  payload: T;
}

/**
 * Stores the currently open context menu payload and pointer coordinates for list panes.
 */
export function useContextMenuState<T>() {
  const [menuState, setMenuState] = useState<ContextMenuState<T> | null>(null);

  const openContextMenu = useCallback(
    (event: MouseEvent, payload: T) => {
      event.preventDefault();
      event.stopPropagation();
      setMenuState({
        position: {
          x: event.clientX,
          y: event.clientY,
        },
        payload,
      });
    },
    [setMenuState],
  );

  const closeContextMenu = useCallback(() => {
    setMenuState(null);
  }, [setMenuState]);

  return {
    closeContextMenu,
    contextMenuState: menuState,
    openContextMenu,
  };
}
