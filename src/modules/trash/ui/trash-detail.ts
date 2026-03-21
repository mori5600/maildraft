import { toDraftInput } from "../../drafts/model";
import { memoCharacterCount, memoLineCount } from "../../memo/model";
import { buildDraftRenderResult, renderTemplatePreview } from "../../renderer/render-draft";
import type { Signature } from "../../signatures/model";
import { toTemplateInput } from "../../templates/model";
import { findTrashSignature, type TrashedSignature, type TrashItem } from "../model";

export function buildTrashDetail(
  item: TrashItem,
  signatures: Signature[],
  trashedSignatures: TrashedSignature[],
): {
  subject: string;
  body: string;
  meta: string;
} {
  switch (item.kind) {
    case "draft": {
      const signature = findTrashSignature(signatures, trashedSignatures, item.draft.signatureId);
      const draftRenderResult = buildDraftRenderResult(toDraftInput(item.draft), signature);
      return {
        subject: draftRenderResult.previewSubject,
        body: draftRenderResult.previewText,
        meta: `${item.history.length} 件の履歴を保持`,
      };
    }
    case "template": {
      const signature = findTrashSignature(
        signatures,
        trashedSignatures,
        item.template.signatureId,
      );
      return {
        subject: item.template.subject,
        body: renderTemplatePreview(toTemplateInput(item.template), signature),
        meta: item.template.signatureId ? "署名参照あり" : "署名参照なし",
      };
    }
    case "signature":
      return {
        subject: "",
        body: item.signature.body,
        meta: item.signature.isDefault ? "削除時点では既定の署名" : "通常の署名",
      };
    case "memo":
      return {
        subject: "",
        body: item.memo.body,
        meta: `${memoLineCount(item.memo)} 行 / ${memoCharacterCount(item.memo)} 文字`,
      };
  }
}
