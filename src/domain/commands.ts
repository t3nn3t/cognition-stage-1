import { z } from "zod";
import { FLAG_ENVIRONMENTS, KYC_DECISIONS } from "./targets";

const reason = z
  .string()
  .trim()
  .min(1, "A reason is required for this action.");

const optionalReason = z.string().trim().default("");

export const submitRefundCommandSchema = z.object({
  kind: z.literal("submit_refund"),
  refundCaseId: z.string().min(1),
  amountCents: z.number().int().positive(),
  reason: optionalReason,
});

export const submitKycDecisionCommandSchema = z.object({
  kind: z.literal("submit_kyc_decision"),
  kycCaseId: z.string().min(1),
  decision: z.enum(KYC_DECISIONS),
  reason,
});

export const submitFlagChangeCommandSchema = z.object({
  kind: z.literal("submit_flag_change"),
  flagId: z.string().min(1),
  environment: z.enum(FLAG_ENVIRONMENTS),
  proposedRolloutPercent: z.number().int().min(0).max(100),
  reason: optionalReason,
});

export const approveRequestCommandSchema = z.object({
  kind: z.literal("approve_request"),
  requestId: z.string().min(1),
  expectedVersion: z.number().int().nonnegative(),
});

export const rejectRequestCommandSchema = z.object({
  kind: z.literal("reject_request"),
  requestId: z.string().min(1),
  expectedVersion: z.number().int().nonnegative(),
  reason,
});

export const executeRequestCommandSchema = z.object({
  kind: z.literal("execute_request"),
  requestId: z.string().min(1),
});

export const commandSchema = z.discriminatedUnion("kind", [
  submitRefundCommandSchema,
  submitKycDecisionCommandSchema,
  submitFlagChangeCommandSchema,
  approveRequestCommandSchema,
  rejectRequestCommandSchema,
  executeRequestCommandSchema,
]);

export type SubmitRefundCommand = z.infer<typeof submitRefundCommandSchema>;
export type SubmitKycDecisionCommand = z.infer<
  typeof submitKycDecisionCommandSchema
>;
export type SubmitFlagChangeCommand = z.infer<
  typeof submitFlagChangeCommandSchema
>;
export type ApproveRequestCommand = z.infer<typeof approveRequestCommandSchema>;
export type RejectRequestCommand = z.infer<typeof rejectRequestCommandSchema>;
export type ExecuteRequestCommand = z.infer<typeof executeRequestCommandSchema>;
export type Command = z.infer<typeof commandSchema>;
