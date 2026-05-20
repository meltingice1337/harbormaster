import { z } from "zod";
import type { ChangelogSource } from "@/lib/types";

const CommaList = z
  .string()
  .optional()
  .transform((v) =>
    v
      ? v
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
  );

const EnvSchema = z.object({
  HM_TELEGRAM_BOT_TOKEN: z.string().optional(),
  HM_TELEGRAM_CHAT_IDS: CommaList,
  HM_TELEGRAM_ADMIN_CHAT_ID: z.string().optional(),
  HM_SCHEDULE: z.string().default("0 0 6 * * 0"),
  HM_WATCH: CommaList,
  HM_GITHUB_TOKEN: z.string().optional(),
  HM_WEB_AUTH_TOKEN: z.string().optional(),
  TZ: z.string().default("UTC"),
  LOG_LEVEL: z.string().default("info"),
  STATE_DIR: z.string().default("/data"),
  PORT: z.coerce.number().default(8000),
  HOSTNAME: z.string().default("0.0.0.0"),
});

export type Env = z.infer<typeof EnvSchema>;

function parseChangelogOverride(value: string): ChangelogSource {
  // github:owner/repo  |  servarr:<branch>  |  none
  const [type, rest = ""] = value.split(":", 2);
  if (type === "github") {
    const [owner, repo] = rest.split("/", 2);
    if (!owner || !repo) throw new Error(`bad changelog override: ${value}`);
    return { type: "github", owner, repo };
  }
  if (type === "servarr") {
    if (!rest) throw new Error(`servarr override missing branch: ${value}`);
    return { type: "servarr", branch: rest };
  }
  if (type === "none") return { type: "none" };
  throw new Error(`unknown changelog override type: ${type}`);
}

function loadChangelogOverrides(env: NodeJS.ProcessEnv): Map<string, ChangelogSource> {
  const out = new Map<string, ChangelogSource>();
  for (const [key, value] of Object.entries(env)) {
    if (!value) continue;
    const match = /^HM_CHANGELOG_(.+)$/.exec(key);
    if (!match) continue;
    out.set(match[1], parseChangelogOverride(value));
  }
  return out;
}

export type Config = Env & {
  changelogOverrides: Map<string, ChangelogSource>;
  telegramAdminChatId: string | null;
  telegramEnabled: boolean;
  webAuthEnabled: boolean;
};

let cached: Config | null = null;

export function getConfig(): Config {
  if (cached) return cached;

  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`invalid env: ${parsed.error.message}`);
  }
  const env = parsed.data;
  const overrides = loadChangelogOverrides(process.env);

  cached = {
    ...env,
    changelogOverrides: overrides,
    telegramAdminChatId:
      env.HM_TELEGRAM_ADMIN_CHAT_ID ?? env.HM_TELEGRAM_CHAT_IDS[0] ?? null,
    telegramEnabled: Boolean(env.HM_TELEGRAM_BOT_TOKEN && env.HM_TELEGRAM_CHAT_IDS.length),
    webAuthEnabled: Boolean(env.HM_WEB_AUTH_TOKEN),
  };
  return cached;
}

export function resetConfigForTests(): void {
  cached = null;
}
