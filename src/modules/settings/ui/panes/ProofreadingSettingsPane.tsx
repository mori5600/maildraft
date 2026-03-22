import { PaneHeader } from "../../../../shared/ui/PaneHeader";
import { Button, Panel } from "../../../../shared/ui/primitives";
import { draftProofreadingRuleLabel } from "../../../drafts/proofreading/model";

interface ProofreadingSettingsPaneProps {
  disabledRuleIds: string[];
  isSaving: boolean;
  onEnableRule: (ruleId: string) => Promise<void>;
  onResetRules: () => Promise<void>;
}

export function ProofreadingSettingsPane({
  disabledRuleIds,
  isSaving,
  onEnableRule,
  onResetRules,
}: ProofreadingSettingsPaneProps) {
  return (
    <Panel className="overflow-hidden">
      <PaneHeader
        action={
          <Button
            disabled={disabledRuleIds.length === 0 || isSaving}
            size="sm"
            variant="secondary"
            onClick={() => void onResetRules()}
          >
            すべて有効化
          </Button>
        }
        description="下書き画面で無効化した校正ルールを管理します。"
        title="校正ルール"
      />

      <div className="px-3.5 py-3.5">
        <div className="grid gap-3">
          <section className="rounded-lg border border-(--color-panel-border-strong) bg-(--color-field-bg) px-3.5 py-3">
            <div className="text-[10px] tracking-[0.14em] text-(--color-text-subtle) uppercase">
              現在の状態
            </div>
            <div className="mt-2.5 text-[13px] leading-6 text-(--color-text-muted)">
              無効化中のルールは {disabledRuleIds.length}{" "}
              件です。下書き画面では候補一覧に表示しません。
            </div>
          </section>

          {disabledRuleIds.length === 0 ? (
            <section className="rounded-lg border border-(--color-success-border) bg-(--color-success-bg) px-3.5 py-3 text-[13px] leading-6 text-(--color-success-text)">
              無効化されている校正ルールはありません。
            </section>
          ) : (
            <div className="space-y-2">
              {disabledRuleIds.map((ruleId) => (
                <section
                  key={ruleId}
                  className="rounded-lg border border-(--color-panel-border-strong) bg-(--color-field-bg) px-3.5 py-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium text-(--color-text-strong)">
                        {draftProofreadingRuleLabel(ruleId)}
                      </div>
                      <code className="mt-1 block text-xs leading-5 text-(--color-text-muted)">
                        {ruleId}
                      </code>
                    </div>
                    <Button
                      disabled={isSaving}
                      size="sm"
                      variant="ghost"
                      onClick={() => void onEnableRule(ruleId)}
                    >
                      有効化
                    </Button>
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}
