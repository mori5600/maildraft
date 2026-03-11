import "./App.css";

import { useMaildraftApp } from "./app/state/use-maildraft-app";
import { Button, Panel } from "./shared/ui/primitives";

function App() {
  const app = useMaildraftApp();

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
      <div className="grid min-h-screen grid-cols-[188px_minmax(0,1fr)]">
        <aside className="flex min-h-screen flex-col border-r border-[var(--color-sidebar-border)] bg-[var(--color-sidebar-bg)] px-2 py-3">
          <div className="px-3 py-2">
            <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--color-text-faint)]">
              MailDraft
            </div>
            <div className="mt-2 text-sm font-medium text-[var(--color-text-strong)]">
              Workspace
            </div>
          </div>

          <nav className="mt-3 space-y-1">
            {app.views.map((item) => {
              const active = app.view === item.id;

              return (
                <button
                  key={item.id}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition-colors ${
                    active
                      ? "bg-[var(--color-nav-active-bg)] text-[var(--color-text-strong)]"
                      : "text-[var(--color-text-muted)] hover:bg-[var(--color-nav-hover-bg)] hover:text-[var(--color-text)]"
                  }`}
                  onClick={() => app.setView(item.id)}
                  type="button"
                >
                  <span className="text-sm font-medium">{item.label}</span>
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[11px] ${
                      active
                        ? "bg-[var(--color-nav-count-active-bg)] text-[var(--color-nav-count-active-text)]"
                        : "text-[var(--color-nav-count-muted)]"
                    }`}
                  >
                    {item.count}
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="mt-auto px-3 py-2 text-xs text-[var(--color-text-faint)]">
            local-first
          </div>
        </aside>

        <div className="flex min-h-screen flex-col">
          <header className="flex min-h-12 items-center justify-between gap-4 border-b border-[var(--color-sidebar-border)] px-4">
            <div>
              <div className="text-sm font-medium text-[var(--color-text-strong)]">
                {app.view === "drafts"
                  ? "Drafts"
                  : app.view === "templates"
                    ? "Templates"
                    : "Signatures"}
              </div>
              <div className="mt-0.5 text-xs text-[var(--color-text-faint)]">
                {app.view === "drafts"
                  ? "件名・本文・署名を分けて編集"
                  : app.view === "templates"
                    ? "定型文と推奨署名を管理"
                    : "差出人プロフィールを管理"}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                className="w-[112px] justify-center"
                size="sm"
                variant={app.theme === "light" ? "primary" : "secondary"}
                onClick={app.toggleTheme}
              >
                {app.theme === "dark" ? "Dark mode" : "Light mode"}
              </Button>
              <Button
                className="w-[104px] justify-center"
                size="sm"
                variant={app.showWhitespace ? "primary" : "secondary"}
                onClick={app.toggleWhitespace}
              >
                Spaces
              </Button>
              <div
                aria-hidden={!app.showWhitespace}
                className={`w-[96px] text-[11px] text-[var(--color-notice)] transition-opacity ${
                  app.showWhitespace ? "opacity-100" : "opacity-0"
                }`}
              >
                · 半角 / □ 全角
              </div>
              <div
                className={`max-w-[320px] truncate text-xs ${
                  app.error ? "text-[var(--color-error)]" : "text-[var(--color-notice)]"
                }`}
              >
                {app.error ?? app.notice}
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-hidden p-3">
            {app.view === "drafts" ? app.draftWorkspace : null}
            {app.view === "templates" ? app.templateWorkspace : null}
            {app.view === "signatures" ? app.signatureWorkspace : null}
          </div>
        </div>
      </div>
    </main>
  );
}

export default App;
