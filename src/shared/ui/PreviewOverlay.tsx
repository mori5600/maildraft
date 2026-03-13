import { type ReactNode, useEffect } from "react";

import { Button, Panel } from "./primitives";

interface PreviewOverlayProps {
  action?: ReactNode;
  children: ReactNode;
  description?: string;
  isOpen: boolean;
  onClose: () => void;
  title: string;
}

export function PreviewOverlay({
  action,
  children,
  description,
  isOpen,
  onClose,
  title,
}: PreviewOverlayProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50"
      style={{ backgroundColor: "var(--color-overlay-backdrop)" }}
      onMouseDown={onClose}
    >
      <div className="mx-auto flex h-full w-full max-w-330 items-stretch px-3 py-3 md:px-4 md:py-4">
        <Panel
          className="flex h-full min-h-0 w-full flex-col overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.24)]"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="flex min-h-12 items-center justify-between gap-3 border-b border-(--color-panel-border-strong) px-4">
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-(--color-text-strong)">{title}</div>
              {description ? (
                <div className="truncate text-[11px] text-(--color-text-subtle)">{description}</div>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {action}
              <Button size="sm" variant="secondary" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
        </Panel>
      </div>
    </div>
  );
}
