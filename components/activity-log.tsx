import {
  ArrowUpCircle,
  Check,
  CircleX,
  History,
  SkipForward,
} from "lucide-react";

import { TimeAgo } from "@/components/time";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { ActivityEvent } from "@/lib/types";

const iconFor = {
  check: ArrowUpCircle,
  updated: Check,
  skipped: SkipForward,
  failed: CircleX,
} as const;

const toneFor = {
  check: "text-muted-foreground",
  updated: "text-emerald-400",
  skipped: "text-muted-foreground",
  failed: "text-red-400",
} as const;

export function ActivityLog({ events }: { events: ActivityEvent[] }) {
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center gap-2">
        <History className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-medium">Recent activity</h2>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Nothing yet.</p>
        ) : (
          <div className="max-h-[420px] overflow-y-auto pr-2">
            <ul className="flex flex-col gap-2 text-sm">
              {events.map((e, idx) => {
                const Icon = iconFor[e.type] ?? History;
                return (
                  <li key={idx} className="flex items-start gap-2">
                    <Icon className={`h-4 w-4 mt-0.5 ${toneFor[e.type]}`} />
                    <div className="flex-1 min-w-0">
                      <p className="leading-snug">{describe(e)}</p>
                      <p className="text-xs text-muted-foreground">
                        <TimeAgo iso={e.timestamp} />
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function describe(e: ActivityEvent): string {
  switch (e.type) {
    case "check":
      return "Scanned all containers";
    case "updated":
      return `Updated ${e.container ?? "?"}${e.fromVersion ? ` (${e.fromVersion} → ${e.toVersion ?? "?"})` : ""}`;
    case "skipped":
      return `Skipped ${e.container ?? "?"} ${e.toVersion ?? ""}`.trim();
    case "failed":
      return `Failed ${e.container ?? "?"}: ${e.error ?? "unknown error"}`;
  }
}
