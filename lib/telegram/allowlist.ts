import { getConfig } from "@/lib/config";

export function isAllowedChat(chatId: number | undefined): boolean {
  if (chatId === undefined) return false;
  const allowed = getConfig().HM_TELEGRAM_CHAT_IDS;
  return allowed.includes(String(chatId));
}

export function adminChatId(): string | null {
  return getConfig().telegramAdminChatId;
}
