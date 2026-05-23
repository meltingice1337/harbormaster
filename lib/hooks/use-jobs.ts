"use client";

import { useEffect, useRef, useState } from "react";

import type { Job } from "@/lib/types";

type JobsByContainer = Map<string, Job>;

const ACTIVE_PHASES = new Set<Job["phase"]>([
  "queued",
  "pulling",
  "recreating",
  "starting",
]);

// How long to keep a `done`/`failed` job in the UI map after it terminates,
// so the card can render a clean final state instead of flashing back to
// "Update available" while the dashboard scan refresh is in flight.
const TERMINAL_VISIBLE_MS = 4_000;

export function useJobs(onTerminal?: (job: Job) => void): JobsByContainer {
  const [byContainer, setByContainer] = useState<JobsByContainer>(new Map());
  const onTerminalRef = useRef<typeof onTerminal>(undefined);

  useEffect(() => {
    onTerminalRef.current = onTerminal;
  }, [onTerminal]);

  useEffect(() => {
    const source = new EventSource("/api/events");
    const seenTerminal = new Set<string>();
    const evictionTimers = new Map<string, ReturnType<typeof setTimeout>>();

    source.addEventListener("snapshot", (evt) => {
      const { jobs } = JSON.parse((evt as MessageEvent).data) as { jobs: Job[] };
      setByContainer(buildMap(jobs));
    });

    source.addEventListener("job", (evt) => {
      const job = JSON.parse((evt as MessageEvent).data) as Job;
      const existingTimer = evictionTimers.get(job.container);
      if (existingTimer) {
        clearTimeout(existingTimer);
        evictionTimers.delete(job.container);
      }

      setByContainer((prev) => {
        const next = new Map(prev);
        next.set(job.container, job);
        return next;
      });

      if (!ACTIVE_PHASES.has(job.phase)) {
        if (!seenTerminal.has(job.id)) {
          seenTerminal.add(job.id);
          onTerminalRef.current?.(job);
        }
        const timer = setTimeout(() => {
          evictionTimers.delete(job.container);
          setByContainer((prev) => {
            const cur = prev.get(job.container);
            if (cur?.id !== job.id) return prev;
            const next = new Map(prev);
            next.delete(job.container);
            return next;
          });
        }, TERMINAL_VISIBLE_MS);
        evictionTimers.set(job.container, timer);
      }
    });

    return () => {
      source.close();
      for (const t of evictionTimers.values()) clearTimeout(t);
      evictionTimers.clear();
    };
  }, []);

  return byContainer;
}

function buildMap(jobs: Job[]): JobsByContainer {
  const map = new Map<string, Job>();
  for (const job of jobs) {
    map.set(job.container, job);
  }
  return map;
}
