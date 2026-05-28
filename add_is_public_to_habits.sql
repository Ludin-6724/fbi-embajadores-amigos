/* ============================================================
   FBI Embajadores Amigos — Migración: Privacidad en Hábitos
   Ejecutar en: Supabase Dashboard > SQL Editor
   ============================================================ */

-- 1. Agregar columna de privacidad a la tabla habits (si no existe)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'habits' 
          AND column_name = 'is_public'
    ) THEN
        ALTER TABLE public.habits ADD COLUMN is_public boolean DEFAULT true;
    END IF;
END $$;

-- 2. Actualizar la función complete_habit para respetar la privacidad del hábito
CREATE OR REPLACE FUNCTION public.complete_habit(
  p_habit_id uuid,
  p_value numeric DEFAULT NULL,
  p_note text DEFAULT NULL,
  p_mood int DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_today date;
  v_habit record;
  v_existing_log uuid;
  v_old_streak int := 0;
  v_new_streak int := 0;
  v_max_streak int := 0;
  v_total int := 0;
  v_last_date date;
  v_diff_days int;
  v_points_awarded int := 0;
  v_user_name text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- Verificar que el hábito pertenece al usuario
  SELECT * INTO v_habit FROM public.habits
  WHERE id = p_habit_id AND user_id = v_user_id AND NOT is_archived;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'habit_not_found',
      'message', 'Hábito no encontrado o archivado.');
  END IF;

  v_today := (now() AT TIME ZONE 'America/Mexico_City')::date;

  -- Verificar si ya se completó hoy
  SELECT id INTO v_existing_log FROM public.habit_logs
  WHERE habit_id = p_habit_id AND logged_date = v_today;

  IF v_existing_log IS NOT NULL THEN
    -- Actualizar el log existente (nota, valor, mood)
    UPDATE public.habit_logs SET
      value = COALESCE(p_value, value),
      note = COALESCE(p_note, note),
      mood = COALESCE(p_mood, mood),
      completed = true
    WHERE id = v_existing_log;

    RETURN jsonb_build_object(
      'ok', true,
      'already_logged', true,
      'message', 'Hábito ya registrado hoy. Nota actualizada.'
    );
  END IF;

  -- Insertar nuevo log
  INSERT INTO public.habit_logs (habit_id, user_id, logged_date, completed, value, note, mood)
  VALUES (p_habit_id, v_user_id, v_today, true, p_value, p_note, p_mood);

  -- Actualizar racha
  SELECT current_streak, max_streak, total_completions, last_completed_date
  INTO v_old_streak, v_max_streak, v_total, v_last_date
  FROM public.habit_streaks
  WHERE habit_id = p_habit_id;

  IF NOT FOUND THEN
    -- Primera vez: crear fila de streak
    v_new_streak := 1;
    v_max_streak := 1;
    v_total := 1;

    INSERT INTO public.habit_streaks (habit_id, user_id, current_streak, max_streak, total_completions, last_completed_date)
    VALUES (p_habit_id, v_user_id, v_new_streak, v_max_streak, v_total, v_today);
  ELSE
    v_total := COALESCE(v_total, 0) + 1;

    IF v_last_date IS NOT NULL THEN
      v_diff_days := v_today - v_last_date;

      IF v_diff_days = 1 THEN
        -- Día consecutivo
        v_new_streak := COALESCE(v_old_streak, 0) + 1;
      ELSIF v_diff_days = 0 THEN
        -- Mismo día (no debería llegar aquí por el check anterior)
        v_new_streak := COALESCE(v_old_streak, 0);
      ELSE
        -- Se rompió la racha
        v_new_streak := 1;
      END IF;
    ELSE
      v_new_streak := 1;
    END IF;

    v_max_streak := GREATEST(COALESCE(v_max_streak, 0), v_new_streak);

    UPDATE public.habit_streaks SET
      current_streak = v_new_streak,
      max_streak = v_max_streak,
      total_completions = v_total,
      last_completed_date = v_today,
      updated_at = now()
    WHERE habit_id = p_habit_id;
  END IF;

  -- Sumar 5 puntos
  PERFORM public.award_streak_points(v_user_id, 5);
  v_points_awarded := 5;

  -- Auto-publicar en el muro e insertar notificaciones solo si el hábito es público
  IF COALESCE(v_habit.is_public, true) THEN
    -- Notificación anónima a la comunidad
    SELECT COALESCE(full_name, username, 'Un agente') INTO v_user_name
    FROM public.profiles WHERE id = v_user_id;

    -- Auto-publicar en el muro de comunidad de forma atómica
    INSERT INTO public.posts (author_id, content, is_anonymous)
    VALUES (
      v_user_id,
      '🎯 [HABIT_COMPLETE]:' || jsonb_build_object(
        'user_name', v_user_name,
        'category', v_habit.category,
        'icon', v_habit.icon,
        'color', v_habit.color,
        'streak', v_new_streak
      )::text,
      false
    );

    -- Insertar notificación para TODOS los demás usuarios (batch, max 200)
    INSERT INTO public.notifications (user_id, actor_id, type, message, link)
    SELECT p.id, v_user_id, 'habit_complete',
      v_user_name || ' ha completado un hábito personal, ¡anímalo a seguir! 💪',
      '#habits'
    FROM public.profiles p
    WHERE p.id != v_user_id
    LIMIT 200;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'streak', v_new_streak,
    'max_streak', v_max_streak,
    'total_completions', v_total,
    'points_awarded', v_points_awarded,
    'message', format('¡Hábito completado! Racha: %s días 🔥 +%s 🪙', v_new_streak, v_points_awarded)
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', SQLSTATE,
      'message', 'Error al completar hábito: ' || SQLERRM
    );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_habit(uuid, numeric, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_habit(uuid, numeric, text, int) TO authenticated;
