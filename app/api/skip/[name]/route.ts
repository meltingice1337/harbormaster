import { NextResponse } from "next/server";

import { logger } from "@/lib/log";
import { skip } from "@/lib/orchestrator";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ name: string }> },
) {
  const { name } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { version?: string };
  if (!body.version) {
    return NextResponse.json({ error: "missing version" }, { status: 400 });
  }
  try {
    await skip(name, body.version);
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error({ err, name }, "api/skip failed");
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
