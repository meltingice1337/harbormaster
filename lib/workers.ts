import { getConfig } from "@/lib/config";
import { logger } from "@/lib/log";
import { startScheduler, stopScheduler } from "@/lib/scheduler";
import { startTelegramBot, stopTelegramBot } from "@/lib/telegram/bot";

let started = false;

export async function startWorkers(): Promise<void> {
  if (started) return;
  started = true;

  const config = getConfig();
  if (!config.webAuthEnabled) {
    logger.warn(
      "security: HM_WEB_AUTH_TOKEN is unset — dashboard and API are publicly accessible",
    );
  }

  await startTelegramBot();
  startScheduler();
  registerShutdownHooks();
  logger.info("workers: started");
}

export async function stopWorkers(signal: NodeJS.Signals): Promise<void> {
  logger.info({ signal }, "workers: stopping");
  stopScheduler();
  await stopTelegramBot(signal);
}

function registerShutdownHooks(): void {
  const handler = (signal: NodeJS.Signals) => {
    void (async () => {
      await stopWorkers(signal);
      process.exit(0);
    })();
  };
  process.once("SIGTERM", () => handler("SIGTERM"));
  process.once("SIGINT", () => handler("SIGINT"));
}
