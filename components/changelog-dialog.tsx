"use client";

import { ExternalLink } from "lucide-react";
import { useState, type ReactNode } from "react";

import { VersionDiff } from "@/components/version-diff";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { PendingUpdate } from "@/lib/types";

type Props = {
  pending: PendingUpdate;
  trigger: ReactNode;
};

export function ChangelogDialog({ pending, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const name = pending.container.name;
  const from = pending.container.currentVersion;
  const to = pending.newVersion;
  const fromLabel = from ?? "current";
  const toLabel = to ?? "rebuild";
  const entries = pending.changelog;
  const primaryUrl = entries[0]?.htmlUrl;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-foreground/5">
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span>{name}</span>
            <Badge
              variant="default"
              className="bg-amber-500/15 text-amber-400 border-amber-500/30 font-mono"
            >
              <VersionDiff value={fromLabel} compareTo={to} />
              {" → "}
              <VersionDiff value={toLabel} compareTo={from} />
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {entries.length === 0
              ? "No changelog available."
              : entries.length === 1
                ? "Release notes"
                : `${entries.length} releases since current version`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              No changelog available for this update.
            </p>
          ) : (
            <div className="flex flex-col gap-6">
              {entries.map((entry, idx) => (
                <section
                  key={`${entry.version}-${idx}`}
                  className="flex flex-col gap-2"
                >
                  <header className="flex items-baseline gap-2 flex-wrap">
                    <h3 className="font-mono text-sm font-medium">
                      {entry.version}
                    </h3>
                    {entry.publishedAt ? (
                      <span className="text-xs text-muted-foreground">
                        {formatDate(entry.publishedAt)}
                      </span>
                    ) : null}
                    {entry.htmlUrl ? (
                      <a
                        href={entry.htmlUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        source
                      </a>
                    ) : null}
                  </header>
                  <div className="text-sm text-muted-foreground border-l-2 border-amber-400/40 pl-3 whitespace-pre-wrap leading-relaxed">
                    {entry.bodyMarkdown.trim() || (
                      <span className="italic">No notes for this release.</span>
                    )}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        {primaryUrl ? (
          <div className="px-5 py-3 border-t border-foreground/5 flex items-center justify-end">
            <a
              href={primaryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <ExternalLink className="h-3 w-3" />
              Open on source
            </a>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}
