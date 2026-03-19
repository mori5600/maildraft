# Performance Checklist

This checklist closes Phase 2 by giving the team a repeatable long-text workload and a short manual verification flow.

## Generate A Performance Backup

Use the built-in generator to create a large local backup that can be imported from the app:

```bash
npm run perf:backup
```

Default output:

```text
tmp/perf/maildraft-perf-backup.json
```

Default dataset:

- 180 active drafts
- 10 history entries per draft
- 48 active templates
- 10 active signatures
- 24 variable presets
- 24 trashed drafts
- 12 trashed templates
- 4 trashed signatures
- 80 paragraphs in each active draft body

Useful overrides:

```bash
npm run perf:backup -- --drafts 240 --histories-per-draft 12 --paragraphs 120
```

## Import The Backup

1. Start the app in Tauri mode.
2. Open `Settings`.
3. Choose `Backup`.
4. Import `tmp/perf/maildraft-perf-backup.json`.

## Manual Checks

Use the generated dataset as-is. The first active draft is `Performance Draft 0001`.

### 1. Long Draft Editing

1. Open `Performance Draft 0001`.
2. Place the caret at the end of the body.
3. Type continuously for 10 to 15 seconds.

Record:

- Whether keystrokes visibly lag behind input
- Whether the draft list stays responsive
- Whether autosave returns to the saved state without a long pause

### 2. Manual Save

1. Change the subject on `Performance Draft 0001`.
2. Click `Save`.

Record:

- Whether the save notice appears without a visible stall
- Whether the edited draft stays selected
- Whether the draft list order updates cleanly

### 3. History Restore

1. Open the history overlay for `Performance Draft 0001`.
2. Restore an older history entry.

Record:

- Whether the restored subject and body appear immediately
- Whether the history overlay stays responsive
- Whether the preview updates without a second full pause

### 4. Trash Restore And Permanent Delete

1. Open `Trash`.
2. Restore one trashed draft.
3. Permanently delete one trashed template.
4. Permanently delete one trashed signature.

Record:

- Whether list updates complete without a visible blank state
- Whether notices appear promptly
- Whether restore and permanent delete behave consistently with larger trash counts

## What To Write Down

Keep the note short and comparable across runs:

- App version or commit
- OS and machine
- Dataset overrides, if any
- Any visible stutter during edit, save, history restore, or trash operations
- Any action that takes long enough to feel broken

## Exit Criteria For Phase 2

Phase 2 is complete when:

- destructive and restore paths no longer depend on full snapshot updates during normal editing flows
- the generated workload can be imported without manual data setup
- the four checks above can be run from this document without extra tribal knowledge
