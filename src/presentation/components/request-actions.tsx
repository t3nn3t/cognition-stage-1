"use client";

import { useActionState, useRef } from "react";
import {
  approveRequestAction,
  executeRequestAction,
  rejectRequestAction,
} from "@/app/actions";
import type { LifecycleState } from "@/domain/change-request";
import { Button } from "./button";
import { FeedbackBanner, idleFeedback } from "./feedback";
import { inputClassName } from "./field";

export function RequestActions({
  requestId,
  state,
  version,
  executeLabel,
  canDecide,
  canExecute,
}: {
  requestId: string;
  state: LifecycleState;
  version: number;
  executeLabel: string;
  canDecide: boolean;
  canExecute: boolean;
}) {
  const [approveFeedback, approve, approving] = useActionState(
    approveRequestAction,
    idleFeedback,
  );
  const [rejectFeedback, reject, rejecting] = useActionState(
    rejectRequestAction,
    idleFeedback,
  );
  const [executeFeedback, execute, executing] = useActionState(
    executeRequestAction,
    idleFeedback,
  );
  const dialogRef = useRef<HTMLDialogElement>(null);

  const feedback = [executeFeedback, rejectFeedback, approveFeedback].find(
    (candidate) => candidate.status !== "idle",
  );

  return (
    <div className="space-y-3">
      {feedback ? <FeedbackBanner feedback={feedback} /> : null}
      <div className="flex flex-wrap items-center gap-2">
        {state === "pending" && canDecide ? (
          <>
            <form action={approve}>
              <input type="hidden" name="requestId" value={requestId} />
              <input type="hidden" name="expectedVersion" value={version} />
              <Button type="submit" disabled={approving}>
                Approve
              </Button>
            </form>
            <Button
              type="button"
              variant="danger"
              onClick={() => dialogRef.current?.showModal()}
            >
              Reject…
            </Button>
          </>
        ) : null}
        {(state === "approved" || state === "failed") && canExecute ? (
          <form action={execute}>
            <input type="hidden" name="requestId" value={requestId} />
            <Button type="submit" disabled={executing}>
              {state === "failed" ? "Retry execution" : executeLabel}
            </Button>
          </form>
        ) : null}
        {state === "executed" && canExecute ? (
          <form action={execute}>
            <input type="hidden" name="requestId" value={requestId} />
            <Button type="submit" variant="secondary" disabled={executing}>
              Retry execution
            </Button>
          </form>
        ) : null}
      </div>
      <dialog
        ref={dialogRef}
        className="m-auto w-full max-w-md rounded-lg p-0 shadow-xl backdrop:bg-zinc-900/30"
      >
        <form
          action={(formData) => {
            dialogRef.current?.close();
            reject(formData);
          }}
          className="space-y-3 p-5"
        >
          <h2 className="text-base font-semibold text-zinc-900">
            Reject request
          </h2>
          <input type="hidden" name="requestId" value={requestId} />
          <input type="hidden" name="expectedVersion" value={version} />
          <div>
            <label
              htmlFor={`reject-reason-${requestId}`}
              className="block text-sm font-medium text-zinc-700"
            >
              Reason
            </label>
            <textarea
              id={`reject-reason-${requestId}`}
              name="reason"
              required
              rows={3}
              className={`mt-1.5 ${inputClassName}`}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => dialogRef.current?.close()}
            >
              Cancel
            </Button>
            <Button type="submit" variant="danger" disabled={rejecting}>
              Reject request
            </Button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
