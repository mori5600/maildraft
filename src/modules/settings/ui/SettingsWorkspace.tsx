import { useState } from "react";

import { PreviewOverlay } from "../../../shared/ui/PreviewOverlay";
import { Button } from "../../../shared/ui/primitives";
import type {
  EditorSettingsInput,
  EditorSettingsSnapshot,
  LogEntrySnapshot,
  LoggingSettingsInput,
  LoggingSettingsSnapshot,
  ProofreadingSettingsSnapshot,
} from "../model";
import { BackupPane } from "./panes/BackupPane";
import { EditorSettingsPane } from "./panes/EditorSettingsPane";
import { LoggingOverviewPane } from "./panes/LoggingOverviewPane";
import { LoggingSettingsPane } from "./panes/LoggingSettingsPane";
import { ProofreadingSettingsPane } from "./panes/ProofreadingSettingsPane";
import { RecentLogsContent } from "./panes/RecentLogsContent";
import { SettingsSectionNav } from "./panes/SettingsSectionNav";
import { RECENT_LOGS_DESCRIPTION, type SettingsSection } from "./settings-workspace-content";

interface SettingsWorkspaceProps {
  activeSection: SettingsSection;
  editorForm: EditorSettingsInput;
  editorSettings: EditorSettingsSnapshot;
  isExportingBackup: boolean;
  isImportingBackup: boolean;
  isSavingEditorSettings: boolean;
  isSavingProofreadingSettings: boolean;
  loggingSettings: LoggingSettingsSnapshot;
  loggingForm: LoggingSettingsInput;
  proofreadingSettings: ProofreadingSettingsSnapshot;
  recentLogs: LogEntrySnapshot[];
  isLoadingRecentLogs: boolean;
  onChangeEditor: <K extends keyof EditorSettingsInput>(
    field: K,
    value: EditorSettingsInput[K],
  ) => void;
  onChangeLogging: <K extends keyof LoggingSettingsInput>(
    field: K,
    value: LoggingSettingsInput[K],
  ) => void;
  onSelectSection: (section: SettingsSection) => void;
  onExportBackup: () => Promise<void>;
  onImportBackup: () => Promise<void>;
  onEnableProofreadingRule: (ruleId: string) => Promise<void>;
  onResetDisabledProofreadingRules: () => Promise<void>;
  onSaveEditorSettings: () => Promise<void>;
  onSaveLoggingSettings: () => Promise<void>;
  onClearLogs: () => Promise<void>;
  onRefreshRecentLogs: (options?: { silent?: boolean }) => Promise<void>;
}

export function SettingsWorkspace({
  activeSection,
  editorForm,
  editorSettings,
  isExportingBackup,
  isImportingBackup,
  isSavingEditorSettings,
  isSavingProofreadingSettings,
  loggingSettings,
  loggingForm,
  proofreadingSettings,
  recentLogs,
  isLoadingRecentLogs,
  onChangeEditor,
  onChangeLogging,
  onSelectSection,
  onExportBackup,
  onImportBackup,
  onEnableProofreadingRule,
  onResetDisabledProofreadingRules,
  onSaveEditorSettings,
  onSaveLoggingSettings,
  onClearLogs,
  onRefreshRecentLogs,
}: SettingsWorkspaceProps) {
  const [isLogViewerOpen, setIsLogViewerOpen] = useState(false);
  const isEditorDirty =
    editorForm.indentStyle !== editorSettings.indentStyle ||
    editorForm.tabSize !== editorSettings.tabSize;
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
        <SettingsSectionNav activeSection={activeSection} onSelectSection={onSelectSection} />

        <div className="min-h-0 overflow-y-auto">
          {activeSection === "editor" ? (
            <div className="grid content-start gap-3">
              <EditorSettingsPane
                editorForm={editorForm}
                editorSettings={editorSettings}
                isDirty={isEditorDirty}
                isSaving={isSavingEditorSettings}
                onChangeEditor={onChangeEditor}
                onSaveEditorSettings={onSaveEditorSettings}
              />
            </div>
          ) : activeSection === "logging" ? (
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
