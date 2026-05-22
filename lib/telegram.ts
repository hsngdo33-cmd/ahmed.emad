type TelegramMessageResponse = {
  ok: boolean;
  result?: {
    message_id?: number;
  };
  description?: string;
};

type TelegramMeResponse = {
  ok: boolean;
  result?: {
    username?: string;
  };
  description?: string;
};

type TelegramUpdatesResponse = {
  ok: boolean;
  result?: Array<{
    message?: {
      text?: string;
      chat?: {
        id?: number;
      };
    };
  }>;
  description?: string;
};

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is missing.`);
  }
  return value;
}

function getBotToken() {
  return getRequiredEnv("TELEGRAM_BOT_TOKEN");
}

export async function sendTelegramTextMessage(text: string, chatIdOverride?: string) {
  const botToken = getBotToken();
  const chatId = chatIdOverride?.trim() || getRequiredEnv("TELEGRAM_CHAT_ID");

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });

  const data = (await response.json().catch(() => ({}))) as TelegramMessageResponse;

  if (!response.ok || !data.ok) {
    throw new Error(data.description || `Telegram API failed with status ${response.status}.`);
  }

  return data;
}

export async function getTelegramBotUsername() {
  const configured = process.env.TELEGRAM_BOT_USERNAME?.trim();
  if (configured) return configured.replace(/^@/, "");

  const botToken = getBotToken();
  const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`, {
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as TelegramMeResponse;

  if (!response.ok || !data.ok) {
    throw new Error(data.description || `Telegram API failed with status ${response.status}.`);
  }

  return data.result?.username ?? "";
}

export async function findTelegramChatIdByLinkCode(linkCode: string) {
  const botToken = getBotToken();
  const response = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates`, {
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as TelegramUpdatesResponse;

  if (!response.ok || !data.ok) {
    throw new Error(data.description || `Telegram API failed with status ${response.status}.`);
  }

  const normalizedCode = linkCode.trim().toUpperCase();
  const match = [...(data.result ?? [])].reverse().find((update) => {
    const text = update.message?.text?.trim().toUpperCase();
    return text === normalizedCode || text === `/START ${normalizedCode}`;
  });

  const chatId = match?.message?.chat?.id;
  return chatId ? String(chatId) : null;
}
