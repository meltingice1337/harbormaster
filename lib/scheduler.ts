import { Cron } from "croner";

import { getConfig } from "@/lib/config";
import { logger } from "@/lib/log";
import { invalidateDashboardCache, scan } from "@/lib/orchestrator";
import { notifyPendingUpdates } from "@/lib/telegram/bot";

let job: Cron | null = null;

export function startScheduler(): void {
  const config = getConfig();
  try {
    job = new Cron(config.HM_SCHEDULE, { timezone: config.TZ }, async () => {
      logger.info("scheduler: tick");
      try {
        const result = await scan();
        invalidateDashboardCache();
        if (result.pending.length > 0) {
          await notifyPendingUpdates(result.pending);
        }
      } catch (err) {
        logger.error({ err }, "scheduler: scan failed");
      }
    });
    logger.info(
      { schedule: config.HM_SCHEDULE, tz: config.TZ, next: job.nextRun() },
      "scheduler: started",
    );
  } catch (err) {
    logger.error({ err, schedule: config.HM_SCHEDULE }, "scheduler: failed to start");
  }
}

export function stopScheduler(): void {
  if (job) {
    job.stop();
    job = null;
    logger.info("scheduler: stopped");
  }
}
