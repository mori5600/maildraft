import { useState } from "react";

import { PreviewOverlay } from "../../../shared/ui/PreviewOverlay";
import { Button } from "../../../shared/ui/primitives";
import type {
  LogEntrySnapshot,
  LoggingSettingsInput,
  LoggingSettingsSnapshot,
  ProofreadingSettingsSnapshot,
} from "../model";
import { BackupPane } from "./panes/BackupPane";
import { LoggingOverviewPane } from "./panes/LoggingOverviewPane";
import { LoggingSettingsPane } from "./panes/LoggingSettingsPane";
import { ProofreadingSettingsPane } from "./panes/ProofreadingSettingsPane";
import { RecentLogsContent } from "./panes/RecentLogsContent";
import { SettingsSectionNav } from "./panes/SettingsSectionNav";
import { RECENT_LOGS_DESCRIPTION, type SettingsSection } from "./settings-workspace-content";

interface SettingsWorkspaceProps {
  isExportingBackup: boolean;
  isImportingBackup: boolean;
  isSavingProofreadingSettings: boolean;
  loggingSettings: LoggingSettingsSnapshot;
  loggingForm: LoggingSettingsInput;
  proofreadingSettings: ProofreadingSettingsSnapshot;
  recentLogs: LogEntrySnapshot[];
  isLoadingRecentLogs: boolean;
  onChangeLogging: <K extends keyof LoggingSettingsInput>(
    field: K,
    value: LoggingSettingsInput[K],
  ) => void;
  onExportBackup: () => Promise<void>;
  onImportBackup: () => Promise<void>;
  onEnableProofreadingRule: (ruleId: string) => Promise<void>;
  onResetDisabledProofreadingRules: () => Promise<void>;
  onSaveLoggingSettings: () => Promise<void>;
  onClearLogs: () => Promise<void>;
  onRefreshRecentLogs: (options?: { silent?: boolean }) => Promise<void>;
}

export function SettingsWorkspace({
  isExportingBackup,
  isImportingBackup,
  isSavingProofreadingSettings,
  loggingSettings,
  loggingForm,
  proofreadingSettings,
  recentLogs,
  isLoadingRecentLogs,
  onChangeLogging,
  onExportBackup,
  onImportBackup,
  onEnableProofreadingRule,
  onResetDisabledProofreadingRules,
  onSaveLoggingSettings,
  onClearLogs,
  onRefreshRecentLogs,
}: SettingsWorkspaceProps) {
  const [isLogViewerOpen, setIsLogViewerOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<SettingsSection>("logging");
  const isDirty =
    loggingForm.mode !== loggingSettings.mode ||
    loggingForm.retentionDays !== loggingSettings.retentionDays;

  function openLogViewer() {
    setIsLogViewerOpen(true);
    void onRefreshRecentLogs({ silent: true });
  }

  return (
    <>
      <div className="grid h-full min-h-0 gap-3 overflow-y-auto pr-1 lg:grid-cols-[188px_minmax(0,1fr)] lg:overflow-hidden lg:pr-0">
        <SettingsSectionNav activeSection={activeSection} onSelectSection={setActiveSection} />

        <div className="min-h-0 overflow-y-auto">
          {activeSection === "logging" ? (
            <div className="grid content-start gap-3">
              <LoggingSettingsPane
                isDirty={isDirty}
                loggingForm={loggingForm}
                loggingSettings={loggingSettings}
                onChangeLogging={onChangeLogging}
                onSaveLoggingSettings={onSaveLoggingSettings}
              />
              <LoggingOverviewPane
                loggingSettings={loggingSettings}
                onClearLogs={onClearLogs}
                onOpenLogViewer={openLogViewer}
              />
            </div>
          ) : activeSection === "proofreading" ? (
            <div className="grid content-start gap-3">
              <ProofreadingSettingsPane
                disabledRuleIds={proofreadingSettings.disabledRuleIds}
                isSaving={isSavingProofreadingSettings}
                onEnableRule={onEnableProofreadingRule}
                onResetRules={onResetDisabledProofreadingRules}
              />
            </div>
          ) : (
            <div className="grid content-start gap-3">
              <BackupPane
                isExportingBackup={isExportingBackup}
                isImportingBackup={isImportingBackup}
                onExportBackup={onExportBackup}
                onImportBackup={onImportBackup}
              />
            </div>
          )}
        </div>
      </div>

      <PreviewOverlay
        action={
          <Button
            disabled={isLoadingRecentLogs}
            size="sm"
            variant="secondary"
            onClick={() => void onRefreshRecentLogs()}
          >
            {isLoadingRecentLogs ? "更新中" : "更新"}
          </Button>
        }
        description={RECENT_LOGS_DESCRIPTION}
        isOpen={isLogViewerOpen}
        title="最近のログ"
        onClose={() => setIsLogViewerOpen(false)}
      >
        <RecentLogsContent isLoadingRecentLogs={isLoadingRecentLogs} recentLogs={recentLogs} />
      </PreviewOverlay>
    </>
  );
}
