"use client";

import { useEffect, useState } from "react";

import { formatAbsoluteShort, relativeTime } from "@/lib/format";

function useClientTick(intervalMs: number): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    setTick(1); // mark "mounted"
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return tick;
}

export function TimeAgo({ iso }: { iso: string | null | undefined }) {
  const tick = useClientTick(15_000);
  // Render a stable placeholder on the server so SSR matches first client render.
  if (tick === 0) {
    return <span suppressHydrationWarning>{iso ? "…" : "never"}</span>;
  }
  return <span>{relativeTime(iso)}</span>;
}

export function AbsoluteTime({ iso }: { iso: string | null | undefined }) {
  const tick = useClientTick(60_000);
  // Server-side locale differs from client; render placeholder until mounted.
  if (tick === 0) {
    return <span suppressHydrationWarning>{iso ? "…" : "—"}</span>;
  }
  return <span>{formatAbsoluteShort(iso)}</span>;
}
