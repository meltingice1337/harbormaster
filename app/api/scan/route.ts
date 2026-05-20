import { NextResponse } from "next/server";

import { logger } from "@/lib/log";
import { buildDashboardState } from "@/lib/orchestrator";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const state = await buildDashboardState({ fresh: true });
    return NextResponse.json(state);
  } catch (err) {
    logger.error({ err }, "api/scan failed");
    return NextResponse.json({ error: "scan failed" }, { status: 500 });
  }
}
