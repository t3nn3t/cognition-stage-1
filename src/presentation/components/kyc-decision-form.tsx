"use client";

import { useActionState } from "react";
import { submitKycDecisionAction } from "@/app/actions";
import { KYC_DECISIONS } from "@/domain/targets";
import { KYC_DECISION_LABELS } from "../labels";
import { Button } from "./button";
import { FeedbackBanner, idleFeedback } from "./feedback";
import { Field, inputClassName } from "./field";

export function KycDecisionForm({
  kycCaseId,
  highRisk,
}: {
  kycCaseId: string;
  highRisk: boolean;
}) {
  const [feedback, submit, submitting] = useActionState(
    submitKycDecisionAction,
    idleFeedback,
  );
  return (
    <form action={submit} className="space-y-4">
      <FeedbackBanner feedback={feedback} />
      <input type="hidden" name="kycCaseId" value={kycCaseId} />
      <fieldset>
        <legend className="block text-sm font-medium text-zinc-700">
          Decision
        </legend>
        <div className="mt-1.5 inline-flex overflow-hidden rounded-md border border-zinc-300">
          {KYC_DECISIONS.map((decision) => (
            <label
              key={decision}
              className="cursor-pointer border-l border-zinc-300 px-4 py-1.5 text-sm text-zinc-700 first:border-l-0 hover:bg-zinc-50 has-checked:bg-indigo-600 has-checked:text-white"
            >
              <input
                type="radio"
                name="decision"
                value={decision}
                required
                className="sr-only"
              />
              {KYC_DECISION_LABELS[decision]}
            </label>
          ))}
        </div>
        {highRisk ? (
          <p className="mt-1.5 text-xs text-zinc-500">
            High-risk outcomes are routed to Compliance for approval.
          </p>
        ) : null}
      </fieldset>
      <Field label="Reason" htmlFor="kyc-reason">
        <textarea
          id="kyc-reason"
          name="reason"
          rows={3}
          required
          className={inputClassName}
        />
      </Field>
      <Button type="submit" disabled={submitting}>
        Submit decision
      </Button>
    </form>
  );
}
