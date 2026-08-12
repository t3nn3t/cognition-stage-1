export type CommandError =
  | { kind: "validation"; issues: readonly string[] }
  | { kind: "authorization"; message: string }
  | { kind: "policy_blocked"; policyId: string; message: string }
  | { kind: "not_found"; message: string }
  | { kind: "conflict"; message: string }
  | { kind: "invalid_transition"; message: string }
  | { kind: "provider_failure"; message: string };

export type CommandSuccess =
  | { kind: "submitted"; requestId: string }
  | { kind: "approved"; requestId: string }
  | { kind: "rejected"; requestId: string }
  | { kind: "executed"; requestId: string; providerReference: string }
  | {
      kind: "idempotent_replay";
      requestId: string;
      providerReference: string;
    };

export type CommandResult =
  | { ok: true; value: CommandSuccess }
  | { ok: false; error: CommandError };

export function ok(value: CommandSuccess): CommandResult {
  return { ok: true, value };
}

export function err(error: CommandError): CommandResult {
  return { ok: false, error };
}
