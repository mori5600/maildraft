import { useState } from "react";

import { Panel, Pill } from "../../../shared/ui/primitives";
import {
  HELP_SECTIONS,
  HELP_USAGE_GROUPS,
  type HelpSection,
  KEYBOARD_SHORTCUT_GROUPS,
} from "../model";

export function HelpWorkspace() {
  const [activeSection, setActiveSection] = useState<HelpSection>("usage");

  return (
    <div className="grid h-full min-h-0 gap-3 overflow-y-auto pr-1 lg:grid-cols-[188px_minmax(0,1fr)] lg:overflow-hidden lg:pr-0">
      <Panel className="overflow-hidden lg:h-full">
        <PaneHeader description="ヘルプカテゴリ" title="Help" />

        <div className="grid gap-1.5 px-2.5 py-2.5">
          {HELP_SECTIONS.map((section) => {
            const active = activeSection === section.id;

            return (
              <button
                key={section.id}
                className={`rounded-[8px] border px-3 py-2 text-left transition-colors ${
                  active
                    ? "border-[var(--color-panel-border-strong)] bg-[var(--color-nav-active-bg)]"
                    : "border-transparent bg-transparent hover:border-[var(--color-panel-border)] hover:bg-[var(--color-nav-hover-bg)]"
                }`}
                type="button"
                onClick={() => setActiveSection(section.id)}
              >
                <div className="text-[13px] font-medium text-[var(--color-text-strong)]">
                  {section.label}
                </div>
                <div className="mt-1 text-[11px] text-[var(--color-text-subtle)]">
                  {section.description}
                </div>
              </button>
            );
          })}
        </div>
      </Panel>

      <div className="min-h-0 overflow-y-auto">
        {activeSection === "usage" ? <UsageGuide /> : <ShortcutGuide />}
      </div>
    </div>
  );
}

function UsageGuide() {
  return (
    <Panel className="overflow-hidden">
      <PaneHeader description="MailDraft の基本的な使い方" title="使い方" />

      <div className="grid gap-3 px-3.5 py-3.5">
        <section className="rounded-[8px] border border-[var(--color-panel-border-strong)] bg-[var(--color-field-bg)] px-3.5 py-3">
          <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-subtle)]">
            Overview
          </div>
          <div className="mt-2.5 space-y-1.5 text-[13px] leading-6 text-[var(--color-text-muted)]">
            <p>MailDraft は、日本語のメール本文をローカル保存で整えていくための下書きアプリです。</p>
            <p>まずは下書きを作り、必要に応じてテンプレートや署名を組み合わせる使い方が基本です。</p>
          </div>
        </section>

        {HELP_USAGE_GROUPS.map((group) => (
          <section
            key={group.id}
            className="rounded-[8px] border border-[var(--color-panel-border-strong)] bg-[var(--color-panel-bg)]"
          >
            <div className="border-b border-[var(--color-panel-border-strong)] px-3.5 py-3">
              <div className="text-[13px] font-medium text-[var(--color-text-strong)]">
                {group.title}
              </div>
              <div className="mt-1 text-[11px] text-[var(--color-text-subtle)]">
                {group.description}
              </div>
            </div>

            <div className="grid gap-2 px-3.5 py-3">
              {group.steps.map((step, index) => (
                <div
                  key={`${group.id}-${step.title}`}
                  className="grid gap-2 rounded-[7px] border border-[var(--color-panel-border-strong)] bg-[var(--color-field-bg)] px-3 py-2.5 md:grid-cols-[40px_minmax(0,1fr)]"
                >
                  <div className="flex items-start">
                    <Pill tone="accent">{index + 1}</Pill>
                  </div>
                  <div>
                    <div className="text-[13px] text-[var(--color-text-strong)]">{step.title}</div>
                    <div className="mt-1 text-[12px] leading-6 text-[var(--color-text-muted)]">
                      {step.body}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Panel>
  );
}

function ShortcutGuide() {
  return (
    <Panel className="overflow-hidden">
      <PaneHeader
        description="現在使えるキーボードショートカット"
        title="ショートカット一覧"
      />

      <div className="grid gap-3 px-3.5 py-3.5">
        <section className="rounded-[8px] border border-[var(--color-panel-border-strong)] bg-[var(--color-field-bg)] px-3.5 py-3">
          <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-subtle)]">
            Notes
          </div>
          <div className="mt-2.5 space-y-1.5 text-[13px] leading-6 text-[var(--color-text-muted)]">
            <p>Windows では Ctrl、macOS では Cmd で使えます。</p>
            <p>日本語 IME の変換中は、ショートカットが誤発火しないように無効化しています。</p>
          </div>
        </section>

        {KEYBOARD_SHORTCUT_GROUPS.map((group) => (
          <section
            key={group.id}
            className="rounded-[8px] border border-[var(--color-panel-border-strong)] bg-[var(--color-panel-bg)]"
          >
            <div className="border-b border-[var(--color-panel-border-strong)] px-3.5 py-3">
              <div className="text-[13px] font-medium text-[var(--color-text-strong)]">
                {group.title}
              </div>
              <div className="mt-1 text-[11px] text-[var(--color-text-subtle)]">
                {group.description}
              </div>
            </div>

            <div className="grid gap-2 px-3.5 py-3">
              {group.items.map((item) => (
                <div
                  key={item.keys}
                  className="grid gap-2 rounded-[7px] border border-[var(--color-panel-border-strong)] bg-[var(--color-field-bg)] px-3 py-2.5 md:grid-cols-[170px_minmax(0,1fr)] md:items-start"
                >
                  <div className="flex items-center">
                    <Pill tone="accent">{item.keys}</Pill>
                  </div>
                  <div>
                    <div className="text-[13px] text-[var(--color-text-strong)]">
                      {item.description}
                    </div>
                    {item.note ? (
                      <div className="mt-1 text-[11px] text-[var(--color-text-subtle)]">
                        {item.note}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Panel>
  );
}

function PaneHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 border-b border-[var(--color-panel-border-strong)] px-3.5">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-[var(--color-text-strong)]">{title}</div>
        <div className="truncate text-[11px] text-[var(--color-text-subtle)]">{description}</div>
      </div>
    </div>
  );
}
