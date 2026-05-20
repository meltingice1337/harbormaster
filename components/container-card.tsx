"use client";

import { Check, ArrowUpRight, AlertTriangle, ExternalLink, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { PendingUpdate, WatchedContainer } from "@/lib/types";

type Props = {
  container: WatchedContainer;
  pending?: PendingUpdate;
  onActionDone: () => void;
};

export function ContainerCard({ container, pending, onActionDone }: Props) {
  const [busy, setBusy] = useState<"update" | "skip" | null>(null);

  const doAction = async (action: "update" | "skip") => {
    setBusy(action);
    try {
      const url =
        action === "update"
          ? `/api/update/${encodeURIComponent(container.name)}`
          : `/api/skip/${encodeURIComponent(container.name)}`;
      const body =
        action === "skip"
          ? JSON.stringify({ version: pending?.newVersion ?? "rebuild" })
          : undefined;
      const res = await fetch(url, {
        method: "POST",
        body,
        headers: body ? { "Content-Type": "application/json" } : undefined,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      toast.success(
        action === "update" ? `Updated ${container.name}` : `Skipped ${container.name}`,
      );
      await onActionDone();
    } catch (err) {
      toast.error(`Failed to ${action} ${container.name}`, {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(null);
    }
  };

  const status = pending
    ? "pending"
    : container.status === "missing"
      ? "missing"
      : container.status === "exited"
        ? "exited"
        : "current";

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium">{container.name}</h3>
            <StatusBadge status={status} />
          </div>
          <p className="text-xs text-muted-foreground font-mono break-all">
            {container.image || "(no image)"}
          </p>
        </div>
        <div className="text-right text-sm font-mono">
          {pending && pending.newVersion ? (
            <span className="flex items-center gap-1 text-amber-400">
              {container.currentVersion ?? "?"}
              <ArrowUpRight className="h-3 w-3" />
              {pending.newVersion}
            </span>
          ) : pending ? (
            <span className="text-amber-400">image rebuild</span>
          ) : (
            <span className="text-muted-foreground">
              {container.currentVersion ?? "—"}
            </span>
          )}
        </div>
      </CardHeader>
      {pending ? (
        <CardContent className="flex flex-col gap-3 pt-0">
          {pending.changelog.length > 0 ? (
            <div className="text-sm text-muted-foreground border-l-2 border-amber-400/60 pl-3 whitespace-pre-wrap line-clamp-6">
              {pending.changelog[0].bodyMarkdown.slice(0, 500)}
              {pending.changelog[0].bodyMarkdown.length > 500 ? "…" : ""}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No changelog available.</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              disabled={busy !== null}
              onClick={() => doAction("update")}
            >
              {busy === "update" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Update
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy !== null}
              onClick={() => doAction("skip")}
            >
              Skip
            </Button>
            {pending.changelog[0]?.htmlUrl ? (
              <a
                href={pending.changelog[0].htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                <ExternalLink className="h-3 w-3" />
                Full notes
              </a>
            ) : null}
          </div>
        </CardContent>
      ) : null}
    </Card>
  );
}

function StatusBadge({ status }: { status: "current" | "pending" | "exited" | "missing" }) {
  switch (status) {
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
