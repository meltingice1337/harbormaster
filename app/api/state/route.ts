import { NextResponse } from "next/server";

import { logger } from "@/lib/log";
import { buildDashboardState } from "@/lib/orchestrator";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const state = await buildDashboardState();
    return NextResponse.json(state);
  } catch (err) {
    logger.error({ err }, "api/state failed");
    return NextResponse.json({ error: "failed to build state" }, { status: 500 });
  }
}
