import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

const SETTINGS_ID = "daily_telegram_report";

export type ReportSettings = {
  telegramChatId: string;
  dailyEnabled: boolean;
  linkCode: string;
  updatedAt: string | null;
};

type ReportSettingsRow = {
  id: string;
  telegram_chat_id: string | null;
  daily_enabled: boolean | null;
  link_code: string | null;
  updated_at: string | null;
};

function env(name: string) {
  return process.env[name]?.trim();
}

function createSupabaseServerClient() {
  const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseKey = env("SUPABASE_SERVICE_ROLE_KEY") ?? env("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase environment variables are missing.");
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function normalizeRow(row: ReportSettingsRow | null): ReportSettings {
  return {
    telegramChatId: row?.telegram_chat_id ?? env("TELEGRAM_CHAT_ID") ?? "",
    dailyEnabled: row?.daily_enabled ?? env("DAILY_REPORT_ENABLED") === "true",
    linkCode: row?.link_code ?? "",
    updatedAt: row?.updated_at ?? null,
  };
}

function generateLinkCode() {
  return randomBytes(3).toString("hex").toUpperCase();
}

function getErrorMessage(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String(error.message)
        : String(error);

  return message;
}

function isMissingSettingsTable(error: unknown) {
  const message = getErrorMessage(error);
  return message.includes("report_settings") || message.includes("relation");
}

function withSetupHint(error: unknown) {
  const message = getErrorMessage(error);

  if (message.includes("report_settings") || message.includes("relation")) {
    return new Error("جدول إعدادات التقارير غير موجود. شغل ملف supabase-report-settings.sql على Supabase مرة واحدة.");
  }

  return error instanceof Error ? error : new Error(message);
}

export async function getReportSettings() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("report_settings")
    .select("id, telegram_chat_id, daily_enabled, link_code, updated_at")
    .eq("id", SETTINGS_ID)
    .maybeSingle();

  if (error) {
    if (isMissingSettingsTable(error)) {
      return normalizeRow(null);
    }

    throw withSetupHint(error);
  }

  return normalizeRow(data as ReportSettingsRow | null);
}

export async function ensureReportLinkCode() {
  const current = await getReportSettings();
  if (current.linkCode) return current;

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("report_settings")
    .upsert(
      {
        id: SETTINGS_ID,
        telegram_chat_id: current.telegramChatId || null,
        daily_enabled: current.dailyEnabled,
        link_code: generateLinkCode(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    .select("id, telegram_chat_id, daily_enabled, link_code, updated_at")
    .single();

  if (error) {
    throw withSetupHint(error);
  }

  return normalizeRow(data as ReportSettingsRow);
}

export async function saveReportSettings(settings: Pick<ReportSettings, "telegramChatId" | "dailyEnabled">) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("report_settings")
    .upsert(
      {
        id: SETTINGS_ID,
        telegram_chat_id: settings.telegramChatId.trim(),
        daily_enabled: settings.dailyEnabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    .select("id, telegram_chat_id, daily_enabled, link_code, updated_at")
    .single();

  if (error) {
    throw withSetupHint(error);
  }

  return normalizeRow(data as ReportSettingsRow);
}

export async function completeReportTelegramLink(telegramChatId: string) {
  const current = await ensureReportLinkCode();
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("report_settings")
    .upsert(
      {
        id: SETTINGS_ID,
        telegram_chat_id: telegramChatId.trim(),
        daily_enabled: true,
        link_code: current.linkCode || generateLinkCode(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    .select("id, telegram_chat_id, daily_enabled, link_code, updated_at")
    .single();

  if (error) {
    throw withSetupHint(error);
  }

  return normalizeRow(data as ReportSettingsRow);
}
