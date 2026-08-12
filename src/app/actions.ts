"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { CommandResult } from "@/application/results";
import { dispatchCommand } from "@/application/command-pipeline";
import { getContainer } from "@/infrastructure/container";
import {
  IDENTITY_COOKIE,
  identitySwitchingEnabled,
} from "@/infrastructure/identity";
import type { ActionFeedback } from "@/presentation/components/feedback";
import { assertNever } from "@/domain/shared";

function toFeedback(result: CommandResult): ActionFeedback {
  if (!result.ok) {
    const error = result.error;
    switch (error.kind) {
      case "validation":
        return { status: "error", message: error.issues.join(" ") };
      case "authorization":
      case "not_found":
      case "conflict":
      case "invalid_transition":
        return { status: "error", message: error.message };
      case "policy_blocked":
        return { status: "blocked", message: error.message };
      case "provider_failure":
        return {
          status: "error",
          message: `${error.message} The request is marked failed and can be retried.`,
        };
      default:
        return assertNever(error);
    }
  }
  const value = result.value;
  switch (value.kind) {
    case "submitted":
      return {
        status: "success",
        message: "Request submitted and routed for approval.",
      };
    case "approved":
      return { status: "success", message: "Request approved." };
    case "rejected":
      return { status: "success", message: "Request rejected." };
    case "executed":
      return { status: "success", message: "Change executed." };
    case "idempotent_replay":
      return {
        status: "success",
        message:
          "This request was already executed; the original result was returned without a second execution.",
      };
    default:
      return assertNever(value);
  }
}

async function runCommand(
  input: unknown,
  revalidate: readonly string[],
): Promise<ActionFeedback> {
  const container = await getContainer();
  const actor = await container.identity.getCurrentActor();
  const result = await dispatchCommand(container.context, actor, input);
  for (const path of revalidate) {
    revalidatePath(path);
  }
  return toFeedback(result);
}

export async function submitRefundAction(
  _prev: ActionFeedback,
  formData: FormData,
): Promise<ActionFeedback> {
  const amount = Number.parseFloat(String(formData.get("amount") ?? ""));
  return runCommand(
    {
      kind: "submit_refund",
      refundCaseId: String(formData.get("refundCaseId") ?? ""),
      amountCents: Number.isFinite(amount) ? Math.round(amount * 100) : -1,
      reason: String(formData.get("reason") ?? ""),
    },
    ["/", "/refunds", "/activity"],
  );
}

export async function submitKycDecisionAction(
  _prev: ActionFeedback,
  formData: FormData,
): Promise<ActionFeedback> {
  return runCommand(
    {
      kind: "submit_kyc_decision",
      kycCaseId: String(formData.get("kycCaseId") ?? ""),
      decision: String(formData.get("decision") ?? ""),
      reason: String(formData.get("reason") ?? ""),
    },
    ["/", "/kyc", "/activity"],
  );
}

export async function submitFlagChangeAction(
  _prev: ActionFeedback,
  formData: FormData,
): Promise<ActionFeedback> {
  const proposed = Number.parseInt(
    String(formData.get("proposedRolloutPercent") ?? ""),
    10,
  );
  return runCommand(
    {
      kind: "submit_flag_change",
      flagId: String(formData.get("flagId") ?? ""),
      environment: String(formData.get("environment") ?? ""),
      proposedRolloutPercent: Number.isFinite(proposed) ? proposed : -1,
      reason: String(formData.get("reason") ?? ""),
    },
    ["/", "/flags", "/activity"],
  );
}

export async function approveRequestAction(
  _prev: ActionFeedback,
  formData: FormData,
): Promise<ActionFeedback> {
  return runCommand(
    {
      kind: "approve_request",
      requestId: String(formData.get("requestId") ?? ""),
      expectedVersion: Number.parseInt(
        String(formData.get("expectedVersion") ?? ""),
        10,
      ),
    },
    ["/", "/refunds", "/kyc", "/flags", "/activity"],
  );
}

export async function rejectRequestAction(
  _prev: ActionFeedback,
  formData: FormData,
): Promise<ActionFeedback> {
  return runCommand(
    {
      kind: "reject_request",
      requestId: String(formData.get("requestId") ?? ""),
      expectedVersion: Number.parseInt(
        String(formData.get("expectedVersion") ?? ""),
        10,
      ),
      reason: String(formData.get("reason") ?? ""),
    },
    ["/", "/refunds", "/kyc", "/flags", "/activity"],
  );
}

export async function executeRequestAction(
  _prev: ActionFeedback,
  formData: FormData,
): Promise<ActionFeedback> {
  return runCommand(
    {
      kind: "execute_request",
      requestId: String(formData.get("requestId") ?? ""),
    },
    ["/", "/refunds", "/kyc", "/flags", "/activity"],
  );
}

export async function switchIdentityAction(formData: FormData): Promise<void> {
  if (!identitySwitchingEnabled()) {
    return;
  }
  const userId = String(formData.get("userId") ?? "");
  const container = await getContainer();
  const actors = await container.identity.listActors();
  const allowed = actors.some((actor) => actor.id === userId);
  if (!allowed) {
    return;
  }
  const store = await cookies();
  store.set(IDENTITY_COOKIE, userId, { httpOnly: true, sameSite: "lax" });
  revalidatePath("/", "layout");
  redirect("/");
}
