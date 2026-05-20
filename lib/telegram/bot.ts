import { Telegraf } from "telegraf";

import { getConfig } from "@/lib/config";
import { logger } from "@/lib/log";
import { registerHandlers } from "@/lib/telegram/handlers";
import type { PendingUpdate } from "@/lib/types";
import { mdEscape, pendingMessage } from "@/lib/telegram/messages";

let bot: Telegraf | null = null;
let launchPromise: Promise<void> | null = null;

export function getBot(): Telegraf | null {
  return bot;
}

export async function startTelegramBot(): Promise<void> {
  const config = getConfig();
  if (!config.telegramEnabled) {
    logger.info("telegram: disabled (HM_TELEGRAM_BOT_TOKEN or chat IDs not set)");
    return;
  }

  bot = new Telegraf(config.HM_TELEGRAM_BOT_TOKEN!);
  registerHandlers(bot);

  try {
    await bot.telegram.setMyCommands([
      { command: "check", description: "Scan for updates now" },
      { command: "list", description: "Show watched containers" },
      { command: "status", description: "Last/next scan and pending count" },
      { command: "help", description: "Show available commands" },
    ]);
  } catch (err) {
    logger.warn({ err }, "telegram: failed to register commands");
  }

  // launch() polls indefinitely. We don't await it; we keep it as a side-effect.
  launchPromise = bot
    .launch({ dropPendingUpdates: true })
    .catch((err) => logger.error({ err }, "telegram: launch failed"));

  logger.info(
    { chats: config.HM_TELEGRAM_CHAT_IDS.length },
    "telegram: bot started (long polling)",
  );
}

export async function stopTelegramBot(signal: NodeJS.Signals): Promise<void> {
  if (!bot) return;
  logger.info({ signal }, "telegram: stopping");
  bot.stop(signal);
  if (launchPromise) {
    try {
      await launchPromise;
    } catch {
      /* ignore */
    }
  }
}

export async function notifyPendingUpdates(pending: PendingUpdate[]): Promise<void> {
  if (!bot) return;
  const config = getConfig();
  if (pending.length === 0) return;

  for (const chatId of config.HM_TELEGRAM_CHAT_IDS) {
    for (const p of pending) {
      try {
        await bot.telegram.sendMessage(chatId, pendingMessage(p), {
          parse_mode: "MarkdownV2",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "✅ Update",
                  callback_data: `apply:${p.container.name}:${p.newVersion ?? "rebuild"}`,
                },
                {
                  text: "⏭ Skip",
                  callback_data: `skip:${p.container.name}:${p.newVersion ?? "rebuild"}`,
                },
              ],
            ],
          },
        });
      } catch (err) {
        logger.warn(
          { err, chatId, container: p.container.name },
          "telegram: failed to send notification",
        );
      }
    }
  }
  // ensure mdEscape is treated as used (used inside messages.ts)
  void mdEscape;
}
