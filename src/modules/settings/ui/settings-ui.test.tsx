import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  createLogEntry,
  createLoggingSettingsInput,
  createLoggingSettingsSnapshot,
} from "../../../test/ui-fixtures";
import { BackupPane } from "./panes/BackupPane";
import { LoggingOverviewPane } from "./panes/LoggingOverviewPane";
import { LoggingSettingsPane } from "./panes/LoggingSettingsPane";
import { RecentLogsContent } from "./panes/RecentLogsContent";
import { SettingsSectionNav } from "./panes/SettingsSectionNav";
import { RECENT_LOGS_DESCRIPTION } from "./settings-workspace-content";
import { SettingsWorkspace } from "./SettingsWorkspace";

describe("settings UI", () => {
  it("renders settings navigation", async () => {
    const user = userEvent.setup();
    const handleSelectSection = vi.fn();
    render(<SettingsSectionNav activeSection="logging" onSelectSection={handleSelectSection} />);

    await user.click(screen.getByRole("button", { name: /バックアップ/ }));
    expect(handleSelectSection).toHaveBeenCalledWith("backup");
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

  it("connects settings workspace overlay", async () => {
    const user = userEvent.setup();
    const handleRefreshRecentLogs = vi.fn(async () => {});
    render(
      <SettingsWorkspace
        isExportingBackup={false}
        isImportingBackup={false}
        isLoadingRecentLogs={false}
        loggingForm={createLoggingSettingsInput()}
        loggingSettings={createLoggingSettingsSnapshot()}
        recentLogs={[createLogEntry()]}
        onChangeLogging={vi.fn()}
        onClearLogs={vi.fn(async () => {})}
        onExportBackup={vi.fn(async () => {})}
        onImportBackup={vi.fn(async () => {})}
        onRefreshRecentLogs={handleRefreshRecentLogs}
        onSaveLoggingSettings={vi.fn(async () => {})}
      />,
    );

    expect(screen.getByText("ログ設定")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "ログを見る" }));
    expect(screen.getByText("最近のログ")).toBeInTheDocument();
    expect(screen.getByText(RECENT_LOGS_DESCRIPTION)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "更新" }));
    expect(handleRefreshRecentLogs).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /バックアップ/ }));
    expect(screen.getByRole("button", { name: "書き出し" })).toBeInTheDocument();
  });
});
