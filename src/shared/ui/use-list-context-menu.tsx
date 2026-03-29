import { useMemo } from "react";

import { ContextMenu, type ContextMenuItem } from "./ContextMenu";
import { useContextMenuState } from "./use-context-menu-state";

interface UseListContextMenuOptions<T> {
  createItems: (payload: T) => ContextMenuItem[];
}

/**
 * Builds a dismissible list-item context menu from the clicked item payload.
 */
export function useListContextMenu<T>({ createItems }: UseListContextMenuOptions<T>) {
  const { closeContextMenu, contextMenuState, openContextMenu } = useContextMenuState<T>();

  const contextMenu = useMemo(() => {
    if (!contextMenuState) {
      return null;
    }

    return (
      <ContextMenu
        items={createItems(contextMenuState.payload)}
        position={contextMenuState.position}
        onClose={closeContextMenu}
      />
    );
  }, [closeContextMenu, contextMenuState, createItems]);

  return {
    contextMenu,
    openItemContextMenu: openContextMenu,
  };
}
