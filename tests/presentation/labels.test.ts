import { describe, expect, it } from "vitest";
import { LIFECYCLE_STATES } from "@/domain/change-request";
import { EVENT_OUTCOMES, EVENT_TYPES } from "@/domain/events";
import { RISK_LEVELS, ROLES } from "@/domain/shared";
import {
  EVENT_TYPE_LABELS,
  LIFECYCLE_LABELS,
  OUTCOME_LABELS,
  RISK_LABELS,
  ROLE_LABELS,
} from "@/presentation/labels";

describe("presentation labels", () => {
  it("maps every event variant to a human-readable label", () => {
    for (const type of EVENT_TYPES) {
      expect(EVENT_TYPE_LABELS[type]).toBeTruthy();
      expect(EVENT_TYPE_LABELS[type]).not.toContain("_");
    }
  });

  it("maps every lifecycle state, outcome, risk level, and role", () => {
    for (const state of LIFECYCLE_STATES) {
      expect(LIFECYCLE_LABELS[state]).toBeTruthy();
    }
    for (const outcome of EVENT_OUTCOMES) {
      expect(OUTCOME_LABELS[outcome]).toBeTruthy();
    }
    for (const level of RISK_LEVELS) {
      expect(RISK_LABELS[level]).toBeTruthy();
    }
    for (const role of ROLES) {
      expect(ROLE_LABELS[role]).toBeTruthy();
    }
  });
});
