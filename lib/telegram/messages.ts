import { getConfig } from "@/lib/config";
import { formatStamp } from "@/lib/format";
import type { DashboardState, PendingUpdate } from "@/lib/types";

const TELEGRAM_LIMIT = 4096;

// Telegram MarkdownV2 reserved chars: _*[]()~`>#+-=|{}.!
const MD_ESCAPE = /[_*[\]()~`>#+\-=|{}.!\\]/g;
export function mdEscape(s: string): string {
  return s.replace(MD_ESCAPE, (c) => `\\${c}`);
}

export function pendingMessage(p: PendingUpdate): string {
  const name = mdEscape(p.container.name);
  const from = mdEscape(p.container.currentVersion ?? "current");
  const to = mdEscape(p.newVersion ?? "rebuild");
  const headline = `*${name}*\n${from} → ${to}`;

  const entry = p.changelog[0];
  if (!entry) {
    const tail = "_no changelog available_";
    return clip(`${headline}\n\n${tail}`);
  }
  const body = mdEscape(entry.bodyMarkdown.slice(0, 1500));
  const link = entry.htmlUrl ? `\n[Full notes](${entry.htmlUrl})` : "";
  return clip(`${headline}\n\n${body}${link}`);
}

export function listMessage(state: DashboardState): string {
  if (state.watched.length === 0) return "No containers under management.";
  const lines = state.watched.map((c) => {
    const status =
      c.status === "missing"
        ? "❌"
        : c.status === "exited"
          ? "⏸"
          : "✓";
    return `${status} *${mdEscape(c.name)}* — ${mdEscape(c.currentVersion ?? "?")}`;
  });
  return clip(lines.join("\n"));
}

export function statusMessage(state: DashboardState): string {
  const tz = getConfig().TZ;
  return clip(
    [
      `📦 Watched: *${state.watched.length}*`,
      `⬆️ Pending: *${state.pending.length}*`,
      `🕒 Last check: ${mdEscape(formatStamp(state.lastCheckAt, tz))}`,
      `⏭ Next check: ${mdEscape(formatStamp(state.nextCheckAt, tz))}`,
      `🗓 Schedule: \`${mdEscape(state.schedule)}\``,
    ].join("\n"),
  );
}

export function helpMessage(): string {
  return clip(
    [
      "*Harbormaster commands*",
      "/check — scan for updates now",
      "/list — show watched containers",
      "/status — last/next scan, pending count",
      "/help — this message",
    ].join("\n"),
  );
}

export function unauthorizedAdminMessage(
  user: { id: number; username?: string; first_name?: string },
): string {
  const label = user.username ? `@${user.username}` : (user.first_name ?? "?");
  return clip(
    [
      "⚠️ *Unauthorized access attempt*",
      `User: ${mdEscape(label)}`,
      `Chat ID: \`${user.id}\``,
      "",
      `Add to \`HM_TELEGRAM_CHAT_IDS\` to allow.`,
    ].join("\n"),
  );
}

function clip(s: string): string {
  if (s.length <= TELEGRAM_LIMIT) return s;
  return `${s.slice(0, TELEGRAM_LIMIT - 1)}…`;
}
