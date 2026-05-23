"use client";

import { RefreshCw } from "lucide-react";
import Image from "next/image";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function Header({
  version,
  onRefresh,
}: {
  version: string;
  onRefresh: () => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-3 min-w-0">
        <Image
          src="/logo.png"
          alt="Harbormaster"
          width={40}
          height={40}
          priority
          className="rounded-md sm:w-12 sm:h-12 shrink-0"
        />
        <div className="min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-semibold leading-tight">
              Harbormaster
            </h1>
            <span className="text-xs font-mono text-muted-foreground">
              v{version}
            </span>
          </div>
          <p className="text-xs text-muted-foreground hidden sm:block">
            Container update manager
          </p>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            try {
              await onRefresh();
              toast.success("Scan complete");
            } catch (err) {
              toast.error("Scan failed", {
                description: err instanceof Error ? err.message : String(err),
              });
            }
          });
        }}
        aria-label="Check now"
      >
        <RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} />
        <span className="hidden sm:inline">Check now</span>
      </Button>
    </div>
  );
}
