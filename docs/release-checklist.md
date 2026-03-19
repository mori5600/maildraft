# Release Checklist

This checklist covers the current manual release flow for MailDraft.

## Scope

Use this checklist when publishing a new version such as `v1.1.1` or `v1.2.0`.

## 1. Update Version Targets

Keep these files in sync:

- `package.json`
- `package-lock.json`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`
- `README.md`

## 2. Run Required Checks

Run the standard validation set:

```bash
npm run lint
npm test
cargo test --manifest-path src-tauri/Cargo.toml
```

Run frontend production build if the release changed UI or packaging-adjacent code:

```bash
npm run build
```

## 3. Verify On Real Machines

MailDraft uses manual release verification instead of a dedicated release build workflow.

Check on Windows:

- The app boots cleanly
- A draft can be edited and saved
- Trash restore works
- Backup export and import work

Check on macOS:

- The app boots cleanly
- A draft can be edited and saved
- The basic workspace flow still works

## 4. Prepare Release Notes

Keep release notes short and user-facing.

- Summarize user-visible improvements
- Mention compatibility only when it changed
- Mention Windows unsigned warning only when needed

## 5. Publish Assets

Current release policy:

- Publish the Windows `setup.exe`
- Do not publish the MSI until locale and distribution policy require it
- Do not publish macOS artifacts yet

## 6. Publish The Release

1. Push the release commit to `main`
2. Create the Git tag in `vX.Y.Z` form
3. Create the GitHub Release
4. Attach the Windows `setup.exe`
5. Paste the release notes

## 7. After Publishing

- Confirm the release page points at the intended tag
- Confirm the attached asset matches the released version number
- Confirm README still shows the current app version
