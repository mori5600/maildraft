import { type ReactNode, useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { clampContextMenuPosition, type ContextMenuPosition } from "./context-menu-position";

type ContextMenuTone = "default" | "danger";

export type ContextMenuItem =
  | {
      id: string;
      label: string;
      onSelect: () => void | Promise<void>;
      disabled?: boolean;
      tone?: ContextMenuTone;
      type?: "action";
      icon?: ReactNode;
    }
  | {
      id: string;
      type: "separator";
    };

interface ContextMenuProps {
  items: ContextMenuItem[];
  onClose: () => void;
  position: ContextMenuPosition;
}

const VIEWPORT_PADDING = 8;

/**
 * Renders a dismissible portal menu at the pointer position for list-style context actions.
 */
export function ContextMenu({ items, onClose, position }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) {
      return;
    }

    const { innerWidth, innerHeight } = window;
    const { height, width } = menu.getBoundingClientRect();

    const nextPosition = clampContextMenuPosition(
      position,
      { height, width },
      { height: innerHeight, width: innerWidth },
      VIEWPORT_PADDING,
    );

    menu.style.left = `${nextPosition.x}px`;
    menu.style.top = `${nextPosition.y}px`;
  }, [items, position]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const handleWindowChange = () => {
      onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleWindowChange);
    window.addEventListener("scroll", handleWindowChange, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleWindowChange);
      window.removeEventListener("scroll", handleWindowChange, true);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[60]"
      onContextMenu={(event) => event.preventDefault()}
      onMouseDown={onClose}
    >
      <div
        ref={menuRef}
        className="min-w-40 rounded-[10px] border border-(--color-panel-border-strong) bg-(--color-panel-bg) p-1.5 shadow-[0_18px_48px_rgba(0,0,0,0.22)]"
        role="menu"
        style={{
          left: `${Math.max(VIEWPORT_PADDING, position.x)}px`,
          top: `${Math.max(VIEWPORT_PADDING, position.y)}px`,
          position: "fixed",
        }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {items.map((item) =>
          item.type === "separator" ? (
            <div
              key={item.id}
              className="my-1 border-t border-(--color-panel-border-strong)"
              role="separator"
            />
          ) : (
            <button
              key={item.id}
              className={`flex w-full items-center gap-2 rounded-[7px] px-2.5 py-2 text-left text-xs transition-colors ${
                item.tone === "danger"
                  ? "text-(--color-button-danger-text) hover:bg-(--color-button-danger-bg)"
                  : "text-(--color-text-strong) hover:bg-(--color-list-hover-bg)"
              } disabled:cursor-not-allowed disabled:opacity-45`}
              disabled={item.disabled}
              role="menuitem"
              type="button"
              onClick={() => {
                onClose();
                void item.onSelect();
              }}
            >
              {item.icon ? (
                <span aria-hidden="true" className="shrink-0 text-(--color-text-subtle)">
                  {item.icon}
                </span>
              ) : null}
              <span className="truncate">{item.label}</span>
            </button>
          ),
        )}
      </div>
    </div>,
    document.body,
  );
}
