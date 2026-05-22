import { ensureReportLinkCode, saveReportSettings } from "@/lib/report-settings";
import { getTelegramBotUsername } from "@/lib/telegram";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "حدث خطأ غير متوقع";
  return Response.json({ error: message }, { status: 500 });
}

export async function GET() {
  try {
    const [settings, botUsername] = await Promise.all([
      ensureReportLinkCode(),
      getTelegramBotUsername().catch(() => ""),
    ]);

    return Response.json({ settings, botUsername });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      telegramChatId?: unknown;
      dailyEnabled?: unknown;
    };

    const telegramChatId = typeof body.telegramChatId === "string" ? body.telegramChatId.trim() : "";
    const dailyEnabled = Boolean(body.dailyEnabled);

    if (dailyEnabled && !telegramChatId) {
      return Response.json({ error: "اكتب Telegram Chat ID قبل تفعيل التقارير." }, { status: 400 });
    }

    const settings = await saveReportSettings({ telegramChatId, dailyEnabled });
    return Response.json({ ok: true, settings });
  } catch (error) {
    return errorResponse(error);
  }
}
