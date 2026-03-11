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
      <div className="mx-auto flex h-full w-full max-w-[1400px] items-stretch px-4 py-4 md:px-6 md:py-6">
        <Panel
          className="flex h-full min-h-0 w-full flex-col overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.28)]"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="flex min-h-14 items-center justify-between gap-4 border-b border-[var(--color-panel-border-strong)] px-5">
            <div className="min-w-0">
              <div className="text-sm font-medium text-[var(--color-text-strong)]">{title}</div>
              {description ? (
                <div className="truncate text-xs text-[var(--color-text-subtle)]">
                  {description}
                </div>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {action}
              <Button size="sm" variant="secondary" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        </Panel>
      </div>
    </div>
  );
}
