import { NextResponse } from "next/server";
import { getContainer } from "@/infrastructure/container";
import { identitySwitchingEnabled } from "@/infrastructure/identity";

/**
 * Development-only reset endpoint used by the automated acceptance journey.
 * Available only when the development identity configuration is enabled.
 */
export function POST(): NextResponse {
  if (!identitySwitchingEnabled()) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }
  getContainer().reset();
  return NextResponse.json({ ok: true });
}
