import { listWatchedContainers } from "@/lib/docker/discovery";
import { getRemoteDigest, digestsMatch } from "@/lib/docker/registry";

async function main() {
  const containers = await listWatchedContainers();
  for (const c of containers) {
    if (c.status !== "running") {
      console.log(`${c.name.padEnd(20)} [${c.status}]`);
      continue;
    }
    const remote = await getRemoteDigest(c.image);
    const match = digestsMatch(c.currentDigest, remote);
    const flag = remote === null ? "?" : match ? "✓" : "⬆";
    console.log(
      `${flag} ${c.name.padEnd(18)} local=${(c.currentDigest ?? "?").slice(0, 19)}… remote=${(remote ?? "?").slice(0, 19)}… ${c.currentVersion ?? ""}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
