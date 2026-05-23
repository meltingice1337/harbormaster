import type Docker from "dockerode";
import type { ContainerCreateOptions, ContainerInspectInfo } from "dockerode";

import { dockerClient } from "@/lib/docker/client";
import { logger } from "@/lib/log";
import type { JobPhase } from "@/lib/types";

const STOP_TIMEOUT_SECONDS = 30;

export type UpdateResult = {
  container: string;
  oldImage: string;
  newDigest: string | null;
};

export type PhaseReporter = (phase: JobPhase) => void;

export async function pullAndRecreate(
  name: string,
  onPhase?: PhaseReporter,
): Promise<UpdateResult> {
  const docker = dockerClient();
  const existing = docker.getContainer(name);
  const inspect = await existing.inspect();
  const image = inspect.Config.Image;
  if (!image) throw new Error(`container ${name} has no image`);

  onPhase?.("pulling");
  logger.info({ name, image }, "updater: pulling image");
  await pullImage(docker, image);

  const newImage = await docker.getImage(image).inspect();
  const newDigest = newImage.RepoDigests?.[0] ?? newImage.Id ?? null;

  onPhase?.("recreating");
  logger.info({ name }, "updater: stopping container");
  await stopIfRunning(existing);

  logger.info({ name }, "updater: removing container");
  await existing.remove({ force: true, v: false });

  const createOptions = buildCreateOptions(inspect);
  logger.info({ name }, "updater: creating new container");
  const created = await docker.createContainer(createOptions);

  onPhase?.("starting");
  logger.info({ name }, "updater: starting new container");
  await created.start();

  return { container: name, oldImage: image, newDigest };
}

async function stopIfRunning(container: Docker.Container): Promise<void> {
  try {
    await container.stop({ t: STOP_TIMEOUT_SECONDS });
  } catch (err) {
    const e = err as { statusCode?: number };
    // 304 = already stopped
    if (e.statusCode !== 304) throw err;
  }
}

function pullImage(docker: Docker, image: string): Promise<void> {
  return new Promise((resolve, reject) => {
    docker.pull(image, (err: Error | null, stream: NodeJS.ReadableStream) => {
      if (err) return reject(err);
      docker.modem.followProgress(
        stream,
        (finishErr: Error | null) => (finishErr ? reject(finishErr) : resolve()),
        () => {
          /* progress events ignored */
        },
      );
    });
  });
}

function buildCreateOptions(inspect: ContainerInspectInfo): ContainerCreateOptions {
  const name = inspect.Name.replace(/^\//, "");
  const config = inspect.Config;

  return {
    name,
    Image: config.Image,
    Hostname: config.Hostname,
    Domainname: config.Domainname,
    User: config.User,
    AttachStdin: config.AttachStdin,
    AttachStdout: config.AttachStdout,
    AttachStderr: config.AttachStderr,
    Tty: config.Tty,
    OpenStdin: config.OpenStdin,
    StdinOnce: config.StdinOnce,
    Env: config.Env,
    Cmd: config.Cmd,
    Entrypoint: config.Entrypoint,
    Labels: config.Labels,
    Volumes: config.Volumes,
    WorkingDir: config.WorkingDir,
    ExposedPorts: config.ExposedPorts,
    HostConfig: inspect.HostConfig,
    NetworkingConfig: buildNetworkingConfig(inspect),
    Healthcheck: config.Healthcheck,
  };
}

function buildNetworkingConfig(
  inspect: ContainerInspectInfo,
): ContainerCreateOptions["NetworkingConfig"] {
  const networks = inspect.NetworkSettings?.Networks ?? {};
  const names = Object.keys(networks);
  if (names.length === 0) return undefined;

  // Docker only allows one network at create time; additional must be attached after.
  // For network_mode: host, the network is "host" and HostConfig.NetworkMode handles it.
  const primary = names[0];
  const settings = networks[primary];
  return {
    EndpointsConfig: {
      [primary]: {
        Aliases: settings?.Aliases ?? undefined,
        IPAMConfig: settings?.IPAMConfig ?? undefined,
        Links: settings?.Links ?? undefined,
      },
    },
  };
}
