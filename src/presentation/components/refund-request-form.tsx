"use client";

import { useActionState } from "react";
import { submitRefundAction } from "@/app/actions";
import { Button } from "./button";
import { FeedbackBanner, idleFeedback } from "./feedback";
import { Field, inputClassName } from "./field";

export function RefundRequestForm({
  refundCaseId,
  maxAmount,
  defaultAmount,
}: {
  refundCaseId: string;
  maxAmount: string;
  defaultAmount: string;
}) {
  const [feedback, submit, submitting] = useActionState(
    submitRefundAction,
    idleFeedback,
  );
  return (
    <form action={submit} className="space-y-4">
      <FeedbackBanner feedback={feedback} />
      <input type="hidden" name="refundCaseId" value={refundCaseId} />
      <Field
        label="Refund amount (USD)"
        htmlFor="refund-amount"
        hint={`Up to ${maxAmount}, the original charge. Refunds above $500 require Finance approval.`}
      >
        <input
          id="refund-amount"
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          required
          defaultValue={defaultAmount}
          className={inputClassName}
        />
      </Field>
      <Field label="Reason (optional)" htmlFor="refund-reason">
        <textarea
          id="refund-reason"
          name="reason"
          rows={3}
          className={inputClassName}
        />
      </Field>
      <Button type="submit" disabled={submitting}>
        Request refund
      </Button>
    </form>
  );
}
