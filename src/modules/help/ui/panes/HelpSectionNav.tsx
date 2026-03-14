import type { AppInfo } from "../../../../shared/lib/app-info";
import { PaneHeader } from "../../../../shared/ui/PaneHeader";
import { Panel } from "../../../../shared/ui/primitives";
import { HELP_SECTIONS, type HelpSection } from "../../model";

interface HelpSectionNavProps {
  activeSection: HelpSection;
  appInfo: AppInfo;
  onSelectSection: (section: HelpSection) => void;
}

export function HelpSectionNav({
  activeSection,
  appInfo,
  onSelectSection,
}: HelpSectionNavProps) {
  return (
    <Panel className="flex flex-col overflow-hidden lg:h-full">
      <PaneHeader description="ヘルプカテゴリ" title="ヘルプ" />

      <div className="grid flex-1 content-start gap-1.5 px-2.5 py-2.5">
        {HELP_SECTIONS.map((section) => {
          const active = activeSection === section.id;

          return (
            <button
              key={section.id}
              className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                active
                  ? "border-(--color-panel-border-strong) bg-(--color-nav-active-bg)"
                  : "border-transparent bg-transparent hover:border-(--color-panel-border) hover:bg-(--color-nav-hover-bg)"
              }`}
              type="button"
              onClick={() => onSelectSection(section.id)}
            >
              <div className="text-[13px] font-medium text-(--color-text-strong)">
                {section.label}
              </div>
              <div className="mt-1 text-[11px] text-(--color-text-subtle)">
                {section.description}
              </div>
            </button>
          );
        })}
      </div>

      <div className="border-t border-(--color-panel-border-strong) px-3.5 py-2.5">
        <div className="text-[11px] font-medium text-(--color-text-subtle)">{appInfo.name}</div>
        <div className="mt-0.5 text-[11px] text-(--color-text-faint)">バージョン {appInfo.version}</div>
      </div>
    </Panel>
  );
}
