import { fetchGitHubChangelog } from "@/lib/changelog/github";
import { fetchServarrChangelog } from "@/lib/changelog/servarr";
import type { ChangelogEntry, ChangelogSource } from "@/lib/types";

export async function fetchChangelog(
  source: ChangelogSource,
  currentVersion: string | null,
): Promise<ChangelogEntry[]> {
  switch (source.type) {
    case "github":
      return fetchGitHubChangelog(source.owner, source.repo, currentVersion);
    case "servarr":
      return fetchServarrChangelog(source.branch);
    case "none":
      return [];
  }
}
