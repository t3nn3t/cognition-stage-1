import type { CommandContext } from "@/application/command-pipeline";
import type { IdentityProvider } from "@/application/ports";
import { defaultDatabaseUrl, migrate, openDatabase } from "./db";
import type { Db } from "./db";
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
  createPgUnitOfWork,
  createSystemClock,
} from "./system";

export interface Container {
  db: Db;
  context: CommandContext;
  identity: IdentityProvider;
  reset(): Promise<void>;
}

export async function buildContainer(databaseUrl: string): Promise<Container> {
  const db = openDatabase(databaseUrl);
  await migrate(db);
  const context: CommandContext = {
    uow: createPgUnitOfWork(db),
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
      return seed(db);
    },
  };
}

const globalContainer = globalThis as typeof globalThis & {
  __opsConsoleContainer?: Promise<Container>;
};

/** Process-wide container; the dev server reuses it across HMR reloads. */
export function getContainer(): Promise<Container> {
  if (!globalContainer.__opsConsoleContainer) {
    globalContainer.__opsConsoleContainer = (async () => {
      const container = await buildContainer(defaultDatabaseUrl());
      const { rows } = await container.db.query<{ count: string }>(
        "SELECT COUNT(*) AS count FROM users",
      );
      if (Number(rows[0]?.count ?? 0) === 0) {
        await container.reset();
      }
      return container;
    })();
  }
  return globalContainer.__opsConsoleContainer;
}
