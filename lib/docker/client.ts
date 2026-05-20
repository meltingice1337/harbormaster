import Docker from "dockerode";

let cached: Docker | null = null;

export function dockerClient(): Docker {
  if (!cached) cached = new Docker({ socketPath: "/var/run/docker.sock" });
  return cached;
}
