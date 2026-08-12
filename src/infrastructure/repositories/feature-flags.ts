import type { FeatureFlagRepository } from "@/application/ports";
import type { FeatureFlag, FlagEnvironment } from "@/domain/targets";
import type { Db } from "../db";

interface FeatureFlagRow {
  id: string;
  key: string;
  description: string;
  environment: FlagEnvironment;
  rollout_percent: number;
  owner_team: string;
  enabled: boolean;
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
    enabled: row.enabled,
    lastChangedAt: row.last_changed_at,
  };
}

export function createFeatureFlagRepository(db: Db): FeatureFlagRepository {
  return {
    async getById(id) {
      const { rows } = await db.query<FeatureFlagRow>(
        "SELECT * FROM feature_flags WHERE id = $1",
        [id],
      );
      return rows[0] ? toFeatureFlag(rows[0]) : null;
    },
    async list() {
      const { rows } = await db.query<FeatureFlagRow>(
        "SELECT * FROM feature_flags ORDER BY key, environment",
      );
      return rows.map(toFeatureFlag);
    },
    async setRollout(id, rolloutPercent, changedAt) {
      await db.query(
        "UPDATE feature_flags SET rollout_percent = $1, last_changed_at = $2 WHERE id = $3",
        [rolloutPercent, changedAt, id],
      );
    },
  };
}
