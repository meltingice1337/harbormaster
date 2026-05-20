import type { Context, Telegraf } from "telegraf";
import type { InlineKeyboardButton } from "telegraf/types";

import { logger } from "@/lib/log";
import { apply, buildDashboardState, scan, skip } from "@/lib/orchestrator";
import { adminChatId, isAllowedChat } from "@/lib/telegram/allowlist";
import {
  helpMessage,
  listMessage,
  mdEscape,
  pendingMessage,
  statusMessage,
  unauthorizedAdminMessage,
} from "@/lib/telegram/messages";

type Bot = Telegraf<Context>;

const MD_OPTS = { parse_mode: "MarkdownV2" as const };
const reportedUnauthorized = new Set<number>();

export function registerHandlers(bot: Bot) {
  bot.use(async (ctx, next) => {
    const chatId = ctx.chat?.id;
    if (chatId === undefined) return;
    if (!isAllowedChat(chatId)) {
      await handleUnauthorized(bot, ctx);
      return;
    }
    return next();
  });

  bot.command("start", async (ctx) => ctx.reply(helpMessage(), MD_OPTS));
  bot.command("help", async (ctx) => ctx.reply(helpMessage(), MD_OPTS));

  bot.command("list", async (ctx) => {
    const state = await buildDashboardState();
    await ctx.reply(listMessage(state), MD_OPTS);
  });

  bot.command("status", async (ctx) => {
    const state = await buildDashboardState();
    await ctx.reply(statusMessage(state), MD_OPTS);
  });

  bot.command("check", async (ctx) => {
    await ctx.reply("🔍 Scanning…");
    try {
      const result = await scan();
      if (result.pending.length === 0) {
        await ctx.reply("✅ Everything up to date.");
        return;
      }
      for (const p of result.pending) {
        await ctx.reply(pendingMessage(p), {
          ...MD_OPTS,
          reply_markup: actionKeyboard(p.container.name, p.newVersion ?? "rebuild"),
        });
      }
    } catch (err) {
      logger.error({ err }, "telegram: /check failed");
      await ctx.reply(`Scan failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  bot.on("callback_query", async (ctx) => {
    const data = (ctx.callbackQuery as { data?: string }).data;
    if (!data) return ctx.answerCbQuery();

    const [action, name, version] = data.split(":");
    if (!action || !name) return ctx.answerCbQuery();

    if (action === "apply") {
      await ctx.answerCbQuery("Updating…");
      try {
        await apply(name);
        await ctx.editMessageText(`✅ Updated ${mdEscape(name)} → ${mdEscape(version ?? "?")}`, MD_OPTS);
      } catch (err) {
        await ctx.editMessageText(
          `❌ Failed ${mdEscape(name)}: ${mdEscape(err instanceof Error ? err.message : String(err))}`,
          MD_OPTS,
        );
      }
    } else if (action === "skip") {
      try {
        await skip(name, version ?? "rebuild");
        await ctx.answerCbQuery("Skipped");
        await ctx.editMessageText(`⏭ Skipped ${mdEscape(name)} ${mdEscape(version ?? "")}`, MD_OPTS);
      } catch (err) {
        await ctx.answerCbQuery("Failed");
        logger.error({ err, name }, "telegram: skip failed");
      }
    }
  });

  bot.catch((err) => logger.error({ err }, "telegram: handler error"));
}

function actionKeyboard(container: string, version: string): { inline_keyboard: InlineKeyboardButton[][] } {
  return {
    inline_keyboard: [
      [
        { text: "✅ Update", callback_data: `apply:${container}:${version}` },
        { text: "⏭ Skip", callback_data: `skip:${container}:${version}` },
      ],
    ],
  };
}

async function handleUnauthorized(bot: Bot, ctx: Context) {
  const from = ctx.from;
  const chatId = ctx.chat?.id;
  if (!from || chatId === undefined) return;
  try {
    await ctx.reply("❌ Not authorized.");
  } catch {
    /* ignore */
  }

  const admin = adminChatId();
  if (!admin || reportedUnauthorized.has(from.id)) return;
  reportedUnauthorized.add(from.id);
  try {
    await bot.telegram.sendMessage(
      admin,
      unauthorizedAdminMessage({
        id: from.id,
        username: from.username,
        first_name: from.first_name,
      }),
      MD_OPTS,
    );
  } catch (err) {
    logger.warn({ err }, "telegram: failed to notify admin of unauthorized user");
  }
}

// Re-export so tests / callers can build keyboards without duplicating.
export const _internals = { actionKeyboard };
