import "./App.css";

import { useMaildraftApp } from "./app/state/use-maildraft-app";
import type { WorkspaceView } from "./shared/types/store";
import { Button, Panel } from "./shared/ui/primitives";

function App() {
  const app = useMaildraftApp();
  const supportsWhitespace = app.view !== "settings";
  const viewTitle = getViewTitle(app.view);
  const viewDescription = getViewDescription(app.view);

  if (app.isLoading) {
    return (
      <main className="min-h-screen bg-[var(--color-app-bg)] px-6 py-6 text-[var(--color-text)]">
        <div className="mx-auto max-w-4xl">
          <Panel className="px-6 py-5">
            <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--color-text-faint)]">
              MailDraft
            </div>
            <h1 className="mt-3 text-lg font-medium text-[var(--color-text-strong)]">
              ローカルワークスペースを起動しています
            </h1>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              下書き、テンプレート、署名を読み込み中です。
            </p>
          </Panel>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--color-app-bg)] text-[var(--color-text)]">
      <div className="grid min-h-screen grid-cols-[176px_minmax(0,1fr)]">
        <aside className="flex min-h-screen flex-col border-r border-[var(--color-sidebar-border)] bg-[var(--color-sidebar-bg)] px-2 py-2.5">
          <div className="px-2.5 py-2">
            <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--color-text-faint)]">
              MailDraft
            </div>
            <div className="mt-1.5 text-[13px] font-medium text-[var(--color-text-strong)]">
              Workspace
            </div>
          </div>

          <nav className="mt-2.5 space-y-1">
            {app.views.map((item) => {
              const active = app.view === item.id;

              return (
                <button
                  key={item.id}
                  className={`flex w-full items-center justify-between rounded-[7px] px-2.5 py-1.5 text-left transition-colors ${
                    active
                      ? "bg-[var(--color-nav-active-bg)] text-[var(--color-text-strong)]"
                      : "text-[var(--color-text-muted)] hover:bg-[var(--color-nav-hover-bg)] hover:text-[var(--color-text)]"
                  }`}
                  onClick={() => app.setView(item.id)}
                  type="button"
                >
                  <span className="text-[13px] font-medium">{item.label}</span>
                  {typeof item.count === "number" ? (
                    <span
                      className={`rounded-[6px] px-1.5 py-0.5 text-[10px] ${
                        active
                          ? "bg-[var(--color-nav-count-active-bg)] text-[var(--color-nav-count-active-text)]"
                          : "text-[var(--color-nav-count-muted)]"
                      }`}
                    >
                      {item.count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto px-2.5 py-2 text-[11px] text-[var(--color-text-faint)]">
            local-first
          </div>
        </aside>

        <div className="flex min-h-screen flex-col">
          <header className="flex min-h-11 items-center justify-between gap-3 border-b border-[var(--color-sidebar-border)] px-4">
            <div>
              <div className="text-[13px] font-medium text-[var(--color-text-strong)]">
                {viewTitle}
              </div>
              <div className="mt-0.5 text-[11px] text-[var(--color-text-faint)]">
                {viewDescription}
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Button
                className="w-[104px] justify-center"
                size="sm"
                variant={app.theme === "light" ? "primary" : "secondary"}
                onClick={app.toggleTheme}
              >
                {app.theme === "dark" ? "Dark mode" : "Light mode"}
              </Button>
              {supportsWhitespace ? (
                <>
                  <Button
                    className="w-[96px] justify-center"
                    size="sm"
                    variant={app.showWhitespace ? "primary" : "secondary"}
                    onClick={app.toggleWhitespace}
                  >
                    Spaces
                  </Button>
                  <div
                    aria-hidden={!app.showWhitespace}
                    className={`w-[88px] text-[10px] text-[var(--color-notice)] transition-opacity ${
                      app.showWhitespace ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    · 半角 / □ 全角
                  </div>
                </>
              ) : null}
              <div
                className={`max-w-[280px] truncate text-[11px] ${
                  app.error ? "text-[var(--color-error)]" : "text-[var(--color-notice)]"
                }`}
              >
                {app.error ?? app.notice}
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-hidden p-2.5">
            {app.view === "drafts" ? app.draftWorkspace : null}
            {app.view === "templates" ? app.templateWorkspace : null}
            {app.view === "signatures" ? app.signatureWorkspace : null}
            {app.view === "settings" ? app.settingsWorkspace : null}
          </div>
        </div>
      </div>
    </main>
  );
}

export default App;

function getViewTitle(view: WorkspaceView): string {
  switch (view) {
    case "drafts":
      return "Drafts";
    case "templates":
      return "Templates";
    case "signatures":
      return "Signatures";
    case "settings":
      return "Settings";
  }
}

function getViewDescription(view: WorkspaceView): string {
  switch (view) {
    case "drafts":
      return "件名・本文・署名を分けて編集";
    case "templates":
      return "定型文と推奨署名を管理";
    case "signatures":
      return "差出人プロフィールを管理";
    case "settings":
      return "診断ログの記録方法と保持期間を管理";
  }
}
