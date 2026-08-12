import type { ChangeRequest, LifecycleState } from "@/domain/change-request";
import type {
  ActivityEvent,
  ActivityEventOutcome,
  ActivityEventType,
} from "@/domain/events";
import type { Actor, WorkflowDomain } from "@/domain/shared";
import type {
  FeatureFlag,
  KycCase,
  KycDecision,
  KycState,
  RefundCase,
} from "@/domain/targets";

export interface Clock {
  now(): string;
}

export interface IdGenerator {
  newId(prefix: string): string;
}

export interface UnitOfWork {
  transact<T>(fn: () => T): T;
}

export interface ChangeRequestRepository {
  getById(id: string): ChangeRequest | null;
  insert(request: ChangeRequest): void;
  /**
   * Applies changes only when the stored version matches expectedVersion,
   * incrementing the version. Returns false on a version conflict.
   */
  update(
    id: string,
    expectedVersion: number,
    changes: Partial<
      Pick<
        ChangeRequest,
        | "state"
        | "approvedById"
        | "approvedByName"
        | "approvedAt"
        | "executedAt"
        | "failureReason"
      >
    > & { updatedAt: string },
  ): boolean;
  list(filter?: {
    domain?: WorkflowDomain;
    state?: LifecycleState;
  }): ChangeRequest[];
  findOpenByTarget(domain: WorkflowDomain, targetId: string): ChangeRequest[];
}

export interface ActivityEventFilter {
  domain?: WorkflowDomain;
  actorId?: string;
  outcome?: ActivityEventOutcome;
  requestId?: string;
  correlationId?: string;
  types?: readonly ActivityEventType[];
  since?: string;
  limit?: number;
}

export interface ActivityEventRepository {
  insert(event: ActivityEvent): void;
  list(filter?: ActivityEventFilter): ActivityEvent[];
}

export interface RefundCaseRepository {
  getById(id: string): RefundCase | null;
  list(): RefundCase[];
}

export interface KycCaseRepository {
  getById(id: string): KycCase | null;
  list(): KycCase[];
  setState(id: string, state: KycState, updatedAt: string): void;
}

export interface FeatureFlagRepository {
  getById(id: string): FeatureFlag | null;
  list(): FeatureFlag[];
  setRollout(id: string, rolloutPercent: number, changedAt: string): void;
}

export interface ProviderExecutionRecord {
  requestId: string;
  idempotencyKey: string;
  status: "intent" | "succeeded" | "failed";
  providerReference: string | null;
  detail: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface ProviderExecutionRepository {
  getByRequestId(requestId: string): ProviderExecutionRecord | null;
  recordIntent(record: ProviderExecutionRecord): void;
  recordOutcome(
    requestId: string,
    status: "succeeded" | "failed",
    providerReference: string | null,
    detail: string | null,
    completedAt: string,
  ): void;
}

export type ProviderResult =
  | { kind: "succeeded"; providerReference: string; detail: string }
  | { kind: "failed"; detail: string };

export interface PaymentProvider {
  refund(input: {
    idempotencyKey: string;
    orderId: string;
    amountCents: number;
  }): ProviderResult;
}

export interface KycProvider {
  applyDecision(input: {
    idempotencyKey: string;
    kycCaseId: string;
    decision: KycDecision;
  }): ProviderResult;
}

export interface FeatureFlagProvider {
  setRollout(input: {
    idempotencyKey: string;
    flagKey: string;
    environment: string;
    rolloutPercent: number;
  }): ProviderResult;
}

export interface IdentityProvider {
  /** Resolves the current actor server-side. Never trusts client input. */
  getCurrentActor(): Promise<Actor>;
  listActors(): Actor[];
}
