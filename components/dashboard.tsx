"use client";

import { useCallback, useEffect, useState } from "react";

import { ActivityLog } from "@/components/activity-log";
import { ContainerCard } from "@/components/container-card";
import { Header } from "@/components/header";
import { StatsBar } from "@/components/stats-bar";
import type { DashboardState, PendingUpdate } from "@/lib/types";

const POLL_INTERVAL_MS = 30_000;

export function Dashboard({ initial }: { initial: DashboardState }) {
  const [state, setState] = useState(initial);

  const refresh = useCallback(async (fresh = false) => {
    const res = await fetch(fresh ? "/api/scan" : "/api/state", {
      method: fresh ? "POST" : "GET",
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const next = (await res.json()) as DashboardState;
    setState(next);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      void refresh(false).catch(() => {});
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const pendingByName = new Map<string, PendingUpdate>(
    state.pending.map((p) => [p.container.name, p]),
  );
  const sorted = [...state.watched].sort((a, b) => {
    const ap = pendingByName.has(a.name) ? 0 : 1;
    const bp = pendingByName.has(b.name) ? 0 : 1;
    if (ap !== bp) return ap - bp;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto w-full">
      <Header onRefresh={() => refresh(true)} />
      <StatsBar
        watched={state.watched.length}
        pending={state.pending.length}
        lastCheckAt={state.lastCheckAt}
        nextCheckAt={state.nextCheckAt}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-3">
          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              No containers under management. Set <code>HM_WATCH</code> or run docker.
            </p>
          ) : (
            sorted.map((c) => (
              <ContainerCard
                key={c.name}
                container={c}
                pending={pendingByName.get(c.name)}
                onActionDone={() => refresh(true)}
              />
            ))
          )}
        </div>
        <div className="lg:col-span-1">
          <ActivityLog events={state.activityLog} />
        </div>
      </div>
    </div>
  );
}
