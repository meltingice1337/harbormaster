"use client";

import {
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  Check,
  CircleX,
  Download,
  History,
  Loader2,
  Play,
  RotateCw,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ChangelogDialog } from "@/components/changelog-dialog";
import { TimeAgo } from "@/components/time";
import { VersionDiff } from "@/components/version-diff";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { Job, JobPhase, PendingUpdate, WatchedContainer } from "@/lib/types";

type Status = "current" | "pending" | "exited" | "missing" | "updating" | "done" | "failed";

type Props = {
  container: WatchedContainer;
  pending?: PendingUpdate;
  job?: Job;
  onActionDone: () => void;
};

const ACCENT_BY_STATUS: Record<Status, string> = {
  current: "before:bg-emerald-500/60",
  pending: "before:bg-amber-500/70",
  updating: "before:bg-sky-500/70",
  done: "before:bg-emerald-500/70",
  failed: "before:bg-red-500/70",
  exited: "before:bg-muted-foreground/40",
  missing: "before:bg-red-500/70",
};

export function ContainerCard({ container, pending, job, onActionDone }: Props) {
  const [skipping, setSkipping] = useState(false);

  const jobActive =
    job?.phase === "queued" ||
    job?.phase === "pulling" ||
    job?.phase === "recreating" ||
    job?.phase === "starting";
  const jobDone = job?.phase === "done";
  const jobFailed = job?.phase === "failed";

  const doUpdate = async () => {
    try {
      const res = await fetch(`/api/update/${encodeURIComponent(container.name)}`, {
        method: "POST",
      });
      if (!res.ok && res.status !== 202) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
    } catch (err) {
      toast.error(`Failed to queue ${container.name}`, {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const doSkip = async () => {
    setSkipping(true);
    try {
      const res = await fetch(`/api/skip/${encodeURIComponent(container.name)}`, {
        method: "POST",
        body: JSON.stringify({ version: pending?.newVersion ?? "rebuild" }),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      toast.success(`Skipped ${container.name}`);
      await onActionDone();
    } catch (err) {
      toast.error(`Failed to skip ${container.name}`, {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSkipping(false);
    }
  };

  const status: Status = jobActive
    ? "updating"
    : jobDone
      ? "done"
      : jobFailed
        ? "failed"
        : pending
          ? "pending"
          : container.status === "missing"
            ? "missing"
            : container.status === "exited"
              ? "exited"
              : "current";

  return (
    <Card
      className={`relative overflow-hidden transition-colors hover:ring-foreground/20 before:absolute before:inset-y-0 before:left-0 before:w-[3px] ${ACCENT_BY_STATUS[status]}`}
    >
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-medium truncate">{container.name}</h3>
              <StatusBadge status={status} jobPhase={job?.phase} />
            </div>
            <p
              className="text-xs text-muted-foreground font-mono truncate"
              title={container.image || undefined}
            >
              {container.image || "(no image)"}
            </p>
            {container.lastUpdatedAt ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <History className="h-3 w-3 shrink-0" />
                <span>
                  Updated <TimeAgo iso={container.lastUpdatedAt} />
                </span>
                {container.lastUpdatedTo ? (
                  <span className="font-mono truncate">
                    → {container.lastUpdatedTo}
                  </span>
                ) : null}
              </p>
            ) : null}
          </div>
          <div className="text-left sm:text-right text-sm font-mono shrink-0">
            {pending && pending.newVersion ? (
              <span className="flex sm:justify-end items-center gap-1 text-amber-400/80">
                <span>
                  <VersionDiff
                    value={container.currentVersion ?? "?"}
                    compareTo={pending.newVersion}
                  />
                </span>
                <ArrowUpRight className="h-3 w-3" />
                <span className="font-medium text-amber-400">
                  <VersionDiff
                    value={pending.newVersion}
                    compareTo={container.currentVersion}
                  />
                </span>
              </span>
            ) : pending ? (
              <span className="text-amber-400">image rebuild</span>
            ) : (
              <span className="text-muted-foreground">
                {container.currentVersion ?? "—"}
              </span>
            )}
          </div>
        </div>
      </CardHeader>

      {jobActive ? (
        <CardContent className="pt-0">
          <JobProgress phase={job!.phase} />
        </CardContent>
      ) : jobDone ? (
        <CardContent className="pt-0">
          <div className="flex items-center justify-center gap-2 text-sm text-emerald-400">
            <Check className="h-4 w-4" />
            <span>
              Updated
              {job?.startedAt && job.finishedAt
                ? ` in ${formatDuration(job.startedAt, job.finishedAt)}`
                : ""}
            </span>
          </div>
        </CardContent>
      ) : jobFailed ? (
        <CardContent className="pt-0">
          <div className="flex items-start justify-center gap-2 text-sm text-red-400">
            <CircleX className="h-4 w-4 mt-0.5 shrink-0" />
            <span className="break-words text-center">
              {job?.error ?? "Update failed"}
            </span>
          </div>
        </CardContent>
      ) : pending ? (
        <CardContent className="flex flex-col gap-3 pt-0">
          {pending.changelog.length > 0 ? (
            <ChangelogDialog
              pending={pending}
              trigger={
                <button
                  type="button"
                  className="text-left w-full text-sm text-muted-foreground border-l-2 border-amber-400/60 pl-3 whitespace-pre-wrap line-clamp-6 hover:text-foreground transition-colors cursor-pointer"
                  aria-label={`Show full changelog for ${container.name}`}
                >
                  {pending.changelog[0].bodyMarkdown.slice(0, 500)}
                  {pending.changelog[0].bodyMarkdown.length > 500 ? "…" : ""}
                </button>
              }
            />
          ) : (
            <p className="text-xs text-muted-foreground italic text-center">
              No changelog available.
            </p>
          )}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button size="sm" disabled={skipping} onClick={doUpdate}>
              <Check className="h-4 w-4" />
              Update
            </Button>
            <Button size="sm" variant="ghost" disabled={skipping} onClick={doSkip}>
              {skipping ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Skip
            </Button>
            {pending.changelog.length > 0 ? (
              <ChangelogDialog
                pending={pending}
                trigger={
                  <Button type="button" size="sm" variant="ghost">
                    <BookOpen className="h-3 w-3" />
                    <span className="hidden sm:inline">Full notes</span>
                    <span className="sm:hidden">Notes</span>
                  </Button>
                }
              />
            ) : null}
          </div>
        </CardContent>
      ) : null}
    </Card>
  );
}

const PHASES: { phase: JobPhase; label: string; Icon: typeof Loader2 }[] = [
  { phase: "queued", label: "Queued", Icon: Loader2 },
  { phase: "pulling", label: "Pulling", Icon: Download },
  { phase: "recreating", label: "Recreating", Icon: RotateCw },
  { phase: "starting", label: "Starting", Icon: Play },
];

function JobProgress({ phase }: { phase: JobPhase }) {
  const activeIndex = PHASES.findIndex((p) => p.phase === phase);
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs">
      {PHASES.map((p, i) => {
        const done = i < activeIndex;
        const active = i === activeIndex;
        const Icon = p.Icon;
        return (
          <div
            key={p.phase}
            className={`flex items-center gap-1.5 ${
              active
                ? "text-amber-400"
                : done
                  ? "text-emerald-400"
                  : "text-muted-foreground/60"
            }`}
          >
            {active ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : done ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Icon className="h-3.5 w-3.5" />
            )}
            <span>{p.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function StatusBadge({
  status,
  jobPhase,
}: {
  status: Status;
  jobPhase?: JobPhase;
}) {
  switch (status) {
    case "updating":
      return (
        <Badge variant="default" className="bg-sky-500/15 text-sky-400 border-sky-500/30">
          <Loader2 className="h-3 w-3 animate-spin" />
          {phaseLabel(jobPhase)}
        </Badge>
      );
    case "done":
      return (
        <Badge variant="default" className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
          <Check className="h-3 w-3" /> Updated
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive">
          <CircleX className="h-3 w-3" /> Failed
        </Badge>
      );
    case "pending":
      return (
        <Badge variant="default" className="bg-amber-500/15 text-amber-400 border-amber-500/30">
          Update available
        </Badge>
      );
    case "current":
      return (
        <Badge variant="default" className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
          <Check className="h-3 w-3" /> Up to date
        </Badge>
      );
    case "exited":
      return (
        <Badge variant="outline" className="text-muted-foreground">
          Stopped
        </Badge>
      );
    case "missing":
      return (
        <Badge variant="destructive">
          <AlertTriangle className="h-3 w-3" /> Missing
        </Badge>
      );
  }
}

function phaseLabel(phase?: JobPhase): string {
  switch (phase) {
    case "queued":
      return "Queued";
    case "pulling":
      return "Pulling";
    case "recreating":
      return "Recreating";
    case "starting":
      return "Starting";
    default:
      return "Updating";
  }
}

function formatDuration(startedIso: string, endedIso: string): string {
  const ms = Date.parse(endedIso) - Date.parse(startedIso);
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s - m * 60;
  return rem ? `${m}m ${rem}s` : `${m}m`;
}
