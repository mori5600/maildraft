import { PaneHeader } from "../../../../shared/ui/PaneHeader";
import { Panel, Pill } from "../../../../shared/ui/primitives";
import { HELP_USAGE_GROUPS } from "../../model";

export function UsageGuide() {
  return (
    <Panel className="overflow-hidden">
      <PaneHeader description="MailDraft の基本的な使い方" title="使い方" />

      <div className="grid gap-3 px-3.5 py-3.5">
        <section className="rounded-lg border border-(--color-panel-border-strong) bg-(--color-field-bg) px-3.5 py-3">
          <div className="text-[10px] tracking-[0.14em] text-(--color-text-subtle) uppercase">
            概要
          </div>
          <div className="mt-2.5 space-y-1.5 text-[13px] leading-6 text-(--color-text-muted)">
            <p>
              MailDraft は、日本語のメール本文をローカル保存で整えていくための下書きアプリです。
            </p>
            <p>
              まずは下書きを作り、必要に応じてテンプレートや署名を組み合わせる使い方が基本です。
            </p>
          </div>
        </section>

        {HELP_USAGE_GROUPS.map((group) => (
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
              {group.steps.map((step, index) => (
                <div
                  key={`${group.id}-${step.title}`}
                  className="grid gap-2 rounded-[7px] border border-(--color-panel-border-strong) bg-(--color-field-bg) px-3 py-2.5 md:grid-cols-[40px_minmax(0,1fr)]"
                >
                  <div className="flex items-start">
                    <Pill tone="accent">{index + 1}</Pill>
                  </div>
                  <div>
                    <div className="text-[13px] text-(--color-text-strong)">{step.title}</div>
                    <div className="mt-1 text-xs leading-6 text-(--color-text-muted)">
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
