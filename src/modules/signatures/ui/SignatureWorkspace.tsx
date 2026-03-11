import type { ReactNode } from "react";

import { formatStoredTime } from "../../../shared/lib/time";
import { visualizeWhitespace } from "../../../shared/lib/whitespace";
import { Button, Field, Input, Panel, Textarea } from "../../../shared/ui/primitives";
import type { Signature, SignatureInput } from "../model";

interface SignatureWorkspaceProps {
  signatures: Signature[];
  selectedSignatureId: string | null;
  signatureForm: SignatureInput;
  showWhitespace: boolean;
  onSelectSignature: (id: string) => void;
  onCreateSignature: () => void;
  onChangeSignature: <K extends keyof SignatureInput>(field: K, value: SignatureInput[K]) => void;
  onSaveSignature: () => Promise<void>;
  onDeleteSignature: () => Promise<void>;
}

export function SignatureWorkspace({
  signatures,
  selectedSignatureId,
  signatureForm,
  showWhitespace,
  onSelectSignature,
  onCreateSignature,
  onChangeSignature,
  onSaveSignature,
  onDeleteSignature,
}: SignatureWorkspaceProps) {
  return (
    <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[260px_minmax(0,1fr)_300px]">
      <Panel className="flex min-h-0 flex-col overflow-hidden">
        <PaneHeader
          action={
            <Button size="sm" variant="ghost" onClick={onCreateSignature}>
              New
            </Button>
          }
          description={`${signatures.length} signatures`}
          title="Signature list"
        />
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <div className="space-y-1">
            {signatures.map((signature) => {
              const isActive = signature.id === selectedSignatureId;

              return (
                <button
                  key={signature.id}
                  className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    isActive
                      ? "border-[#314778] bg-[#161f31]"
                      : "border-transparent hover:border-[#232831] hover:bg-[#181d24]"
                  }`}
                  onClick={() => onSelectSignature(signature.id)}
                  type="button"
                >
                  <div className="flex items-center gap-2">
                    <div className="truncate text-sm font-medium text-[#eef2f7]">
                      {signature.name}
                    </div>
                    {signature.isDefault ? (
                      <span className="rounded-md border border-[#3153a6] bg-[#152445] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.16em] text-[#8eb1ff]">
                        Default
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 text-[11px] text-[#667082]">
                    {formatStoredTime(signature.updatedAt)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </Panel>

      <Panel className="flex min-h-0 flex-col overflow-hidden">
        <PaneHeader
          action={
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => void onDeleteSignature()}>
                {selectedSignatureId ? "Delete" : "Reset"}
              </Button>
              <Button size="sm" variant="primary" onClick={() => void onSaveSignature()}>
                Save
              </Button>
            </div>
          }
          description={signatureForm.name}
          title="Signature editor"
        />

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="grid gap-4">
            <Field label="Name">
              <Input
                showWhitespace={showWhitespace}
                value={signatureForm.name}
                onChange={(event) => onChangeSignature("name", event.currentTarget.value)}
              />
            </Field>

            <label className="flex items-center gap-3 rounded-lg border border-[#20242c] bg-[#0f1319] px-3 py-3 text-sm text-[#c5ccd7]">
              <input
                checked={signatureForm.isDefault}
                className="h-4 w-4 rounded border-[#364051] bg-[#0d1016]"
                type="checkbox"
                onChange={(event) => onChangeSignature("isDefault", event.currentTarget.checked)}
              />
              新規下書きで既定の署名として使う
            </label>

            <Field label="Body">
              <Textarea
                className="min-h-[360px]"
                rows={14}
                showWhitespace={showWhitespace}
                textClassName="mail-signature-text"
                value={signatureForm.body}
                onChange={(event) => onChangeSignature("body", event.currentTarget.value)}
              />
            </Field>
          </div>
        </div>
      </Panel>

      <Panel className="flex min-h-0 flex-col overflow-hidden">
        <PaneHeader description="Rendered block" title="Preview" />
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <pre className="mail-signature-text overflow-x-auto rounded-lg border border-[#20242c] bg-[#0d1016] px-4 py-4 whitespace-pre-wrap text-[#d7dce5]">
            {(showWhitespace ? visualizeWhitespace(signatureForm.body) : signatureForm.body) ||
              "署名プレビューがここに表示されます。"}
          </pre>
        </div>
      </Panel>
    </div>
  );
}

function PaneHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 border-b border-[#20242c] px-4">
      <div className="min-w-0">
        <div className="text-sm font-medium text-[#eef2f7]">{title}</div>
        <div className="truncate text-xs text-[#667082]">{description}</div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
