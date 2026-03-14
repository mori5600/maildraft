import { PaneHeader } from "../../../../shared/ui/PaneHeader";
import { Panel, Pill } from "../../../../shared/ui/primitives";
import { KEYBOARD_SHORTCUT_GROUPS } from "../../model";

export function ShortcutGuide() {
  return (
    <Panel className="overflow-hidden">
      <PaneHeader description="現在使えるキーボードショートカット" title="ショートカット一覧" />

      <div className="grid gap-3 px-3.5 py-3.5">
        <section className="rounded-lg border border-(--color-panel-border-strong) bg-(--color-field-bg) px-3.5 py-3">
          <div className="text-[10px] tracking-[0.14em] text-(--color-text-subtle) uppercase">
            補足
          </div>
          <div className="mt-2.5 space-y-1.5 text-[13px] leading-6 text-(--color-text-muted)">
            <p>Windows では Ctrl、macOS では Cmd で使えます。</p>
            <p>日本語 IME の変換中は、ショートカットが誤発火しないように無効化しています。</p>
          </div>
        </section>

        {KEYBOARD_SHORTCUT_GROUPS.map((group) => (
          <section
            key={group.id}
            className="rounded-lg border border-(--color-panel-border-strong) bg-(--color-panel-bg)"
          >
            <div className="border-b border-(--color-panel-border-strong) px-3.5 py-3">
              <div className="text-[13px] font-medium text-(--color-text-strong)">
                {group.title}
              </div>
              <div className="mt-1 text-[11px] text-(--color-text-subtle)">{group.description}</div>
            </div>

            <div className="grid gap-2 px-3.5 py-3">
              {group.items.map((item) => (
                <div
                  key={item.keys}
                  className="grid gap-2 rounded-[7px] border border-(--color-panel-border-strong) bg-(--color-field-bg) px-3 py-2.5 md:grid-cols-[170px_minmax(0,1fr)] md:items-start"
                >
                  <div className="flex items-center">
                    <Pill tone="accent">{item.keys}</Pill>
                  </div>
                  <div>
                    <div className="text-[13px] text-(--color-text-strong)">{item.description}</div>
                    {item.note ? (
                      <div className="mt-1 text-[11px] text-(--color-text-subtle)">{item.note}</div>
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
