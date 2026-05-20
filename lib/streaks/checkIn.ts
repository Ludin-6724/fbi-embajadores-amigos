import type { SupabaseClient } from "@supabase/supabase-js";

export const MISSION_TIMEZONE = "America/Mexico_City";

export type StreakCheckInResult = {
  ok: boolean;
  streak_days?: number;
  max_streak?: number;
  points_awarded?: number;
  post_created?: boolean;
  same_day_update?: boolean;
  protector_used?: boolean;
  message?: string;
  error?: string;
};

/** Calendar date string (YYYY-MM-DD) for "today" in mission timezone. */
export function getMissionTodayDateString(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MISSION_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Whether last_checkin falls on the same mission calendar day as now. */
export function hasCheckedInOnMissionDay(lastCheckin: string | null | undefined, now = new Date()): boolean {
  if (!lastCheckin) return false;
  const lastDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: MISSION_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(lastCheckin));
  return lastDate === getMissionTodayDateString(now);
}

export async function registerStreakCheckIn(
  supabase: SupabaseClient,
  params: { missionNote: string; communityId?: string | null }
): Promise<StreakCheckInResult> {
  const note = params.missionNote.trim();
  if (!note) {
    return { ok: false, error: "empty_note", message: "Escribe tu reporte de misión antes de registrar." };
  }

  const { data, error } = await supabase.rpc("register_streak_checkin", {
    p_mission_note: note,
    p_community_id: params.communityId ?? null,
  });

  if (error) {
    return {
      ok: false,
      error: error.code ?? "rpc_error",
      message: error.message || "No se pudo registrar la misión. Intenta de nuevo.",
    };
  }

  const result = data as StreakCheckInResult | null;
  if (!result) {
    return { ok: false, error: "empty_response", message: "Respuesta vacía del servidor." };
  }

  if (!result.ok) {
    return {
      ok: false,
      error: result.error ?? "checkin_failed",
      message: result.message ?? "No se pudo registrar la misión.",
    };
  }

  return result;
}
