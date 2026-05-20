import { NextResponse } from "next/server";

import { buildDashboardState } from "@/lib/orchestrator";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const state = await buildDashboardState();
    return NextResponse.json({
      watched: state.watched.length,
      pending: state.pending.length,
      last_check: state.lastCheckAt,
      next_check: state.nextCheckAt,
    });
  } catch {
    return NextResponse.json(
      { watched: 0, pending: 0, last_check: null, next_check: null, error: true },
      { status: 503 },
    );
  }
}
