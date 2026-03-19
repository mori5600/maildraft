import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_OPTIONS = {
  drafts: 180,
  historiesPerDraft: 10,
  paragraphs: 80,
  signatures: 10,
  templates: 48,
  trashedDrafts: 24,
  trashedSignatures: 4,
  trashedTemplates: 12,
  variablePresets: 24,
  output: "tmp/perf/maildraft-perf-backup.json",
};

function parseArgs(argv) {
  const options = { ...DEFAULT_OPTIONS };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const value = argv[index + 1];

    if (value === undefined) {
      throw new Error(`Missing value for --${key}`);
    }

    index += 1;

    switch (key) {
      case "drafts":
      case "histories-per-draft":
      case "paragraphs":
      case "signatures":
      case "templates":
      case "trashed-drafts":
      case "trashed-signatures":
      case "trashed-templates":
      case "variable-presets": {
        const parsed = Number.parseInt(value, 10);
        if (!Number.isFinite(parsed) || parsed < 0) {
          throw new Error(`Invalid numeric value for --${key}: ${value}`);
        }

        options[toCamelCase(key)] = parsed;
        break;
      }
      case "output":
        options.output = value;
        break;
      default:
        throw new Error(`Unknown option: --${key}`);
    }
  }

  return options;
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function timestamp(base, offset) {
  return String(base - offset);
}

function makeId(prefix, index) {
  return `${prefix}-${String(index).padStart(4, "0")}`;
}

function makeVariableValues(index) {
  return {
    company_name: `Company ${String(index).padStart(3, "0")}`,
    contact_name: `Contact ${String(index).padStart(3, "0")}`,
  };
}

function makeBody(kind, index, paragraphs) {
  const lines = [];

  for (let paragraphIndex = 0; paragraphIndex < paragraphs; paragraphIndex += 1) {
    lines.push(
      `${kind} ${String(index).padStart(4, "0")} paragraph ${String(paragraphIndex + 1).padStart(2, "0")}.`,
      "Please review the current status update for {{company_name}} and {{contact_name}}.",
      "This paragraph exists to keep the draft long enough for edit, save, and restore checks.",
      "",
    );
  }

  return lines.join("\n").trim();
}

function createSignature(index, baseTime, { isDefault = false, deletedAt = null } = {}) {
  const id = makeId(isDefault ? "signature-default" : "signature", index);
  const updatedOffset = index * 10_000 + (deletedAt ? 3_000 : 0);

  return {
    id,
    name: isDefault ? "Default Signature" : `Signature ${String(index).padStart(2, "0")}`,
    isPinned: index % 3 === 0,
    body: [
      "MailDraft Inc.",
      `Sales Team ${String(index).padStart(2, "0")}`,
      "Tokyo Office",
    ].join("\n"),
    isDefault,
    createdAt: timestamp(baseTime, updatedOffset + 5_000),
    updatedAt: timestamp(baseTime, updatedOffset),
    ...(deletedAt ? { deletedAt } : {}),
  };
}

function createTemplate(index, signatureId, baseTime, { deletedAt = null } = {}) {
  const updatedOffset = index * 12_000 + (deletedAt ? 4_000 : 0);

  return {
    id: makeId("template", index),
    name: `Performance Template ${String(index).padStart(3, "0")}`,
    isPinned: index % 7 === 0,
    subject: `Follow-up ${String(index).padStart(3, "0")}`,
    recipient: `To: {{contact_name}} / {{company_name}}`,
    opening: "Thank you for your time.",
    body: makeBody("Template", index, 8),
    closing: "Best regards.",
    signatureId,
    createdAt: timestamp(baseTime, updatedOffset + 6_000),
    updatedAt: timestamp(baseTime, updatedOffset),
    ...(deletedAt ? { deletedAt } : {}),
  };
}

function createDraft(index, templateId, signatureId, baseTime, paragraphs) {
  const updatedOffset = index * 20_000;

  return {
    id: makeId("draft", index),
    title: `Performance Draft ${String(index).padStart(4, "0")}`,
    isPinned: index % 9 === 0,
    subject: `Performance Subject ${String(index).padStart(4, "0")}`,
    recipient: `To: {{contact_name}} / {{company_name}}`,
    opening: "Hello,",
    body: makeBody("Draft", index, paragraphs),
    closing: "Regards.",
    templateId,
    signatureId,
    variableValues: makeVariableValues(index),
    createdAt: timestamp(baseTime, updatedOffset + 9_000),
    updatedAt: timestamp(baseTime, updatedOffset),
  };
}

function createDraftHistory(draft, historyIndex, baseTime) {
  const offset = Number.parseInt(draft.updatedAt, 10) - (historyIndex + 1) * 15_000;

  return {
    id: `${draft.id}-history-${String(historyIndex + 1).padStart(2, "0")}`,
    draftId: draft.id,
    title: `${draft.title} revision ${historyIndex + 1}`,
    subject: `${draft.subject} revision ${historyIndex + 1}`,
    recipient: draft.recipient,
    opening: draft.opening,
    body: `${draft.body}\n\nRevision marker ${historyIndex + 1}.`,
    closing: draft.closing,
    templateId: draft.templateId,
    signatureId: draft.signatureId,
    variableValues: draft.variableValues,
    recordedAt: String(offset || Number.parseInt(timestamp(baseTime, (historyIndex + 1) * 15_000), 10)),
  };
}

function createVariablePreset(index, baseTime) {
  const updatedOffset = index * 8_000;

  return {
    id: makeId("preset", index),
    name: `Preset ${String(index).padStart(3, "0")}`,
    values: makeVariableValues(index),
    createdAt: timestamp(baseTime, updatedOffset + 4_000),
    updatedAt: timestamp(baseTime, updatedOffset),
  };
}

function createBackupDocument(options) {
  const baseTime = Date.now();
  const signatures = [];
  const templates = [];
  const drafts = [];
  const draftHistory = [];
  const variablePresets = [];

  for (let index = 1; index <= options.signatures; index += 1) {
    signatures.push(
      createSignature(index, baseTime, {
        isDefault: index === 1,
      }),
    );
  }

  for (let index = 1; index <= options.templates; index += 1) {
    templates.push(
      createTemplate(
        index,
        signatures[(index - 1) % signatures.length]?.id ?? null,
        baseTime,
      ),
    );
  }

  for (let index = 1; index <= options.drafts; index += 1) {
    const templateId = templates[(index - 1) % templates.length]?.id ?? null;
    const signatureId = signatures[(index - 1) % signatures.length]?.id ?? null;
    const draft = createDraft(index, templateId, signatureId, baseTime, options.paragraphs);
    drafts.push(draft);

    for (let historyIndex = 0; historyIndex < options.historiesPerDraft; historyIndex += 1) {
      draftHistory.push(createDraftHistory(draft, historyIndex, baseTime));
    }
  }

  for (let index = 1; index <= options.variablePresets; index += 1) {
    variablePresets.push(createVariablePreset(index, baseTime));
  }

  const trashedSignatures = [];
  for (let index = 1; index <= options.trashedSignatures; index += 1) {
    const deletedAt = timestamp(baseTime, 900_000 + index * 8_000);
    trashedSignatures.push({
      signature: createSignature(options.signatures + index, baseTime, { deletedAt }),
      deletedAt,
    });
  }

  const trashedTemplates = [];
  for (let index = 1; index <= options.trashedTemplates; index += 1) {
    const deletedAt = timestamp(baseTime, 1_200_000 + index * 8_000);
    trashedTemplates.push({
      template: createTemplate(
        options.templates + index,
        signatures[index % signatures.length]?.id ?? null,
        baseTime,
        { deletedAt },
      ),
      deletedAt,
    });
  }

  const trashedDrafts = [];
  for (let index = 1; index <= options.trashedDrafts; index += 1) {
    const templateId = templates[index % templates.length]?.id ?? null;
    const signatureId = signatures[index % signatures.length]?.id ?? null;
    const draft = createDraft(
      options.drafts + index,
      templateId,
      signatureId,
      baseTime,
      Math.max(20, Math.floor(options.paragraphs / 2)),
    );
    const history = [];

    for (let historyIndex = 0; historyIndex < Math.min(4, options.historiesPerDraft); historyIndex += 1) {
      history.push(createDraftHistory(draft, historyIndex, baseTime));
    }

    trashedDrafts.push({
      draft,
      history,
      deletedAt: timestamp(baseTime, 1_500_000 + index * 8_000),
    });
  }

  return {
    app: "maildraft",
    version: 1,
    exportedAtMs: baseTime,
    snapshot: {
      drafts,
      draftHistory,
      variablePresets,
      templates,
      signatures,
      trash: {
        drafts: trashedDrafts,
        templates: trashedTemplates,
        signatures: trashedSignatures,
      },
    },
    settings: {
      logging: {
        mode: "errors_only",
        retentionDays: 14,
      },
    },
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const document = createBackupDocument(options);
  const outputPath = path.resolve(options.output);

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(document, null, 2));

  console.log(`Wrote performance backup to ${outputPath}`);
  console.log(
    JSON.stringify(
      {
        drafts: options.drafts,
        historiesPerDraft: options.historiesPerDraft,
        paragraphs: options.paragraphs,
        templates: options.templates,
        signatures: options.signatures,
        trashedDrafts: options.trashedDrafts,
        trashedTemplates: options.trashedTemplates,
        trashedSignatures: options.trashedSignatures,
        variablePresets: options.variablePresets,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
