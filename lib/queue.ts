import { EventEmitter } from "node:events";

import { logger } from "@/lib/log";
import type { Job, JobPhase } from "@/lib/types";

const ACTIVE_PHASES: ReadonlySet<JobPhase> = new Set([
  "queued",
  "pulling",
  "recreating",
  "starting",
]);

type JobEvent = { type: "job"; job: Job };
type SnapshotEvent = { type: "snapshot"; jobs: Job[] };
export type QueueEvent = JobEvent | SnapshotEvent;

type Runner = (job: Job, onPhase: (phase: JobPhase) => void) => Promise<void>;

// Next.js can load this module twice — once via the API route bundle and once
// via the workers/instrumentation bundle — which would mean Telegram-triggered
// jobs (worker instance) and SSE subscribers (route instance) talk to
// different EventEmitters. Pinning the queue state to globalThis keeps a
// single shared instance regardless of how many times the module is loaded.
type QueueState = {
  emitter: EventEmitter;
  jobs: Map<string, Job>;
  pending: string[];
  processing: boolean;
  runner: Runner | null;
};

const GLOBAL_KEY = "__harbormaster_queue__";
type GlobalScope = typeof globalThis & { [GLOBAL_KEY]?: QueueState };
const g = globalThis as GlobalScope;

function getState(): QueueState {
  let s = g[GLOBAL_KEY];
  if (!s) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(0);
    s = {
      emitter,
      jobs: new Map(),
      pending: [],
      processing: false,
      runner: null,
    };
    g[GLOBAL_KEY] = s;
  }
  return s;
}

export function setQueueRunner(fn: Runner): void {
  getState().runner = fn;
}

export function onQueueEvent(listener: (e: JobEvent) => void): () => void {
  const s = getState();
  s.emitter.on("job", listener);
  return () => s.emitter.off("job", listener);
}

export function listJobs(): Job[] {
  return Array.from(getState().jobs.values()).sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
}

export function getJob(id: string): Job | null {
  return getState().jobs.get(id) ?? null;
}

export function findActiveJobForContainer(container: string): Job | null {
  for (const job of getState().jobs.values()) {
    if (job.container === container && ACTIVE_PHASES.has(job.phase)) return job;
  }
  return null;
}

export function enqueueJob(container: string): Job {
  const existing = findActiveJobForContainer(container);
  if (existing) return existing;

  const s = getState();
  const job: Job = {
    id: randomId(),
    container,
    phase: "queued",
    createdAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
    error: null,
  };
  s.jobs.set(job.id, job);
  s.pending.push(job.id);
  emit(job);
  void drain();
  return job;
}

async function drain(): Promise<void> {
  const s = getState();
  if (s.processing) return;
  s.processing = true;
  try {
    while (s.pending.length > 0) {
      const id = s.pending.shift()!;
      const job = s.jobs.get(id);
      if (!job) continue;
      await run(job);
    }
  } finally {
    s.processing = false;
  }
}

async function run(job: Job): Promise<void> {
  const s = getState();
  if (!s.runner) {
    update(job, { phase: "failed", error: "queue runner not registered" });
    return;
  }

  update(job, { startedAt: new Date().toISOString() });

  try {
    await s.runner(job, (phase) => update(job, { phase }));
    update(job, { phase: "done", finishedAt: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, container: job.container }, "queue: job failed");
    update(job, {
      phase: "failed",
      error: message,
      finishedAt: new Date().toISOString(),
    });
  }

  // Retain terminal jobs briefly so SSE subscribers/UI can render the final
  // state, then drop them so the in-memory map doesn't grow unbounded.
  setTimeout(() => {
    s.jobs.delete(job.id);
  }, 60_000);
}

function update(job: Job, patch: Partial<Job>): void {
  Object.assign(job, patch);
  emit(job);
}

function emit(job: Job): void {
  getState().emitter.emit("job", { type: "job", job: { ...job } });
}

function randomId(): string {
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}
