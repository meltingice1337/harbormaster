"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { ActivityLog } from "@/components/activity-log";
import { ContainerCard } from "@/components/container-card";
import { Header } from "@/components/header";
import { StatsBar } from "@/components/stats-bar";
import { Card } from "@/components/ui/card";
import { useJobs } from "@/lib/hooks/use-jobs";
import type { DashboardState, Job, PendingUpdate } from "@/lib/types";

const POLL_INTERVAL_MS = 30_000;

export function Dashboard({ version }: { version: string }) {
  const [state, setState] = useState<DashboardState | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (fresh = false) => {
    const res = await fetch(fresh ? "/api/scan" : "/api/state", {
      method: fresh ? "POST" : "GET",
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const next = (await res.json()) as DashboardState;
    setState(next);
  }, []);

  const onTerminal = useCallback(
    (job: Job) => {
      if (job.phase === "done") {
        toast.success(`Updated ${job.container}`);
        void refresh(true).catch(() => {});
      } else if (job.phase === "failed") {
        toast.error(`Failed ${job.container}`, {
          description: job.error ?? undefined,
        });
        void refresh(false).catch(() => {});
      }
    },
    [refresh],
  );

  const jobsByContainer = useJobs(onTerminal);

  useEffect(() => {
    let cancelled = false;
    refresh(false)
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    const id = setInterval(() => {
      void refresh(false).catch(() => {});
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <div className="flex flex-col gap-4 sm:gap-6 p-3 sm:p-6 max-w-6xl mx-auto w-full">
      <Header version={version} onRefresh={() => refresh(true)} />
      <StatsBar
        watched={state?.watched.length ?? 0}
        pending={state?.pending.length ?? 0}
        lastCheckAt={state?.lastCheckAt ?? null}
        nextCheckAt={state?.nextCheckAt ?? null}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 flex flex-col gap-3">
          {state ? (
            <ContainerList
              state={state}
              jobsByContainer={jobsByContainer}
              onRefresh={() => refresh(true)}
            />
          ) : loading ? (
            <ContainerSkeleton />
          ) : (
            <p className="text-sm text-muted-foreground italic">
              Failed to load. Try refresh.
            </p>
          )}
        </div>
        <div className="lg:col-span-1">
          <ActivityLog events={state?.activityLog ?? []} />
        </div>
      </div>
    </div>
  );
}

function ContainerList({
  state,
  jobsByContainer,
  onRefresh,
}: {
  state: DashboardState;
  jobsByContainer: Map<string, import("@/lib/types").Job>;
  onRefresh: () => Promise<void> | void;
}) {
  const pendingByName = new Map<string, PendingUpdate>(
    state.pending.map((p) => [p.container.name, p]),
  );
  const sorted = [...state.watched].sort((a, b) => {
    // 1) active update jobs at the top
    const aActive = jobsByContainer.has(a.name) ? 0 : 1;
    const bActive = jobsByContainer.has(b.name) ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    // 2) then pending updates (actionable)
    const aPending = pendingByName.has(a.name) ? 0 : 1;
    const bPending = pendingByName.has(b.name) ? 0 : 1;
    if (aPending !== bPending) return aPending - bPending;
    // 3) then most-recently-updated by Harbormaster
    if (a.lastUpdatedAt && b.lastUpdatedAt) {
      if (a.lastUpdatedAt !== b.lastUpdatedAt) {
        return a.lastUpdatedAt < b.lastUpdatedAt ? 1 : -1;
      }
    } else if (a.lastUpdatedAt) {
      return -1;
    } else if (b.lastUpdatedAt) {
      return 1;
    }
    // 4) alphabetical fallback
    return a.name.localeCompare(b.name);
  });

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        No containers under management. Set <code>HM_WATCH</code> or run docker.
      </p>
    );
  }

  return (
    <>
      {sorted.map((c) => (
        <ContainerCard
          key={c.name}
          container={c}
          pending={pendingByName.get(c.name)}
          job={jobsByContainer.get(c.name)}
          onActionDone={() => onRefresh()}
        />
      ))}
    </>
  );
}

function ContainerSkeleton() {
  return (
    <Card className="p-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      Scanning containers…
    </Card>
  );
}
