export interface ContextMenuPosition {
  x: number;
  y: number;
}

interface ContextMenuBounds {
  height: number;
  width: number;
}

interface ViewportBounds {
  height: number;
  width: number;
}

/**
 * Clamps a context menu to the visible viewport while preserving the requested pointer origin.
 */
export function clampContextMenuPosition(
  position: ContextMenuPosition,
  menu: ContextMenuBounds,
  viewport: ViewportBounds,
  padding: number,
): ContextMenuPosition {
  return {
    x: Math.max(padding, Math.min(position.x, viewport.width - menu.width - padding)),
    y: Math.max(padding, Math.min(position.y, viewport.height - menu.height - padding)),
  };
}
