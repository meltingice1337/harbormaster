import { logger } from "@/lib/log";

const MANIFEST_ACCEPT = [
  "application/vnd.oci.image.index.v1+json",
  "application/vnd.oci.image.manifest.v1+json",
  "application/vnd.docker.distribution.manifest.list.v2+json",
  "application/vnd.docker.distribution.manifest.v2+json",
].join(", ");

type ParsedRef = {
  registry: string;
  repo: string;
  tag: string;
};

export function parseImageRef(ref: string): ParsedRef {
  let remainder = ref;

  // Strip digest if present (we want to look up the tag's current digest)
  const atIdx = remainder.indexOf("@");
  if (atIdx >= 0) remainder = remainder.slice(0, atIdx);

  let registry = "docker.io";
  const firstSlash = remainder.indexOf("/");
  if (firstSlash >= 0) {
    const candidate = remainder.slice(0, firstSlash);
    if (candidate.includes(".") || candidate.includes(":") || candidate === "localhost") {
      registry = candidate;
      remainder = remainder.slice(firstSlash + 1);
    }
  }

  let tag = "latest";
  const colonIdx = remainder.lastIndexOf(":");
  if (colonIdx >= 0 && !remainder.slice(colonIdx).includes("/")) {
    tag = remainder.slice(colonIdx + 1);
    remainder = remainder.slice(0, colonIdx);
  }

  let repo = remainder;
  if (registry === "docker.io" && !repo.includes("/")) repo = `library/${repo}`;

  return { registry, repo, tag };
}

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function fetchToken(authHeader: string, repo: string): Promise<string | null> {
  // www-authenticate: Bearer realm="https://...",service="...",scope="..."
  const realmMatch = /realm="([^"]+)"/.exec(authHeader);
  const serviceMatch = /service="([^"]+)"/.exec(authHeader);
  if (!realmMatch) return null;

  const url = new URL(realmMatch[1]);
  if (serviceMatch) url.searchParams.set("service", serviceMatch[1]);
  url.searchParams.set("scope", `repository:${repo}:pull`);

  const cacheKey = url.toString();
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.token;

  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    logger.debug({ url: url.toString(), status: res.status }, "registry: token fetch failed (private image?)");
    return null;
  }
  const body = (await res.json()) as { token?: string; access_token?: string; expires_in?: number };
  const token = body.token ?? body.access_token ?? null;
  if (!token) return null;

  tokenCache.set(cacheKey, {
    token,
    expiresAt: Date.now() + (body.expires_in ?? 60) * 1000 - 5000,
  });
  return token;
}

function manifestUrl({ registry, repo, tag }: ParsedRef): string {
  const host = registry === "docker.io" ? "registry-1.docker.io" : registry;
  return `https://${host}/v2/${repo}/manifests/${tag}`;
}

export async function getRemoteDigest(image: string): Promise<string | null> {
  const ref = parseImageRef(image);
  const url = manifestUrl(ref);

  const headers: Record<string, string> = { Accept: MANIFEST_ACCEPT };

  // Try unauthenticated first; if 401, fetch token and retry.
  let res = await fetch(url, { method: "HEAD", headers });

  if (res.status === 401) {
    const auth = res.headers.get("www-authenticate");
    if (!auth) {
      logger.debug({ image }, "registry: 401 without www-authenticate");
      return null;
    }
    const token = await fetchToken(auth, ref.repo);
    if (!token) return null;
    headers.Authorization = `Bearer ${token}`;
    res = await fetch(url, { method: "HEAD", headers });
  }

  if (!res.ok) {
    // 401/403 typically mean private images — quiet by default, surface other failures.
    if (res.status === 401 || res.status === 403) {
      logger.debug({ image, status: res.status }, "registry: manifest unauthorized (private?)");
    } else {
      logger.warn({ image, status: res.status }, "registry: manifest HEAD failed");
    }
    return null;
  }

  return res.headers.get("docker-content-digest");
}

export function digestsMatch(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  return a === b;
}
