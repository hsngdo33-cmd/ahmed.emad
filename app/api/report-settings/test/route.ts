import { buildDailyReport, formatDailyReportMessage } from "@/lib/daily-report";
import { getReportSettings } from "@/lib/report-settings";
import { sendTelegramTextMessage } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const settings = await getReportSettings();

    if (!settings.telegramChatId) {
      return Response.json({ error: "اكتب Telegram Chat ID الأول." }, { status: 400 });
    }

    const report = await buildDailyReport();
    const message = formatDailyReportMessage(report);
    const telegram = await sendTelegramTextMessage(message, settings.telegramChatId);

    return Response.json({
      ok: true,
      telegramMessageId: telegram.result?.message_id ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "حدث خطأ غير متوقع";
    return Response.json({ error: message }, { status: 500 });
  }
}
