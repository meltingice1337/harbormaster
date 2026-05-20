import { logger } from "@/lib/log";
import type { ChangelogEntry } from "@/lib/types";

// Servarr (Sonarr/Radarr/Prowlarr/Lidarr) publish updates via their custom service:
//   https://services.sonarr.tv/v1/update/<branch>/changes?version=&os=linux&runtime=netcore
//   https://services.prowlarr.com/v1/update/<branch>/changes?...
type ServarrChange = {
  version: string;
  releaseDate: string;
  fixed?: string[];
  new?: string[];
};

const BASE_BY_BRANCH: Record<string, string> = {
  // Sonarr branches
  main: "https://services.sonarr.tv/v1/update/main/changes",
  develop: "https://services.sonarr.tv/v1/update/develop/changes",
  // Prowlarr branches (master/develop)
  master: "https://services.prowlarr.com/v1/update/master/changes",
  // (We pick a sensible default per name elsewhere if needed.)
};

const MAX_ENTRIES = 5;

export async function fetchServarrChangelog(branch: string): Promise<ChangelogEntry[]> {
  const url = BASE_BY_BRANCH[branch];
  if (!url) {
    logger.warn({ branch }, "changelog: unknown servarr branch");
    return [];
  }

  const res = await fetch(`${url}?os=linux&runtime=netcore`);
  if (!res.ok) {
    logger.warn({ branch, status: res.status }, "changelog: servarr fetch failed");
    return [];
  }

  const list = (await res.json()) as ServarrChange[];
  return list.slice(0, MAX_ENTRIES).map((entry) => ({
    version: entry.version,
    publishedAt: entry.releaseDate,
    bodyMarkdown: renderBody(entry),
    htmlUrl: null,
  }));
}

function renderBody(entry: ServarrChange): string {
  const parts: string[] = [];
  if (entry.new?.length) {
    parts.push("**New**");
    for (const n of entry.new) parts.push(`- ${n}`);
  }
  if (entry.fixed?.length) {
    parts.push("**Fixed**");
    for (const f of entry.fixed) parts.push(`- ${f}`);
  }
  return parts.join("\n");
}
