import type { CommandContext } from "@/application/command-pipeline";
import type { IdentityProvider } from "@/application/ports";
import { defaultDbPath, migrate, openDatabase } from "./db";
import type { SqliteDatabase } from "./db";
import { createIdentityProvider } from "./identity";
import {
  createFeatureFlagProvider,
  createKycProvider,
  createPaymentProvider,
} from "./providers";
import { createActivityEventRepository } from "./repositories/activity-events";
import {
  createKycCaseRepository,
  createRefundCaseRepository,
} from "./repositories/cases";
import { createChangeRequestRepository } from "./repositories/change-requests";
import { createFeatureFlagRepository } from "./repositories/feature-flags";
import { createProviderExecutionRepository } from "./repositories/provider-executions";
import { seed } from "./seed";
import {
  createIdGenerator,
  createSqliteUnitOfWork,
  createSystemClock,
} from "./system";

export interface Container {
  db: SqliteDatabase;
  context: CommandContext;
  identity: IdentityProvider;
  reset(): void;
}

export function buildContainer(dbPath: string): Container {
  const db = openDatabase(dbPath);
  migrate(db);
  const context: CommandContext = {
    uow: createSqliteUnitOfWork(db),
    clock: createSystemClock(),
    ids: createIdGenerator(),
    changeRequests: createChangeRequestRepository(db),
    events: createActivityEventRepository(db),
    refundCases: createRefundCaseRepository(db),
    kycCases: createKycCaseRepository(db),
    featureFlags: createFeatureFlagRepository(db),
    providerExecutions: createProviderExecutionRepository(db),
    paymentProvider: createPaymentProvider(),
    kycProvider: createKycProvider(),
    flagProvider: createFeatureFlagProvider(),
  };
  return {
    db,
    context,
    identity: createIdentityProvider(db),
    reset() {
      seed(db);
    },
  };
}

const globalContainer = globalThis as typeof globalThis & {
  __opsConsoleContainer?: Container;
};

/** Process-wide container; the dev server reuses it across HMR reloads. */
export function getContainer(): Container {
  if (!globalContainer.__opsConsoleContainer) {
    const container = buildContainer(defaultDbPath());
    const hasUsers = container.db
      .prepare("SELECT COUNT(*) AS count FROM users")
      .get() as { count: number };
    if (hasUsers.count === 0) {
      container.reset();
    }
    globalContainer.__opsConsoleContainer = container;
  }
  return globalContainer.__opsConsoleContainer;
}
