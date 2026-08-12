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
  transact<T>(fn: () => Promise<T>): Promise<T>;
}

export interface ChangeRequestRepository {
  getById(id: string): Promise<ChangeRequest | null>;
  insert(request: ChangeRequest): Promise<void>;
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
  ): Promise<boolean>;
  list(filter?: {
    domain?: WorkflowDomain;
    state?: LifecycleState;
  }): Promise<ChangeRequest[]>;
  findOpenByTarget(
    domain: WorkflowDomain,
    targetId: string,
  ): Promise<ChangeRequest[]>;
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
  insert(event: ActivityEvent): Promise<void>;
  list(filter?: ActivityEventFilter): Promise<ActivityEvent[]>;
}

export interface RefundCaseRepository {
  getById(id: string): Promise<RefundCase | null>;
  list(): Promise<RefundCase[]>;
}

export interface KycCaseRepository {
  getById(id: string): Promise<KycCase | null>;
  list(): Promise<KycCase[]>;
  setState(id: string, state: KycState, updatedAt: string): Promise<void>;
}

export interface FeatureFlagRepository {
  getById(id: string): Promise<FeatureFlag | null>;
  list(): Promise<FeatureFlag[]>;
  setRollout(
    id: string,
    rolloutPercent: number,
    changedAt: string,
  ): Promise<void>;
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
  getByRequestId(requestId: string): Promise<ProviderExecutionRecord | null>;
  recordIntent(record: ProviderExecutionRecord): Promise<void>;
  recordOutcome(
    requestId: string,
    status: "succeeded" | "failed",
    providerReference: string | null,
    detail: string | null,
    completedAt: string,
  ): Promise<void>;
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
  listActors(): Promise<Actor[]>;
}
