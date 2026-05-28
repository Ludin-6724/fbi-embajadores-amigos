-- Atomic streak check-in: streak row + points + wall post (America/Mexico_City)
-- Run in Supabase SQL Editor before deploying the client that calls register_streak_checkin
--
-- IMPORTANT: Los protectores de racha son manejados EXCLUSIVAMENTE por el cron
-- process_daily_streaks. Esta función NUNCA consume protectores.

CREATE OR REPLACE FUNCTION public.register_streak_checkin(
  p_mission_note text,
  p_community_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_today date;
  v_last_checkin timestamptz;
  v_last_checkin_date date;
  v_diff_days int;
  v_old_days int := 0;
  v_new_days int := 1;
  v_max_streak int := 0;
  v_streak_id uuid;
  v_same_day boolean := false;
  v_post_created boolean := false;
  v_points_awarded int := 0;
  v_post_content text;
  v_checkin_ts timestamptz;
  v_message text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'not_authenticated',
      'message', 'Debes iniciar sesión para registrar tu misión.'
    );
  END IF;

  IF p_mission_note IS NULL OR length(trim(p_mission_note)) = 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'empty_note',
      'message', 'Escribe tu reporte de misión antes de registrar.'
    );
  END IF;

  v_today := (now() AT TIME ZONE 'America/Mexico_City')::date;
  v_checkin_ts := (v_today + time '12:00:00') AT TIME ZONE 'America/Mexico_City';

  SELECT id, streak_days, COALESCE(max_streak, streak_days, 0), last_checkin
  INTO v_streak_id, v_old_days, v_max_streak, v_last_checkin
  FROM public.streaks
  WHERE user_id = v_user_id
    AND (
      (p_community_id IS NULL AND community_id IS NULL)
      OR community_id = p_community_id
    )
  LIMIT 1;

  IF v_streak_id IS NOT NULL AND v_last_checkin IS NOT NULL THEN
    v_last_checkin_date := (v_last_checkin AT TIME ZONE 'America/Mexico_City')::date;
    v_diff_days := v_today - v_last_checkin_date;

    IF v_diff_days = 0 THEN
      v_same_day := true;
      v_new_days := v_old_days;
    ELSIF v_diff_days = 1 THEN
      v_new_days := v_old_days + 1;
    ELSE
      -- Si pasaron 2+ días, la racha se reinicia a 1.
      -- Los protectores son manejados EXCLUSIVAMENTE por el cron process_daily_streaks.
      -- Si el cron ya salvó la racha, last_checkin estará actualizado y v_diff_days será 1.
      v_new_days := 1;
    END IF;
  END IF;

  v_max_streak := GREATEST(COALESCE(v_max_streak, 0), v_new_days);

  IF v_streak_id IS NULL THEN
    INSERT INTO public.streaks (
      user_id, streak_days, max_streak, last_checkin,
      last_mission_title, last_mission_note, community_id
    ) VALUES (
      v_user_id, v_new_days, v_max_streak, v_checkin_ts,
      'Misión Completada', trim(p_mission_note), p_community_id
    )
    RETURNING id INTO v_streak_id;
  ELSE
    UPDATE public.streaks SET
      streak_days = v_new_days,
      max_streak = v_max_streak,
      last_checkin = v_checkin_ts,
      last_mission_title = 'Misión Completada',
      last_mission_note = trim(p_mission_note)
    WHERE id = v_streak_id;
  END IF;

  IF v_new_days > v_old_days THEN
    PERFORM public.award_streak_points(v_user_id, 10);
    v_points_awarded := 10;
  END IF;

  IF NOT v_same_day THEN
    v_post_content := format(
      '🎯 ¡Acabo de registrar mi misión del día! Racha actual: %s días (Récord: %s días) 🔥%s%s',
      v_new_days, v_max_streak, E'\n\n', '"' || trim(p_mission_note) || '"'
    );

    INSERT INTO public.posts (author_id, content, is_anonymous, community_id)
    VALUES (v_user_id, v_post_content, false, p_community_id);

    v_post_created := true;
  END IF;

  IF v_same_day THEN
    v_message := 'Ya registraste tu misión de hoy. Actualizamos tu nota.';
  ELSIF v_new_days = 1 AND v_old_days > 1 THEN
    v_message := 'Tu racha se reinició. ¡Vamos de nuevo! 💪';
  ELSIF v_points_awarded > 0 THEN
    v_message := format('¡Misión registrada con éxito! Tu racha ha subido y ganaste %s 🪙.', v_points_awarded);
  ELSE
    v_message := '¡Misión registrada con éxito!';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'streak_days', v_new_days,
    'max_streak', v_max_streak,
    'points_awarded', v_points_awarded,
    'post_created', v_post_created,
    'same_day_update', v_same_day,
    'protector_used', false,
    'message', v_message
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', SQLSTATE,
      'message', 'No se pudo completar el registro: ' || SQLERRM
    );
END;
$$;

REVOKE ALL ON FUNCTION public.register_streak_checkin(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_streak_checkin(text, uuid) TO authenticated;
