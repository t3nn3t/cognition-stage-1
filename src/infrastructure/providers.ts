import { createHash } from "node:crypto";
import type {
  FeatureFlagProvider,
  KycProvider,
  PaymentProvider,
} from "@/application/ports";

function deterministicReference(
  prefix: string,
  idempotencyKey: string,
): string {
  const digest = createHash("sha256")
    .update(idempotencyKey)
    .digest("hex")
    .slice(0, 12);
  return `${prefix}_${digest}`;
}

/**
 * Deterministic stand-in for a payment service provider. The reference is
 * derived from the idempotency key so repeated calls with the same key
 * produce the same result.
 */
export function createPaymentProvider(): PaymentProvider {
  return {
    refund({ idempotencyKey, orderId, amountCents }) {
      return {
        kind: "succeeded",
        providerReference: deterministicReference("pay_ref", idempotencyKey),
        detail: `Refund of ${amountCents} cents accepted for order ${orderId}`,
      };
    },
  };
}

export function createKycProvider(): KycProvider {
  return {
    applyDecision({ idempotencyKey, kycCaseId, decision }) {
      return {
        kind: "succeeded",
        providerReference: deterministicReference("kyc_ref", idempotencyKey),
        detail: `Decision ${decision} recorded for case ${kycCaseId}`,
      };
    },
  };
}

export function createFeatureFlagProvider(): FeatureFlagProvider {
  return {
    setRollout({ idempotencyKey, flagKey, environment, rolloutPercent }) {
      return {
        kind: "succeeded",
        providerReference: deterministicReference("flag_ref", idempotencyKey),
        detail: `${flagKey} set to ${rolloutPercent}% in ${environment}`,
      };
    },
  };
}
