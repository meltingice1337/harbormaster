import { Cron } from "croner";

import { getConfig } from "@/lib/config";
import { logger } from "@/lib/log";
import { fetchChangelog } from "@/lib/changelog";
import { listWatchedContainers } from "@/lib/docker/discovery";
import { getRemoteDigest } from "@/lib/docker/registry";
import { pullAndRecreate } from "@/lib/docker/updater";
import {
  isSkipped,
  loadState,
  markChecked,
  markSkipped,
  recordEvent,
} from "@/lib/state";
import type {
  DashboardState,
  PendingUpdate,
  WatchedContainer,
} from "@/lib/types";

export type ScanResult = {
  watched: WatchedContainer[];
  pending: PendingUpdate[];
};

export async function scan(): Promise<ScanResult> {
  const watched = await listWatchedContainers();
  const state = await loadState();
  const pending: PendingUpdate[] = [];

  await Promise.all(
    watched.map(async (container) => {
      if (container.status !== "running") return;
      const remote = await getRemoteDigest(container.image);
      if (!remote) return;
      if (container.currentDigest && container.currentDigest === remote) return;

      let changelog: PendingUpdate["changelog"] = [];
      try {
        changelog = await fetchChangelog(container.changelogSource, container.currentVersion);
      } catch (err) {
        logger.warn({ err, container: container.name }, "orchestrator: changelog fetch failed");
      }

      const newVersion = changelog[0]?.version ?? null;
      const kind: PendingUpdate["kind"] = newVersion ? "version-bump" : "rebuild";

      if (newVersion && isSkipped(state, container.name, newVersion)) {
        logger.debug({ container: container.name, version: newVersion }, "orchestrator: skipped");
        return;
      }

      pending.push({
        container,
        newVersion,
        newDigest: remote,
        changelog,
        kind,
      });
    }),
  );

  await markChecked();
  return { watched, pending };
}

export async function apply(name: string): Promise<void> {
  const watched = await listWatchedContainers();
  const target = watched.find((c) => c.name === name);
  if (!target) throw new Error(`not in watch list: ${name}`);

  try {
    const result = await pullAndRecreate(name);
    const refreshed = await refreshOne(name);
    await recordEvent({
      timestamp: new Date().toISOString(),
      type: "updated",
      container: name,
      fromVersion: target.currentVersion,
      toVersion: refreshed?.currentVersion ?? target.currentVersion,
    });
    invalidateDashboardCache();
    logger.info({ result }, "orchestrator: applied");
  } catch (err) {
    await recordEvent({
      timestamp: new Date().toISOString(),
      type: "failed",
      container: name,
      fromVersion: target.currentVersion,
      error: err instanceof Error ? err.message : String(err),
    });
    invalidateDashboardCache();
    throw err;
  }
}

export async function skip(name: string, version: string): Promise<void> {
  await markSkipped(name, version);
  invalidateDashboardCache();
}

async function refreshOne(name: string): Promise<WatchedContainer | null> {
  const watched = await listWatchedContainers();
  return watched.find((c) => c.name === name) ?? null;
}

const SCAN_TTL_MS = 30_000;
let scanCache: { value: ScanResult; expiresAt: number } | null = null;

export function invalidateDashboardCache(): void {
  scanCache = null;
}

export async function buildDashboardState(options?: { fresh?: boolean }): Promise<DashboardState> {
  const config = getConfig();
  const scanResult =
    !options?.fresh && scanCache && scanCache.expiresAt > Date.now()
      ? scanCache.value
      : await scanAndCache();
  const state = await loadState();

  return {
    watched: scanResult.watched,
    pending: scanResult.pending,
    lastCheckAt: state.lastCheckAt,
    nextCheckAt: computeNextCheck(config.HM_SCHEDULE),
    schedule: config.HM_SCHEDULE,
    activityLog: state.activityLog.slice(0, 20),
  };
}

async function scanAndCache(): Promise<ScanResult> {
  const result = await scan();
  scanCache = { value: result, expiresAt: Date.now() + SCAN_TTL_MS };
  return result;
}

function computeNextCheck(schedule: string): string | null {
  try {
    const job = new Cron(schedule, { paused: true });
    const next = job.nextRun();
    job.stop();
    return next?.toISOString() ?? null;
  } catch (err) {
    logger.warn({ err, schedule }, "orchestrator: bad schedule expression");
    return null;
  }
}
