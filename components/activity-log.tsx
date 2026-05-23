import {
  ArrowUpCircle,
  BellRing,
  Check,
  CircleX,
  History,
  Inbox,
  SkipForward,
} from "lucide-react";

import { TimeAgo } from "@/components/time";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { ActivityEvent } from "@/lib/types";

const iconFor = {
  check: ArrowUpCircle,
  detected: BellRing,
  updated: Check,
  skipped: SkipForward,
  failed: CircleX,
} as const;

const toneFor = {
  check: "text-muted-foreground",
  detected: "text-sky-400",
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
        {events.length > 0 ? (
          <span className="ml-auto text-xs text-muted-foreground font-mono">
            {events.length}
          </span>
        ) : null}
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-6 text-muted-foreground">
            <Inbox className="h-6 w-6 opacity-60" />
            <p className="text-sm italic">Nothing yet.</p>
          </div>
        ) : (
          <div className="max-h-[420px] overflow-y-auto pr-1">
            <ul className="flex flex-col">
              {events.map((e, idx) => {
                const Icon = iconFor[e.type] ?? History;
                const isLast = idx === events.length - 1;
                return (
                  <li
                    key={idx}
                    className={`flex items-start gap-2 py-2 text-sm ${
                      isLast ? "" : "border-b border-foreground/5"
                    }`}
                  >
                    <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${toneFor[e.type]}`} />
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
    case "detected":
      return `Update available for ${e.container ?? "?"}${e.toVersion ? ` (${e.fromVersion ?? "?"} → ${e.toVersion})` : ""}`;
    case "updated":
      return `Updated ${e.container ?? "?"}${e.fromVersion ? ` (${e.fromVersion} → ${e.toVersion ?? "?"})` : ""}`;
    case "skipped":
      return `Skipped ${e.container ?? "?"} ${e.toVersion ?? ""}`.trim();
    case "failed":
      return `Failed ${e.container ?? "?"}: ${e.error ?? "unknown error"}`;
  }
}
