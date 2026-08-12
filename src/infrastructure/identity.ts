import { cookies } from "next/headers";
import type { IdentityProvider } from "@/application/ports";
import type { Actor, Role } from "@/domain/shared";
import type { SqliteDatabase } from "./db";
import { DEFAULT_USER_ID } from "./seed";

export const IDENTITY_COOKIE = "ops_identity";

export function identitySwitchingEnabled(): boolean {
  return process.env.OPS_IDENTITY_SWITCHING === "enabled";
}

interface UserRow {
  id: string;
  name: string;
  title: string;
  roles: string;
}

function toActor(row: UserRow): Actor {
  return {
    id: row.id,
    name: row.name,
    title: row.title,
    roles: JSON.parse(row.roles) as Role[],
  };
}

/**
 * Resolves identity server-side from the seeded user allowlist. In
 * production this boundary maps OIDC/SSO claims to the same Actor shape;
 * the session cookie is only consulted when development identity
 * switching is explicitly enabled.
 */
export function createIdentityProvider(db: SqliteDatabase): IdentityProvider {
  function getUser(id: string): Actor | null {
    const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as
      UserRow | undefined;
    return row ? toActor(row) : null;
  }
  return {
    async getCurrentActor() {
      if (identitySwitchingEnabled()) {
        const store = await cookies();
        const cookieValue = store.get(IDENTITY_COOKIE)?.value;
        if (cookieValue) {
          const actor = getUser(cookieValue);
          if (actor) {
            return actor;
          }
        }
      }
      const fallback = getUser(DEFAULT_USER_ID);
      if (!fallback) {
        throw new Error("Seed users are missing; run npm run db:reset.");
      }
      return fallback;
    },
    listActors() {
      const rows = db
        .prepare("SELECT * FROM users ORDER BY name")
        .all() as UserRow[];
      return rows.map(toActor);
    },
  };
}
