import { logger } from "@/lib/log";
import { getConfig } from "@/lib/config";
import type { ChangelogEntry } from "@/lib/types";

type GitHubRelease = {
  tag_name: string;
  name: string | null;
  body: string | null;
  published_at: string | null;
  html_url: string;
  draft: boolean;
  prerelease: boolean;
};

const MAX_RELEASES = 5;

export async function fetchGitHubChangelog(
  owner: string,
  repo: string,
  currentVersion: string | null,
): Promise<ChangelogEntry[]> {
  const config = getConfig();
  const url = `https://api.github.com/repos/${owner}/${repo}/releases?per_page=20`;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "harbormaster",
  };
  if (config.HM_GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${config.HM_GITHUB_TOKEN}`;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    logger.warn({ owner, repo, status: res.status }, "changelog: github fetch failed");
    return [];
  }

  const releases = (await res.json()) as GitHubRelease[];
  const filtered = releases.filter((r) => !r.draft && !r.prerelease);
  if (filtered.length === 0) return [];

  const newer = filterNewerThan(filtered, currentVersion);
  const picked = (newer.length > 0 ? newer : filtered.slice(0, 1)).slice(0, MAX_RELEASES);

  return picked.map((r) => ({
    version: r.tag_name,
    publishedAt: r.published_at,
    bodyMarkdown: r.body ?? "",
    htmlUrl: r.html_url,
  }));
}

function filterNewerThan(
  releases: GitHubRelease[],
  currentVersion: string | null,
): GitHubRelease[] {
  if (!currentVersion) return [];
  const current = normalize(currentVersion);
  return releases.filter((r) => {
    const tag = normalize(r.tag_name);
    return compareVersions(tag, current) > 0;
  });
}

function normalize(v: string): string {
  return v.replace(/^v/i, "").trim();
}

// Crude version comparison: split on non-digits, compare numerically per segment,
// fall back to lexicographic. Good enough for typical version strings.
function compareVersions(a: string, b: string): number {
  const ap = a.split(/[.\-+]/);
  const bp = b.split(/[.\-+]/);
  const len = Math.max(ap.length, bp.length);
  for (let i = 0; i < len; i++) {
    const av = ap[i] ?? "0";
    const bv = bp[i] ?? "0";
    const an = Number(av);
    const bn = Number(bv);
    const aIsNum = Number.isFinite(an) && /^\d+$/.test(av);
    const bIsNum = Number.isFinite(bn) && /^\d+$/.test(bv);
    if (aIsNum && bIsNum) {
      if (an !== bn) return an - bn;
    } else {
      if (av !== bv) return av < bv ? -1 : 1;
    }
  }
  return 0;
}
