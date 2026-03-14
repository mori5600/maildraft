import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DraftInput } from "../../modules/drafts/model";
import type { VariablePresetInput } from "../../modules/drafts/variable-presets";
import type { LoggingSettingsInput } from "../../modules/settings/model";
import type { SignatureInput } from "../../modules/signatures/model";
import type { TemplateInput } from "../../modules/templates/model";

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

import { maildraftApi } from "./maildraft-api";

const DRAFT_INPUT: DraftInput = {
  id: "draft-1",
  title: "件名候補",
  isPinned: false,
  subject: "ご相談",
  recipient: "株式会社〇〇",
  opening: "お世話になっております。",
  body: "本文です。",
  closing: "よろしくお願いいたします。",
  templateId: "template-1",
  signatureId: "signature-1",
  variableValues: {
    担当者名: "山田様",
  },
};

const VARIABLE_PRESET_INPUT: VariablePresetInput = {
  id: "preset-1",
  name: "株式会社〇〇向け",
  values: {
    会社名: "株式会社〇〇",
    担当者名: "山田様",
  },
};

const TEMPLATE_INPUT: TemplateInput = {
  id: "template-1",
  name: "初回連絡",
  isPinned: true,
  subject: "ご連絡ありがとうございます",
  recipient: "株式会社〇〇",
  opening: "お世話になっております。",
  body: "本文です。",
  closing: "よろしくお願いいたします。",
  signatureId: "signature-1",
};

const SIGNATURE_INPUT: SignatureInput = {
  id: "signature-1",
  name: "基本署名",
  isPinned: false,
  body: "株式会社△△\n山田 太郎",
  isDefault: true,
};

const LOGGING_SETTINGS_INPUT: LoggingSettingsInput = {
  mode: "errors_only",
  retentionDays: 14,
};

describe("maildraftApi", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it.each([
    {
      expectedArgs: ["load_snapshot"],
      run: () => maildraftApi.loadSnapshot(),
    },
    {
      expectedArgs: ["save_draft", { input: DRAFT_INPUT }],
      run: () => maildraftApi.saveDraft(DRAFT_INPUT),
    },
    {
      expectedArgs: ["delete_draft", { id: "draft-1" }],
      run: () => maildraftApi.deleteDraft("draft-1"),
    },
    {
      expectedArgs: ["restore_draft_from_trash", { id: "draft-1" }],
      run: () => maildraftApi.restoreDraftFromTrash("draft-1"),
    },
    {
      expectedArgs: ["permanently_delete_draft_from_trash", { id: "draft-1" }],
      run: () => maildraftApi.permanentlyDeleteDraftFromTrash("draft-1"),
    },
    {
      expectedArgs: ["restore_draft_history", { draftId: "draft-1", historyId: "history-1" }],
      run: () => maildraftApi.restoreDraftHistory("draft-1", "history-1"),
    },
    {
      expectedArgs: ["save_variable_preset", { input: VARIABLE_PRESET_INPUT }],
      run: () => maildraftApi.saveVariablePreset(VARIABLE_PRESET_INPUT),
    },
    {
      expectedArgs: ["delete_variable_preset", { id: "preset-1" }],
      run: () => maildraftApi.deleteVariablePreset("preset-1"),
    },
    {
      expectedArgs: ["save_template", { input: TEMPLATE_INPUT }],
      run: () => maildraftApi.saveTemplate(TEMPLATE_INPUT),
    },
    {
      expectedArgs: ["delete_template", { id: "template-1" }],
      run: () => maildraftApi.deleteTemplate("template-1"),
    },
    {
      expectedArgs: ["restore_template_from_trash", { id: "template-1" }],
      run: () => maildraftApi.restoreTemplateFromTrash("template-1"),
    },
    {
      expectedArgs: ["permanently_delete_template_from_trash", { id: "template-1" }],
      run: () => maildraftApi.permanentlyDeleteTemplateFromTrash("template-1"),
    },
    {
      expectedArgs: ["save_signature", { input: SIGNATURE_INPUT }],
      run: () => maildraftApi.saveSignature(SIGNATURE_INPUT),
    },
    {
      expectedArgs: ["delete_signature", { id: "signature-1" }],
      run: () => maildraftApi.deleteSignature("signature-1"),
    },
    {
      expectedArgs: ["restore_signature_from_trash", { id: "signature-1" }],
      run: () => maildraftApi.restoreSignatureFromTrash("signature-1"),
    },
    {
      expectedArgs: ["permanently_delete_signature_from_trash", { id: "signature-1" }],
      run: () => maildraftApi.permanentlyDeleteSignatureFromTrash("signature-1"),
    },
    {
      expectedArgs: ["empty_trash"],
      run: () => maildraftApi.emptyTrash(),
    },
    {
      expectedArgs: ["load_logging_settings"],
      run: () => maildraftApi.loadLoggingSettings(),
    },
    {
      expectedArgs: ["export_backup", { path: "/tmp/backup.json" }],
      run: () => maildraftApi.exportBackup("/tmp/backup.json"),
    },
    {
      expectedArgs: ["import_backup", { path: "/tmp/backup.json" }],
      run: () => maildraftApi.importBackup("/tmp/backup.json"),
    },
    {
      expectedArgs: ["load_recent_logs", { limit: 25 }],
      run: () => maildraftApi.loadRecentLogs(25),
    },
    {
      expectedArgs: ["load_recent_logs", { limit: undefined }],
      run: () => maildraftApi.loadRecentLogs(),
    },
    {
      expectedArgs: ["save_logging_settings", { input: LOGGING_SETTINGS_INPUT }],
      run: () => maildraftApi.saveLoggingSettings(LOGGING_SETTINGS_INPUT),
    },
    {
      expectedArgs: ["clear_logs"],
      run: () => maildraftApi.clearLogs(),
    },
  ])("invoke payloads stay aligned with Tauri commands", async ({ expectedArgs, run }) => {
    const expectedResult = { ok: true };
    invokeMock.mockResolvedValue(expectedResult);

    await expect(run()).resolves.toBe(expectedResult);
    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith(...expectedArgs);
  });
});
