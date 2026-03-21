import { PaneHeader } from "../../../../shared/ui/PaneHeader";
import { Button, Field, Panel, Select } from "../../../../shared/ui/primitives";
import {
  LOGGING_MODE_OPTIONS,
  loggingModeDescription,
  type LoggingSettingsInput,
  type LoggingSettingsSnapshot,
  RETENTION_DAY_OPTIONS,
} from "../../model";

interface LoggingSettingsPaneProps {
  isDirty: boolean;
  loggingSettings: LoggingSettingsSnapshot;
  loggingForm: LoggingSettingsInput;
  onChangeLogging: <K extends keyof LoggingSettingsInput>(
    field: K,
    value: LoggingSettingsInput[K],
  ) => void;
  onSaveLoggingSettings: () => Promise<void>;
}

export function LoggingSettingsPane({
  isDirty,
  loggingSettings,
  loggingForm,
  onChangeLogging,
  onSaveLoggingSettings,
}: LoggingSettingsPaneProps) {
  return (
    <Panel className="overflow-hidden">
      <PaneHeader
        action={
          <Button
            disabled={!isDirty}
            size="sm"
            title="Ctrl/Cmd+S"
            variant="primary"
            onClick={() => void onSaveLoggingSettings()}
          >
            保存
          </Button>
        }
        description="診断ログに何を残すかを決めます。"
        title="ログ設定"
      />

      <div className="px-3.5 py-3.5">
        <div className="grid gap-3">
          <section className="rounded-lg border border-(--color-panel-border-strong) bg-(--color-field-bg) px-3.5 py-3">
            <div className="text-[10px] tracking-[0.14em] text-(--color-text-subtle) uppercase">
              記録しない内容
            </div>
            <div className="mt-2.5 space-y-1.5 text-[13px] leading-6 text-(--color-text-muted)">
              <p>件名、本文、宛先、署名本文、クリップボードの内容はログへ保存しません。</p>
              <p>
                記録するのは、処理の成功・失敗、所要時間、件数や文字数のような要約情報だけです。
              </p>
            </div>
          </section>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="記録レベル" hint={loggingModeDescription(loggingForm.mode)}>
              <Select
                value={loggingForm.mode}
                onChange={(event) =>
                  onChangeLogging("mode", event.currentTarget.value as LoggingSettingsInput["mode"])
                }
              >
                {LOGGING_MODE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="保存期間">
              <Select
                value={String(loggingForm.retentionDays)}
                onChange={(event) =>
                  onChangeLogging(
                    "retentionDays",
                    Number(event.currentTarget.value) as LoggingSettingsInput["retentionDays"],
                  )
                }
              >
                {RETENTION_DAY_OPTIONS.map((days) => (
                  <option key={days} value={days}>
                    {days}日
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <section className="rounded-lg border border-(--color-panel-border-strong) bg-(--color-field-bg) px-3.5 py-3">
            <div className="text-[10px] tracking-[0.14em] text-(--color-text-subtle) uppercase">
              現在の設定
            </div>
            <div className="mt-2.5 text-[13px] leading-6 text-(--color-text-muted)">
              {loggingModeDescription(loggingSettings.mode)} 保持期間は{" "}
              {loggingSettings.retentionDays}
              日です。
            </div>
          </section>
        </div>
      </div>
    </Panel>
  );
}
