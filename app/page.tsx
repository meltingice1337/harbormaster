import { Dashboard } from "@/components/dashboard";
import { buildDashboardState } from "@/lib/orchestrator";
import pkg from "../package.json";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const initial = await buildDashboardState();
  return <Dashboard initial={initial} version={pkg.version} />;
}
