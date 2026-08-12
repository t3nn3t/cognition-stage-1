import type { FeatureFlagRepository } from "@/application/ports";
import type { FeatureFlag, FlagEnvironment } from "@/domain/targets";
import type { SqliteDatabase } from "../db";

interface FeatureFlagRow {
  id: string;
  key: string;
  description: string;
  environment: FlagEnvironment;
  rollout_percent: number;
  owner_team: string;
  enabled: number;
  last_changed_at: string | null;
}

function toFeatureFlag(row: FeatureFlagRow): FeatureFlag {
  return {
    id: row.id,
    key: row.key,
    description: row.description,
    environment: row.environment,
    rolloutPercent: row.rollout_percent,
    ownerTeam: row.owner_team,
    enabled: row.enabled === 1,
    lastChangedAt: row.last_changed_at,
  };
}

export function createFeatureFlagRepository(
  db: SqliteDatabase,
): FeatureFlagRepository {
  return {
    getById(id) {
      const row = db
        .prepare("SELECT * FROM feature_flags WHERE id = ?")
        .get(id) as FeatureFlagRow | undefined;
      return row ? toFeatureFlag(row) : null;
    },
    list() {
      const rows = db
        .prepare("SELECT * FROM feature_flags ORDER BY key, environment")
        .all() as FeatureFlagRow[];
      return rows.map(toFeatureFlag);
    },
    setRollout(id, rolloutPercent, changedAt) {
      db.prepare(
        "UPDATE feature_flags SET rollout_percent = ?, last_changed_at = ? WHERE id = ?",
      ).run(rolloutPercent, changedAt, id);
    },
  };
}
