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
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Image
          src="/logo.png"
          alt="Harbormaster"
          width={48}
          height={48}
          priority
          className="rounded-md"
        />
        <div>
          <div className="flex items-baseline gap-2">
            <h1 className="text-2xl font-semibold leading-tight">Harbormaster</h1>
            <span className="text-xs font-mono text-muted-foreground">v{version}</span>
          </div>
          <p className="text-xs text-muted-foreground">Container update manager</p>
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
      >
        <RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} />
        Check now
      </Button>
    </div>
  );
}
