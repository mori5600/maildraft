import type {
  DraftProofreadingIssue,
  DraftProofreadingWorkerRequest,
  DraftProofreadingWorkerResponse,
} from "./model";

export interface DraftProofreadingRunner {
  dispose: () => void;
  run: (
    request: Omit<DraftProofreadingWorkerRequest, "requestId">,
  ) => Promise<DraftProofreadingIssue[]>;
}

export function createDraftProofreadingRunner(): DraftProofreadingRunner | null {
  if (typeof Worker === "undefined") {
    return null;
  }

  const worker = new Worker(new URL("./proofread-draft.worker.ts", import.meta.url), {
    type: "module",
  });
  const pendingRequests = new Map<
    number,
    {
      reject: (reason?: unknown) => void;
      resolve: (issues: DraftProofreadingIssue[]) => void;
    }
  >();
  let nextRequestId = 0;

  function settleRequest(response: DraftProofreadingWorkerResponse) {
    const pendingRequest = pendingRequests.get(response.requestId);

    if (!pendingRequest) {
      return;
    }

    pendingRequests.delete(response.requestId);

    if (response.error) {
      pendingRequest.reject(new Error(response.error));
      return;
    }

    pendingRequest.resolve(response.issues);
  }

  function rejectAllPending(reason: unknown) {
    for (const request of pendingRequests.values()) {
      request.reject(reason);
    }

    pendingRequests.clear();
  }

  worker.addEventListener("message", (event: MessageEvent<DraftProofreadingWorkerResponse>) => {
    settleRequest(event.data);
  });
  worker.addEventListener("error", (event) => {
    rejectAllPending(
      event.error ??
        new Error(
          event.message
            ? `Detailed proofreading worker failed: ${event.message}`
            : "Detailed proofreading worker failed.",
        ),
    );
  });
  worker.addEventListener("messageerror", () => {
    rejectAllPending(new Error("Detailed proofreading worker returned an invalid response."));
  });

  return {
    dispose() {
      rejectAllPending(new Error("Detailed proofreading worker disposed."));
      worker.terminate();
    },
    run(request) {
      nextRequestId += 1;
      const workerRequest: DraftProofreadingWorkerRequest = {
        ...request,
        requestId: nextRequestId,
      };

      return new Promise<DraftProofreadingIssue[]>((resolve, reject) => {
        pendingRequests.set(workerRequest.requestId, { reject, resolve });
        worker.postMessage(workerRequest);
      });
    },
  };
}
