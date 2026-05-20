import { listWatchedContainers } from "@/lib/docker/discovery";
import { fetchChangelog } from "@/lib/changelog";

async function main() {
  const target = process.argv[2];
  if (!target) {
    console.error("usage: yarn changelog <container-name>");
    process.exit(1);
  }
  const containers = await listWatchedContainers();
  const c = containers.find((x) => x.name === target);
  if (!c) {
    console.error(`container not found in watch list: ${target}`);
    process.exit(1);
  }
  const entries = await fetchChangelog(c.changelogSource, c.currentVersion);
  for (const e of entries) {
    console.log(`\n=== ${e.version} (${e.publishedAt ?? "?"}) ===`);
    console.log(e.bodyMarkdown.slice(0, 600));
    if (e.htmlUrl) console.log(`-> ${e.htmlUrl}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
