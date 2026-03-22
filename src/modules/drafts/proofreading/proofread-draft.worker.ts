/// <reference lib="webworker" />

import type { DraftProofreadingWorkerRequest, DraftProofreadingWorkerResponse } from "./model";
import { runDetailedDraftProofreading } from "./run-detailed-proofreading";

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = (event: MessageEvent<DraftProofreadingWorkerRequest>) => {
  void handleProofreadingRequest(event.data);
};

async function handleProofreadingRequest(request: DraftProofreadingWorkerRequest) {
  try {
    const issues = await runDetailedDraftProofreading({
      draft: request.draft,
      signatureBody: request.signatureBody,
    });
    const response: DraftProofreadingWorkerResponse = {
      issues,
      requestId: request.requestId,
    };

    self.postMessage(response);
  } catch (error) {
    const response: DraftProofreadingWorkerResponse = {
      error: toWorkerErrorMessage(error),
      issues: [],
      requestId: request.requestId,
    };

    self.postMessage(response);
  }
}

function toWorkerErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Detailed proofreading failed.";
}

export {};
