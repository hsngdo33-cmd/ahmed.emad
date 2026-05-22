import { completeReportTelegramLink, ensureReportLinkCode } from "@/lib/report-settings";
import { findTelegramChatIdByLinkCode } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const current = await ensureReportLinkCode();

    if (!current.linkCode) {
      return Response.json({ error: "كود الربط غير موجود. حاول تحديث الصفحة." }, { status: 400 });
    }

    const telegramChatId = await findTelegramChatIdByLinkCode(current.linkCode);

    if (!telegramChatId) {
      return Response.json(
        {
          linked: false,
          error: `لم يصل كود ${current.linkCode} للبوت حتى الآن. افتح البوت وابعت /start ${current.linkCode} ثم جرب مرة أخرى.`,
        },
        { status: 404 },
      );
    }

    const settings = await completeReportTelegramLink(telegramChatId);

    return Response.json({
      ok: true,
      linked: true,
      settings,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "حدث خطأ غير متوقع";
    return Response.json({ error: message }, { status: 500 });
  }
}
