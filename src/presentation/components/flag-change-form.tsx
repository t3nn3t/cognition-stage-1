"use client";

import { useActionState, useState } from "react";
import { submitFlagChangeAction } from "@/app/actions";
import type { FlagEnvironment } from "@/domain/targets";
import { Button } from "./button";
import { FeedbackBanner, idleFeedback } from "./feedback";
import { Field, inputClassName } from "./field";

export function FlagChangeForm({
  flagId,
  environment,
  currentRolloutPercent,
}: {
  flagId: string;
  environment: FlagEnvironment;
  currentRolloutPercent: number;
}) {
  const [feedback, submit, submitting] = useActionState(
    submitFlagChangeAction,
    idleFeedback,
  );
  const [proposed, setProposed] = useState("");
  const proposedNumber = Number.parseInt(proposed, 10);

  return (
    <form action={submit} className="space-y-4">
      <FeedbackBanner feedback={feedback} />
      <input type="hidden" name="flagId" value={flagId} />
      <input type="hidden" name="environment" value={environment} />
      <div className="flex items-center gap-3 text-sm">
        <div className="rounded-md bg-zinc-100 px-3 py-1.5 font-medium text-zinc-700">
          Current: {currentRolloutPercent}%
        </div>
        <span aria-hidden className="text-zinc-400">
          →
        </span>
        <div className="rounded-md bg-indigo-50 px-3 py-1.5 font-medium text-indigo-700">
          Proposed:{" "}
          {Number.isFinite(proposedNumber) ? `${proposedNumber}%` : "—"}
        </div>
      </div>
      <Field
        label="Proposed rollout (%)"
        htmlFor="flag-rollout"
        hint={
          environment === "production"
            ? "Production rollouts increase gradually — at most 25 percentage points per change, with Release Manager approval."
            : undefined
        }
      >
        <input
          id="flag-rollout"
          name="proposedRolloutPercent"
          type="number"
          min="0"
          max="100"
          step="1"
          required
          value={proposed}
          onChange={(event) => setProposed(event.target.value)}
          className={inputClassName}
        />
      </Field>
      <Field label="Reason" htmlFor="flag-reason">
        <textarea
          id="flag-reason"
          name="reason"
          rows={3}
          required
          className={inputClassName}
        />
      </Field>
      <Button type="submit" disabled={submitting}>
        Propose change
      </Button>
    </form>
  );
}
