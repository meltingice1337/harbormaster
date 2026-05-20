import { Anchor, Clock, CalendarClock, ArrowUpCircle } from "lucide-react";

import { AbsoluteTime, TimeAgo } from "@/components/time";
import { Card } from "@/components/ui/card";

type Props = {
  watched: number;
  pending: number;
  lastCheckAt: string | null;
  nextCheckAt: string | null;
};

function Stat({
  icon: Icon,
  label,
  value,
  subtle,
  accent,
}: {
  icon: typeof Anchor;
  label: string;
  value: React.ReactNode;
  subtle?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <Card className="flex-1 p-4 flex items-center gap-3">
      <Icon
        className={`h-5 w-5 ${accent ? "text-amber-400" : "text-muted-foreground"}`}
      />
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
        <span className="text-lg font-medium leading-tight">{value}</span>
        {subtle ? (
          <span className="text-xs text-muted-foreground">{subtle}</span>
        ) : null}
      </div>
    </Card>
  );
}

export function StatsBar({ watched, pending, lastCheckAt, nextCheckAt }: Props) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <Stat icon={Anchor} label="Watched" value={String(watched)} />
      <Stat
        icon={ArrowUpCircle}
        label="Pending"
        value={String(pending)}
        accent={pending > 0}
      />
      <Stat icon={Clock} label="Last check" value={<TimeAgo iso={lastCheckAt} />} />
      <Stat
        icon={CalendarClock}
        label="Next check"
        value={<AbsoluteTime iso={nextCheckAt} />}
        subtle={<TimeAgo iso={nextCheckAt} />}
      />
    </div>
  );
}
