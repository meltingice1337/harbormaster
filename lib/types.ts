export type ChangelogSource =
  | { type: "github"; owner: string; repo: string }
  | { type: "servarr"; branch: string }
  | { type: "none" };

export type WatchedContainer = {
  name: string;
  image: string;
  currentVersion: string | null;
  currentDigest: string | null;
  sourceRepo: string | null;
  changelogSource: ChangelogSource;
  status: "running" | "exited" | "missing";
};

export type ChangelogEntry = {
  version: string;
  publishedAt: string | null;
  bodyMarkdown: string;
  htmlUrl: string | null;
};

export type PendingUpdate = {
  container: WatchedContainer;
  newVersion: string | null;
  newDigest: string;
  changelog: ChangelogEntry[];
  kind: "version-bump" | "rebuild";
};

export type ActivityEvent = {
  timestamp: string;
  type: "check" | "updated" | "skipped" | "failed";
  container?: string;
  fromVersion?: string | null;
  toVersion?: string | null;
  error?: string;
};

export type PersistedState = {
  schemaVersion: 1;
  skippedVersions: Record<string, string[]>;
  activityLog: ActivityEvent[];
  lastCheckAt: string | null;
};

export type DashboardState = {
  watched: WatchedContainer[];
  pending: PendingUpdate[];
  lastCheckAt: string | null;
  nextCheckAt: string | null;
  schedule: string;
  activityLog: ActivityEvent[];
};
