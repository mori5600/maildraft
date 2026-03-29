import "./App.css";

import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { useRef } from "react";

import { useMaildraftApp } from "./app/state/use-maildraft-app";
import { WORKSPACE_VIEW_STRATEGIES } from "./app/workspace-view-strategies";
import { BlockWorkspace } from "./modules/blocks/ui/BlockWorkspace";
import {
  type DraftWorkspaceHandle,
  DraftWorkspaceScreen,
} from "./modules/drafts/ui/DraftWorkspaceScreen";
import { getViewShortcutHint } from "./modules/help/model";
import { HelpWorkspace } from "./modules/help/ui/HelpWorkspace";
import { MemoWorkspace } from "./modules/memo/ui/MemoWorkspace";
import { SettingsWorkspace } from "./modules/settings/ui/SettingsWorkspace";
import { SignatureWorkspace } from "./modules/signatures/ui/SignatureWorkspace";
import { TemplateWorkspace } from "./modules/templates/ui/TemplateWorkspace";
import { TrashWorkspace } from "./modules/trash/ui/TrashWorkspace";
import { Button } from "./shared/ui/primitives";

function App() {
  const draftWorkspaceRef = useRef<DraftWorkspaceHandle>(null);
  const app = useMaildraftApp(draftWorkspaceRef);
  const supportsWhitespace = app.view !== "settings" && app.view !== "help";
  const viewStrategy = WORKSPACE_VIEW_STRATEGIES[app.view];
  const statusMessage = app.error ?? app.warning ?? app.notice;
  const statusTextClass = app.error
    ? "text-(--color-error)"
    : app.warning
      ? "text-(--color-warning-text)"
      : "text-(--color-notice)";

  if (app.isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-(--color-app-bg) text-(--color-text)">
        <div aria-label="読み込み中" role="status">
          <ArrowPathIcon
            aria-hidden="true"
            className="h-7 w-7 animate-spin text-(--color-text-muted) motion-reduce:animate-none"
            strokeWidth={1.7}
          />
          <span className="sr-only">読み込み中</span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-(--color-app-bg) text-(--color-text)">
      <div className="grid min-h-screen grid-cols-[176px_minmax(0,1fr)]">
        <aside className="flex min-h-screen flex-col border-r border-(--color-sidebar-border) bg-(--color-sidebar-bg) px-2 py-2.5">
          <div className="px-2.5 py-2">
            <div className="text-[11px] tracking-[0.22em] text-(--color-text-faint) uppercase">
              MailDraft
            </div>
          </div>

          <nav className="mt-2.5 space-y-1">
            {app.views.map((item) => {
              const active = app.view === item.id;
              const itemStrategy = WORKSPACE_VIEW_STRATEGIES[item.id];
              const ViewIcon = itemStrategy.icon;

              return (
                <button
                  key={item.id}
                  className={`flex w-full items-center justify-between rounded-[7px] px-2.5 py-1.5 text-left transition-colors ${
                    active
                      ? "bg-(--color-nav-active-bg) text-(--color-text-strong)"
                      : "text-(--color-text-muted) hover:bg-(--color-nav-hover-bg) hover:text-(--color-text)"
                  }`}
                  onClick={() => app.setView(item.id)}
                  title={`${item.label} (${getViewShortcutHint(item.id)})`}
                  type="button"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <ViewIcon aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                    <span className="truncate text-[13px] font-medium">{item.label}</span>
                  </span>
                  {typeof item.count === "number" ? (
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[10px] ${
                        active
                          ? "bg-(--color-nav-count-active-bg) text-(--color-nav-count-active-text)"
                          : "text-(--color-nav-count-muted)"
                      }`}
                    >
                      {item.count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto px-2.5 py-2 text-[11px] text-(--color-text-faint)">
            ローカル保存
          </div>
        </aside>

        <div className="flex min-h-screen flex-col">
          <header className="grid min-h-11 grid-cols-[minmax(0,1fr)_280px_auto] items-center gap-3 border-b border-(--color-sidebar-border) px-4">
            <div>
              <div className="text-[13px] font-medium text-(--color-text-strong)">
                {viewStrategy.title}
              </div>
              <div className="mt-0.5 text-[11px] text-(--color-text-faint)">
                {viewStrategy.description}
              </div>
            </div>

            <div className={`w-70 truncate text-[11px] ${statusTextClass}`}>{statusMessage}</div>

            <div className="flex shrink-0 items-center gap-2.5">
              <Button
                className="w-26 justify-center"
                size="sm"
                variant={app.theme === "light" ? "primary" : "secondary"}
                onClick={app.toggleTheme}
              >
                {app.theme === "dark" ? "ダーク表示" : "ライト表示"}
              </Button>

              <div className="flex w-48.5 items-center gap-2.5">
                {supportsWhitespace ? (
                  <>
                    <Button
                      className="w-24 justify-center"
                      size="sm"
                      variant={app.showWhitespace ? "primary" : "secondary"}
                      onClick={app.toggleWhitespace}
                    >
                      空白表示
                    </Button>
                    <div
                      aria-hidden={!app.showWhitespace}
                      className={`w-22 text-[10px] text-(--color-notice) transition-opacity ${
                        app.showWhitespace ? "opacity-100" : "opacity-0"
                      }`}
                    >
                      · 半角 / □ 全角
                    </div>
                  </>
                ) : (
                  <>
                    <div aria-hidden="true" className="h-7.75 w-24 shrink-0" />
                    <div aria-hidden="true" className="w-22 shrink-0" />
                  </>
                )}
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-hidden p-2.5">
            <div className={app.view === "drafts" ? "h-full" : "hidden"}>
              <DraftWorkspaceScreen ref={draftWorkspaceRef} {...app.draftWorkspaceProps} />
            </div>
            {app.view === "templates" ? (
              <TemplateWorkspace {...app.templateWorkspaceProps} />
            ) : null}
            {app.view === "blocks" ? <BlockWorkspace {...app.blockWorkspaceProps} /> : null}
            {app.view === "signatures" ? (
              <SignatureWorkspace {...app.signatureWorkspaceProps} />
            ) : null}
            {app.view === "memo" ? <MemoWorkspace {...app.memoWorkspaceProps} /> : null}
            {app.view === "trash" ? <TrashWorkspace {...app.trashWorkspaceProps} /> : null}
            {app.view === "settings" ? <SettingsWorkspace {...app.settingsWorkspaceProps} /> : null}
            {app.view === "help" ? <HelpWorkspace /> : null}
          </div>
        </div>
      </div>
    </main>
  );
}

export default App;
