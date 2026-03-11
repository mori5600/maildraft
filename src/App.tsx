import "./App.css";

import { useMaildraftApp } from "./app/state/use-maildraft-app";
import { Button, Panel } from "./shared/ui/primitives";

function App() {
  const app = useMaildraftApp();

  if (app.isLoading) {
    return (
      <main className="min-h-screen bg-[#0f1117] px-6 py-6 text-[#d5d9e0]">
        <div className="mx-auto max-w-4xl">
          <Panel className="px-6 py-5">
            <div className="text-[11px] uppercase tracking-[0.22em] text-[#6d7485]">
              MailDraft
            </div>
            <h1 className="mt-3 text-lg font-medium text-[#eef2f7]">
              ローカルワークスペースを起動しています
            </h1>
            <p className="mt-2 text-sm text-[#8f97a7]">
              下書き、テンプレート、署名を読み込み中です。
            </p>
          </Panel>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0f1117] text-[#d5d9e0]">
      <div className="grid min-h-screen grid-cols-[188px_minmax(0,1fr)]">
        <aside className="flex min-h-screen flex-col border-r border-[#1b1f27] bg-[#0d1015] px-2 py-3">
          <div className="px-3 py-2">
            <div className="text-[11px] uppercase tracking-[0.22em] text-[#626a79]">MailDraft</div>
            <div className="mt-2 text-sm font-medium text-[#eef2f7]">Workspace</div>
          </div>

          <nav className="mt-3 space-y-1">
            {app.views.map((item) => {
              const active = app.view === item.id;

              return (
                <button
                  key={item.id}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition-colors ${
                    active
                      ? "bg-[#171b23] text-[#eef2f7]"
                      : "text-[#8b93a3] hover:bg-[#141920] hover:text-[#d5d9e0]"
                  }`}
                  onClick={() => app.setView(item.id)}
                  type="button"
                >
                  <span className="text-sm font-medium">{item.label}</span>
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[11px] ${
                      active ? "bg-[#10141a] text-[#9db9ff]" : "text-[#616a79]"
                    }`}
                  >
                    {item.count}
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="mt-auto px-3 py-2 text-xs text-[#626a79]">local-first</div>
        </aside>

        <div className="flex min-h-screen flex-col">
          <header className="flex min-h-12 items-center justify-between gap-4 border-b border-[#1b1f27] px-4">
            <div>
              <div className="text-sm font-medium text-[#eef2f7]">
                {app.view === "drafts"
                  ? "Drafts"
                  : app.view === "templates"
                    ? "Templates"
                    : "Signatures"}
              </div>
              <div className="mt-0.5 text-xs text-[#626a79]">
                {app.view === "drafts"
                  ? "件名・本文・署名を分けて編集"
                  : app.view === "templates"
                    ? "定型文と推奨署名を管理"
                    : "差出人プロフィールを管理"}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                size="sm"
                variant={app.showWhitespace ? "primary" : "secondary"}
                onClick={app.toggleWhitespace}
              >
                {app.showWhitespace ? "Spaces on" : "Spaces off"}
              </Button>
              {app.showWhitespace ? (
                <div className="text-[11px] text-[#6f7888]">· 半角 / □ 全角</div>
              ) : null}
              <div
                className={`max-w-[320px] truncate text-xs ${
                  app.error ? "text-[#f0a8b5]" : "text-[#6f7888]"
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
