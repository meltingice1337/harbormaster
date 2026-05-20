import { Dashboard } from "@/components/dashboard";
import { buildDashboardState } from "@/lib/orchestrator";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const initial = await buildDashboardState();
  return <Dashboard initial={initial} />;
}
