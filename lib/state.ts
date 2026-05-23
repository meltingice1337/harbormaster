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
  lastUpdated: {},
};

// Pin cache + mutateChain to globalThis so Next.js module-duplication
// (route bundle vs instrumentation bundle) doesn't give us two parallel
// in-memory copies that each clobber the other's writes.
type StateGlobals = {
  cache: PersistedState | null;
  mutateChain: Promise<unknown>;
};
const GLOBAL_KEY = "__harbormaster_state__";
type GlobalScope = typeof globalThis & { [GLOBAL_KEY]?: StateGlobals };
const g = globalThis as GlobalScope;
function globals(): StateGlobals {
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = { cache: null, mutateChain: Promise.resolve() };
  }
  return g[GLOBAL_KEY];
}

function statePath(): string {
  return path.join(getConfig().STATE_DIR, "state.json");
}

export async function loadState(): Promise<PersistedState> {
  const gs = globals();
  if (gs.cache) return gs.cache;

  const filePath = statePath();
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as PersistedState;
    if (parsed.schemaVersion !== 1) {
      throw new Error(`unknown state schema version: ${parsed.schemaVersion}`);
    }
    parsed.lastDetected ??= {};
    parsed.lastUpdated ??= {};
    // One-time backfill so cards immediately show prior updates that pre-date
    // the lastUpdated map. The activity log is walked oldest → newest so the
    // most recent "updated" event wins per container.
    backfillLastUpdated(parsed);
    gs.cache = parsed;
    return parsed;
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") {
      gs.cache = structuredClone(EMPTY_STATE);
      return gs.cache;
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
  globals().cache = state;
}

export async function mutateState(
  mutator: (state: PersistedState) => void | Promise<void>,
): Promise<PersistedState> {
  // Serialize the entire read-modify-write so concurrent callers (e.g. recordEvent
  // from an apply racing with the scan() mutation from a dashboard poll) don't
  // both clone the same pre-mutation snapshot and clobber each other's changes.
  const gs = globals();
  const run = gs.mutateChain.then(async () => {
    const current = await loadState();
    const draft: PersistedState = structuredClone(current);
    await mutator(draft);
    draft.activityLog = draft.activityLog.slice(0, ACTIVITY_CAP);
    await persist(draft);
    return draft;
  });
  gs.mutateChain = run.catch((err) => logger.error({ err }, "state: mutation failed"));
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
  await globals().mutateChain;
}

function backfillLastUpdated(state: PersistedState): void {
  // activityLog is newest-first; iterate from oldest so newer entries overwrite.
  for (let i = state.activityLog.length - 1; i >= 0; i--) {
    const e = state.activityLog[i];
    if (e.type !== "updated" || !e.container) continue;
    state.lastUpdated[e.container] = {
      timestamp: e.timestamp,
      fromVersion: e.fromVersion ?? null,
      toVersion: e.toVersion ?? null,
    };
  }
}
