import { NextResponse } from "next/server";

import { logger } from "@/lib/log";
import { enqueueApply } from "@/lib/orchestrator";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ name: string }> },
) {
  const { name } = await ctx.params;
  try {
    const job = enqueueApply(name);
    return NextResponse.json(
      { ok: true, jobId: job.id, container: name, phase: job.phase },
      { status: 202 },
    );
  } catch (err) {
    logger.error({ err, name }, "api/update failed");
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
