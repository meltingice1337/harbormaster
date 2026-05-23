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
    <Card className="px-3 py-3 sm:px-4 sm:py-4 flex flex-col items-center justify-center gap-1 min-w-0 text-center">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon
          className={`h-3.5 w-3.5 shrink-0 ${
            accent ? "text-amber-400" : ""
          }`}
        />
        <span className="text-[10px] sm:text-xs uppercase tracking-wide">
          {label}
        </span>
      </div>
      <span
        className={`text-xl sm:text-2xl font-semibold leading-none truncate w-full ${
          accent ? "text-amber-400" : ""
        }`}
      >
        {value}
      </span>
      {subtle ? (
        <span className="text-[10px] sm:text-xs text-muted-foreground truncate w-full">
          {subtle}
        </span>
      ) : null}
    </Card>
  );
}

export function StatsBar({ watched, pending, lastCheckAt, nextCheckAt }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
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
