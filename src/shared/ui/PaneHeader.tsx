import type { ReactNode } from "react";

interface PaneHeaderProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function PaneHeader({ title, description, action }: PaneHeaderProps) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 border-b border-(--color-panel-border-strong) px-3.5">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-(--color-text-strong)">{title}</div>
        <div className="truncate text-[11px] text-(--color-text-subtle)">{description}</div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
