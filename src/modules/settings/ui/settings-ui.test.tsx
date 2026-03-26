import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  createEditorSettingsInput,
  createEditorSettingsSnapshot,
  createLogEntry,
  createLoggingSettingsInput,
  createLoggingSettingsSnapshot,
  createProofreadingSettingsSnapshot,
} from "../../../test/ui-fixtures";
import { BackupPane } from "./panes/BackupPane";
import { EditorSettingsPane } from "./panes/EditorSettingsPane";
import { LoggingOverviewPane } from "./panes/LoggingOverviewPane";
import { LoggingSettingsPane } from "./panes/LoggingSettingsPane";
import { ProofreadingSettingsPane } from "./panes/ProofreadingSettingsPane";
import { RecentLogsContent } from "./panes/RecentLogsContent";
import { SettingsSectionNav } from "./panes/SettingsSectionNav";
import { RECENT_LOGS_DESCRIPTION } from "./settings-workspace-content";
import { SettingsWorkspace } from "./SettingsWorkspace";

describe("settings UI", () => {
  it("renders settings navigation including the editor section", async () => {
    const user = userEvent.setup();
    const handleSelectSection = vi.fn();
    render(<SettingsSectionNav activeSection="editor" onSelectSection={handleSelectSection} />);

    await user.click(screen.getByRole("button", { name: /ログ/ }));
    expect(handleSelectSection).toHaveBeenCalledWith("logging");
    await user.click(screen.getByRole("button", { name: /校正/ }));
    expect(handleSelectSection).toHaveBeenCalledWith("proofreading");
    await user.click(screen.getByRole("button", { name: /バックアップ/ }));
    expect(handleSelectSection).toHaveBeenCalledWith("backup");
  });

  it("handles editor settings changes and save actions", async () => {
    const user = userEvent.setup();
    const handleChangeEditor = vi.fn();
    const handleSaveEditorSettings = vi.fn(async () => {});

    render(
      <EditorSettingsPane
        editorForm={createEditorSettingsInput()}
        editorSettings={createEditorSettingsSnapshot()}
        isDirty
        isSaving={false}
        onChangeEditor={handleChangeEditor}
        onSaveEditorSettings={handleSaveEditorSettings}
      />,
    );

    await user.selectOptions(screen.getByLabelText("インデント種別"), "tabs");
    expect(handleChangeEditor).toHaveBeenCalledWith("indentStyle", "tabs");
    await user.selectOptions(screen.getByLabelText("タブ幅"), "4");
    expect(handleChangeEditor).toHaveBeenCalledWith("tabSize", 4);
    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(handleSaveEditorSettings).toHaveBeenCalled();
    expect(screen.getByText("プレビュー")).toBeInTheDocument();
  });

  it("handles logging settings and overview actions", async () => {
    const user = userEvent.setup();
    const handleChangeLogging = vi.fn();
    const handleSaveLoggingSettings = vi.fn(async () => {});
    const handleOpenLogViewer = vi.fn();
    const handleClearLogs = vi.fn(async () => {});

    render(
      <>
        <LoggingSettingsPane
          isDirty
          loggingForm={createLoggingSettingsInput()}
          loggingSettings={createLoggingSettingsSnapshot()}
          onChangeLogging={handleChangeLogging}
          onSaveLoggingSettings={handleSaveLoggingSettings}
        />
        <LoggingOverviewPane
          loggingSettings={createLoggingSettingsSnapshot()}
          onClearLogs={handleClearLogs}
          onOpenLogViewer={handleOpenLogViewer}
        />
      </>,
    );

    await user.selectOptions(screen.getAllByRole("combobox")[0], "standard");
    expect(handleChangeLogging).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(handleSaveLoggingSettings).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "ログを見る" }));
    expect(handleOpenLogViewer).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "ログを削除" }));
    expect(handleClearLogs).toHaveBeenCalled();
  });

  it("renders backup pane and recent logs content", async () => {
    const user = userEvent.setup();
    const handleExportBackup = vi.fn(async () => {});
    const handleImportBackup = vi.fn(async () => {});
    render(
      <>
        <BackupPane
          isExportingBackup={false}
          isImportingBackup={false}
          onExportBackup={handleExportBackup}
          onImportBackup={handleImportBackup}
        />
        <RecentLogsContent
          isLoadingRecentLogs={false}
          recentLogs={[createLogEntry({ safeContext: { foo: "bar" } })]}
        />
      </>,
    );

    await user.click(screen.getByRole("button", { name: "書き出し" }));
    expect(handleExportBackup).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "読み込み" }));
    expect(handleImportBackup).toHaveBeenCalled();
    expect(screen.getByText("save_draft")).toBeInTheDocument();
    expect(screen.getByText("foo: bar")).toBeInTheDocument();
  });

  it("renders proofreading settings and enable actions", async () => {
    const user = userEvent.setup();
    const handleEnableRule = vi.fn(async () => {});
    const handleResetRules = vi.fn(async () => {});

    render(
      <ProofreadingSettingsPane
        disabledRuleIds={
          createProofreadingSettingsSnapshot({
            disabledRuleIds: ["prh", "whitespace.trailing"],
          }).disabledRuleIds
        }
        isSaving={false}
        onEnableRule={handleEnableRule}
        onResetRules={handleResetRules}
      />,
    );

    expect(screen.getByText("prh 言い換え")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "有効化" })[0]!);
    expect(handleEnableRule).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "すべて有効化" }));
    expect(handleResetRules).toHaveBeenCalled();
  });

  it("connects settings workspace overlay and section switching", async () => {
    const user = userEvent.setup();
    const handleChangeEditor = vi.fn();
    const handleSelectSection = vi.fn();
    const handleRefreshRecentLogs = vi.fn(async () => {});

    render(
      <SettingsWorkspace
        activeSection="editor"
        editorForm={createEditorSettingsInput()}
        editorSettings={createEditorSettingsSnapshot()}
        isExportingBackup={false}
        isImportingBackup={false}
        isLoadingRecentLogs={false}
        isSavingEditorSettings={false}
        isSavingProofreadingSettings={false}
        loggingForm={createLoggingSettingsInput()}
        loggingSettings={createLoggingSettingsSnapshot()}
        proofreadingSettings={createProofreadingSettingsSnapshot()}
        recentLogs={[createLogEntry()]}
        onChangeEditor={handleChangeEditor}
        onChangeLogging={vi.fn()}
        onClearLogs={vi.fn(async () => {})}
        onEnableProofreadingRule={vi.fn(async () => {})}
        onExportBackup={vi.fn(async () => {})}
        onImportBackup={vi.fn(async () => {})}
        onResetDisabledProofreadingRules={vi.fn(async () => {})}
        onRefreshRecentLogs={handleRefreshRecentLogs}
        onSaveEditorSettings={vi.fn(async () => {})}
        onSaveLoggingSettings={vi.fn(async () => {})}
        onSelectSection={handleSelectSection}
      />,
    );

    expect(screen.getByText("エディタ設定")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("インデント種別"), "tabs");
    expect(handleChangeEditor).toHaveBeenCalledWith("indentStyle", "tabs");

    await user.click(screen.getByRole("button", { name: /ログ/ }));
    expect(handleSelectSection).toHaveBeenCalledWith("logging");
  });

  it("opens recent logs overlay from the logging section", async () => {
    const user = userEvent.setup();

    render(
      <SettingsWorkspace
        activeSection="logging"
        editorForm={createEditorSettingsInput()}
        editorSettings={createEditorSettingsSnapshot()}
        isExportingBackup={false}
        isImportingBackup={false}
        isLoadingRecentLogs={false}
        isSavingEditorSettings={false}
        isSavingProofreadingSettings={false}
        loggingForm={createLoggingSettingsInput()}
        loggingSettings={createLoggingSettingsSnapshot()}
        proofreadingSettings={createProofreadingSettingsSnapshot()}
        recentLogs={[createLogEntry()]}
        onChangeEditor={vi.fn()}
        onChangeLogging={vi.fn()}
        onClearLogs={vi.fn(async () => {})}
        onEnableProofreadingRule={vi.fn(async () => {})}
        onExportBackup={vi.fn(async () => {})}
        onImportBackup={vi.fn(async () => {})}
        onResetDisabledProofreadingRules={vi.fn(async () => {})}
        onRefreshRecentLogs={vi.fn(async () => {})}
        onSaveEditorSettings={vi.fn(async () => {})}
        onSaveLoggingSettings={vi.fn(async () => {})}
        onSelectSection={vi.fn()}
      />,
    );

    expect(screen.getByText("ログ設定")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "ログを見る" }));
    expect(screen.getByText("最近のログ")).toBeInTheDocument();
    expect(screen.getByText(RECENT_LOGS_DESCRIPTION)).toBeInTheDocument();
  });
});
