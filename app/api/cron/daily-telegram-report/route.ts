import { buildDailyReport, formatDailyReportMessage } from "@/lib/daily-report";
import { getReportSettings } from "@/lib/report-settings";
import { sendTelegramTextMessage } from "@/lib/telegram";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (!cronSecret) {
    return process.env.NODE_ENV !== "production";
  }

  return (
    request.headers.get("authorization") === `Bearer ${cronSecret}` ||
    request.headers.get("x-cron-secret") === cronSecret
  );
}

function parseDate(value: string | null) {
  if (!value) return new Date();
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return new Date();
  return new Date(`${match[1]}-${match[2]}-${match[3]}T12:00:00`);
}

async function handler(request: NextRequest) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const dryRun = searchParams.get("dryRun") === "true";
  const settings = await getReportSettings();
  const report = await buildDailyReport(parseDate(searchParams.get("date")));
  const message = formatDailyReportMessage(report);

  if (dryRun) {
    return Response.json({ dryRun: true, settings, report, message });
  }

  if (!settings.dailyEnabled) {
    return Response.json({ ok: true, skipped: true, reason: "Daily Telegram reports are disabled." });
  }

  if (!settings.telegramChatId) {
    return Response.json({ error: "Telegram Chat ID is missing." }, { status: 400 });
  }

  const telegram = await sendTelegramTextMessage(message, settings.telegramChatId);

  return Response.json({
    ok: true,
    report,
    telegramMessageId: telegram.result?.message_id ?? null,
  });
}

export async function GET(request: NextRequest) {
  return handler(request);
}

export async function POST(request: NextRequest) {
  return handler(request);
}
