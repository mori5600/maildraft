import { PaneHeader } from "../../../../shared/ui/PaneHeader";
import { Panel } from "../../../../shared/ui/primitives";
import { SETTINGS_SECTIONS, type SettingsSection } from "../settings-workspace-content";

interface SettingsSectionNavProps {
  activeSection: SettingsSection;
  onSelectSection: (section: SettingsSection) => void;
}

export function SettingsSectionNav({
  activeSection,
  onSelectSection,
}: SettingsSectionNavProps) {
  return (
    <Panel className="overflow-hidden lg:h-full">
      <PaneHeader description="設定カテゴリ" title="設定" />

      <div className="grid gap-1.5 px-2.5 py-2.5">
        {SETTINGS_SECTIONS.map((section) => {
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
    </Panel>
  );
}
