import { Dashboard } from "@/components/dashboard";
import pkg from "../package.json";

export default function HomePage() {
  return <Dashboard version={pkg.version} />;
}
