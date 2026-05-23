import type { Telegraf } from "telegraf";

import { logger } from "@/lib/log";
import { onQueueEvent } from "@/lib/queue";
import { jobStatusMessage } from "@/lib/telegram/messages";

type TrackedMessage = {
  chatId: number;
  messageId: number;
  headline: string;
  target: string;
  lastText: string | null;
};

const tracked = new Map<string, TrackedMessage>();
let unsubscribe: (() => void) | null = null;

export function trackJobMessage(
  jobId: string,
  ctx: { chatId: number; messageId: number; headline: string; target: string },
): void {
  tracked.set(jobId, { ...ctx, lastText: null });
}

export function startJobMessageBridge(bot: Telegraf): void {
  if (unsubscribe) return;
  unsubscribe = onQueueEvent((e) => {
    const job = e.job;
    const entry = tracked.get(job.id);
    if (!entry) return;

    const text = jobStatusMessage(job, {
      headline: entry.headline,
      target: entry.target,
    });
    if (text === entry.lastText) return;
    entry.lastText = text;

    bot.telegram
      .editMessageText(entry.chatId, entry.messageId, undefined, text, {
        parse_mode: "MarkdownV2",
      })
      .catch((err: unknown) => {
        const description =
          err && typeof err === "object" && "description" in err
            ? (err as { description?: string }).description
            : undefined;
        // "message is not modified" is benign — happens if the same phase fires twice.
        if (description?.includes("message is not modified")) return;
        logger.warn(
          { err, jobId: job.id, container: job.container },
          "telegram: failed to edit job message",
        );
      });

    if (job.phase === "done" || job.phase === "failed") {
      // Drop the buttons; keep the final text. editMessageReplyMarkup with no
      // keyboard clears the inline buttons.
      bot.telegram
        .editMessageReplyMarkup(entry.chatId, entry.messageId, undefined, undefined)
        .catch(() => {
          /* ignore */
        });
      tracked.delete(job.id);
    }
  });
}

export function stopJobMessageBridge(): void {
  unsubscribe?.();
  unsubscribe = null;
  tracked.clear();
}
