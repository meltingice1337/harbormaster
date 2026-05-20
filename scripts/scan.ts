import { scan, buildDashboardState } from "@/lib/orchestrator";

async function main() {
  const result = await scan();
  console.log(`watched: ${result.watched.length}`);
  console.log(`pending: ${result.pending.length}`);
  for (const p of result.pending) {
    console.log(
      `  ⬆ ${p.container.name} (${p.kind}) version=${p.newVersion ?? "?"} changelog=${p.changelog.length} entries`,
    );
    for (const c of p.changelog.slice(0, 1)) {
      console.log(`    ${c.version}: ${c.bodyMarkdown.split("\n")[0]?.slice(0, 80) ?? ""}`);
    }
  }
  const dashboard = await buildDashboardState();
  console.log(`\nlastCheckAt: ${dashboard.lastCheckAt}`);
  console.log(`nextCheckAt: ${dashboard.nextCheckAt}`);
  console.log(`schedule: ${dashboard.schedule}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
