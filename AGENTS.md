# AGENTS.md

## Project Overview

- MailDraft is a local-first desktop app for writing email drafts.
- Stack: Tauri v2, React 19, TypeScript, Vite, Tailwind CSS v4, Rust.
- The app manages drafts, templates, signatures, and rendered previews.

## Development Commands

- Install dependencies: `npm install`
- Frontend dev: `npm run dev`
- Tauri dev: `npm run tauri dev`
- Frontend build: `npm run build`
- Lint: `npm run lint`
- Lint with fixes: `npm run lint:fix`
- Format: `npm run format`
- Check formatting: `npm run format:check`
- Rust check: `cargo check --manifest-path src-tauri\\Cargo.toml`
- Production bundle: `npm run tauri build`

## Architecture

### Frontend

- `src/app`: app shell, routes, top-level state
- `src/modules/drafts`: draft models and draft UI
- `src/modules/templates`: template models and template UI
- `src/modules/signatures`: signature models and signature UI
- `src/modules/renderer`: derived preview and validation logic
- `src/shared`: reusable UI primitives and shared utilities

### Backend

- `src-tauri/src/app`: Tauri app wiring and shared state
- `src-tauri/src/modules`: backend modules aligned with frontend domains
- `src-tauri/capabilities`: Tauri capability configuration

## Data and UI Conventions

- Keep the data-oriented structure. Prefer adding code under the relevant domain module instead of creating broad global folders.
- Treat rendered preview data as derived data. Do not store redundant preview text unless there is a strong reason.
- Preserve the current editor-like UI direction: calm, minimal, and dense rather than decorative.
- When changing colors or surfaces, extend the existing CSS variable theme system in `src/App.css`.
- Support both dark and light themes for any new UI work.
- Keep whitespace visualization compatible with normal copy behavior. Visual markers are for display only.

## Existing UX Features

- Draft previews can be copied as plain text.
- Draft, template, and signature previews can be expanded in overlay views.
- Theme switching is persisted locally.
- Whitespace visualization can be toggled on and off.

## Tauri Notes

- If you add a new Tauri plugin, update both Rust registration and capability permissions.
- Clipboard behavior uses `@tauri-apps/plugin-clipboard-manager` in Tauri mode and `navigator.clipboard` in browser fallback mode.
- Prefer app-safe APIs over deprecated browser commands such as `document.execCommand`.

## Validation Checklist

- After making code or documentation changes, always run `npm run format`
- Run `npm run lint`
- Run `npm test`
- Run `npm run build`
- Run `npm run format:check`
- Run `cargo check --manifest-path src-tauri\\Cargo.toml`
- Treat `npm run format` as a required step before finalizing or committing work
- Treat a failing `npm run format:check` as a blocking issue for release-preflight verification
- If formatting needs to be fixed, run `npm run format` and then re-run `npm run format:check`

## Implementation Guidance for Codex

- Make focused changes and preserve the current module boundaries.
- Use `apply_patch` for manual file edits.
- Prefer `rg` for searching.
- Do not overwrite unrelated user changes.
- If you add user-facing behavior, mention how to verify it locally.
- Keep `if` branching as small as reasonably possible. When behavior differs by type, rule, state, or field, first evaluate replacing conditionals with a strategy-based design.
- Preserve the current functional style while reducing branch-heavy orchestration. Prefer data-driven strategy maps, handler tables, and extracted pure functions over long conditional chains.
