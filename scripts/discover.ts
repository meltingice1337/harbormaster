import { listWatchedContainers } from "@/lib/docker/discovery";

async function main() {
  const containers = await listWatchedContainers();
  for (const c of containers) {
    const cl =
      c.changelogSource.type === "github"
        ? `github:${c.changelogSource.owner}/${c.changelogSource.repo}`
        : c.changelogSource.type === "servarr"
          ? `servarr:${c.changelogSource.branch}`
          : "none";
    console.log(
      `${c.name.padEnd(20)} ${c.status.padEnd(8)} ${(c.currentVersion ?? "?").padEnd(20)} ${cl.padEnd(40)} ${c.image}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
