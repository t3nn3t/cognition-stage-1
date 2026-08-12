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
      <Field
        label="Decision"
        htmlFor="kyc-decision"
        hint={
          highRisk
            ? "High-risk outcomes are routed to a Compliance Officer for approval."
            : undefined
        }
      >
        <select id="kyc-decision" name="decision" className={inputClassName}>
          {KYC_DECISIONS.map((decision) => (
            <option key={decision} value={decision}>
              {KYC_DECISION_LABELS[decision]}
            </option>
          ))}
        </select>
      </Field>
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
