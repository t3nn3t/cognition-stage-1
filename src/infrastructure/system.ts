import { randomBytes } from "node:crypto";
import type { Clock, IdGenerator, UnitOfWork } from "@/application/ports";
import type { SqliteDatabase } from "./db";

export function createSystemClock(): Clock {
  return {
    now() {
      return new Date().toISOString();
    },
  };
}

export function createIdGenerator(): IdGenerator {
  return {
    newId(prefix) {
      return `${prefix}_${randomBytes(9).toString("hex")}`;
    },
  };
}

export function createSqliteUnitOfWork(db: SqliteDatabase): UnitOfWork {
  return {
    transact(fn) {
      return db.transaction(fn)();
    },
  };
}
