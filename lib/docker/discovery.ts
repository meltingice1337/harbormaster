import type Docker from "dockerode";
import type { ContainerInspectInfo, ImageInspectInfo } from "dockerode";

import { dockerClient } from "@/lib/docker/client";
import { getConfig } from "@/lib/config";
import { logger } from "@/lib/log";
import type { ChangelogSource, WatchedContainer } from "@/lib/types";

const SELF_NAME = "harbormaster";

export async function listWatchedContainers(): Promise<WatchedContainer[]> {
  const docker = dockerClient();
  const config = getConfig();

  const watchList = config.HM_WATCH;
  const targets = watchList.length ? new Set(watchList) : null;

  const containers = await docker.listContainers({ all: true });

  const results: WatchedContainer[] = [];

  for (const c of containers) {
    const name = (c.Names?.[0] ?? "").replace(/^\//, "");
    if (!name || name === SELF_NAME) continue;
    if (targets && !targets.has(name)) continue;

    try {
      const watched = await inspectAsWatched(docker, name);
      if (watched) results.push(watched);
    } catch (err) {
      logger.warn({ err, container: name }, "discovery: failed to inspect container");
    }
  }

  // If HM_WATCH listed containers that aren't running, surface them as missing.
  if (targets) {
    const found = new Set(results.map((r) => r.name));
    for (const wanted of targets) {
      if (found.has(wanted)) continue;
      results.push(missingContainer(wanted));
      logger.warn({ container: wanted }, "discovery: watched container not found");
    }
  }

  return results;
}

async function inspectAsWatched(
  docker: Docker,
  name: string,
): Promise<WatchedContainer | null> {
  const container = docker.getContainer(name);
  const inspect = await container.inspect();
  const image = inspect.Config?.Image ?? "";
  if (!image) return null;

  const imageInspect = await safeInspectImage(docker, inspect.Image);

  const labels = imageInspect?.Config?.Labels ?? inspect.Config?.Labels ?? {};
  const sourceRepo = labels["org.opencontainers.image.source"] ?? null;
  const currentVersion = labels["org.opencontainers.image.version"] ?? null;
  const currentDigest = primaryDigest(imageInspect, inspect);

  const config = getConfig();
  const override = config.changelogOverrides.get(name);
  const changelogSource = override ?? deriveChangelogSource(sourceRepo);

  return {
    name,
    image,
    currentVersion,
    currentDigest,
    sourceRepo,
    changelogSource,
    status: inspect.State?.Running ? "running" : "exited",
    lastUpdatedAt: null,
    lastUpdatedFrom: null,
    lastUpdatedTo: null,
  };
}

async function safeInspectImage(
  docker: Docker,
  imageId: string | undefined,
): Promise<ImageInspectInfo | null> {
  if (!imageId) return null;
  try {
    return await docker.getImage(imageId).inspect();
  } catch {
    return null;
  }
}

function primaryDigest(
  image: ImageInspectInfo | null,
  container: ContainerInspectInfo,
): string | null {
  const repoDigests = image?.RepoDigests ?? [];
  if (repoDigests.length > 0) {
    const first = repoDigests[0];
    const at = first.indexOf("@");
    return at >= 0 ? first.slice(at + 1) : first;
  }
  return image?.Id ?? container.Image ?? null;
}

function missingContainer(name: string): WatchedContainer {
  return {
    name,
    image: "",
    currentVersion: null,
    currentDigest: null,
    sourceRepo: null,
    changelogSource: { type: "none" },
    status: "missing",
    lastUpdatedAt: null,
    lastUpdatedFrom: null,
    lastUpdatedTo: null,
  };
}

function deriveChangelogSource(sourceRepo: string | null): ChangelogSource {
  if (!sourceRepo) return { type: "none" };
  // e.g. https://github.com/home-assistant/core or git@github.com:owner/repo.git
  const match =
    /github\.com[/:]([^/]+)\/([^/.]+)(?:\.git)?(?:[/?#]|$)/.exec(sourceRepo);
  if (!match) return { type: "none" };
  return { type: "github", owner: match[1], repo: match[2] };
}
