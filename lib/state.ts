import { promises as fs } from "node:fs";
import path from "node:path";

import { getConfig } from "@/lib/config";
import { logger } from "@/lib/log";
import type { ActivityEvent, PersistedState } from "@/lib/types";

const ACTIVITY_CAP = 100;

const EMPTY_STATE: PersistedState = {
  schemaVersion: 1,
  skippedVersions: {},
  activityLog: [],
  lastCheckAt: null,
  lastDetected: {},
};

let cache: PersistedState | null = null;
let mutateChain: Promise<unknown> = Promise.resolve();

function statePath(): string {
  return path.join(getConfig().STATE_DIR, "state.json");
}

export async function loadState(): Promise<PersistedState> {
  if (cache) return cache;

  const filePath = statePath();
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as PersistedState;
    if (parsed.schemaVersion !== 1) {
      throw new Error(`unknown state schema version: ${parsed.schemaVersion}`);
    }
    parsed.lastDetected ??= {};
    cache = parsed;
    return parsed;
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") {
      cache = structuredClone(EMPTY_STATE);
      return cache;
    }
    logger.error({ err }, "state: failed to read");
    throw err;
  }
}

async function persist(state: PersistedState): Promise<void> {
  const filePath = statePath();
  const tmp = `${filePath}.tmp`;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(tmp, JSON.stringify(state, null, 2), "utf8");
  await fs.rename(tmp, filePath);
  cache = state;
}

export async function mutateState(
  mutator: (state: PersistedState) => void | Promise<void>,
): Promise<PersistedState> {
  // Serialize the entire read-modify-write so concurrent callers (e.g. recordEvent
  // from an apply racing with the scan() mutation from a dashboard poll) don't
  // both clone the same pre-mutation snapshot and clobber each other's changes.
  const run = mutateChain.then(async () => {
    const current = await loadState();
    const draft: PersistedState = structuredClone(current);
    await mutator(draft);
    draft.activityLog = draft.activityLog.slice(0, ACTIVITY_CAP);
    await persist(draft);
    return draft;
  });
  mutateChain = run.catch((err) => logger.error({ err }, "state: mutation failed"));
  return run;
}

export async function recordEvent(event: ActivityEvent): Promise<void> {
  await mutateState((s) => {
    s.activityLog.unshift(event);
  });
}

export async function markSkipped(container: string, version: string): Promise<void> {
  await mutateState((s) => {
    const list = (s.skippedVersions[container] ??= []);
    if (!list.includes(version)) list.push(version);
    s.activityLog.unshift({
      timestamp: new Date().toISOString(),
      type: "skipped",
      container,
      toVersion: version,
    });
  });
}

export function isSkipped(state: PersistedState, container: string, version: string): boolean {
  return (state.skippedVersions[container] ?? []).includes(version);
}

export async function flush(): Promise<void> {
  await mutateChain;
}
