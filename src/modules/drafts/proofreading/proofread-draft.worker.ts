/// <reference lib="webworker" />

import type { DraftProofreadingWorkerRequest, DraftProofreadingWorkerResponse } from "./model";
import { createDetailedDraftProofreadingSession } from "./run-detailed-proofreading";

declare const self: DedicatedWorkerGlobalScope;

const detailedProofreadingSession = createDetailedDraftProofreadingSession();
let processingChain = Promise.resolve();

self.onmessage = (event: MessageEvent<DraftProofreadingWorkerRequest>) => {
  processingChain = processingChain
    .catch(() => undefined)
    .then(() => handleProofreadingRequest(event.data));
};

async function handleProofreadingRequest(request: DraftProofreadingWorkerRequest) {
  try {
    const issues = await detailedProofreadingSession.run({
      draft: request.draft,
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
