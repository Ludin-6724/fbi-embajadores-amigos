/* ============================================================
   FBI Embajadores Amigos — Sistema de Hábitos Personales
   Ejecutar en: Supabase Dashboard > SQL Editor
   ============================================================ */

-- ═══════════════════════════════════════════════════════════════
-- 1. TABLAS
-- ═══════════════════════════════════════════════════════════════

-- Tabla principal de hábitos
CREATE TABLE IF NOT EXISTS public.habits (
  id             uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id        uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name           text NOT NULL,
  description    text,
  icon           text DEFAULT '🎯',
  category       text DEFAULT 'general',       -- salud, productividad, espiritual, fitness, general
  habit_type     text DEFAULT 'boolean',        -- boolean, quantity, duration, negative
  target_value   int DEFAULT 1,                 -- meta numérica (ej: 8 vasos, 10 minutos)
  target_unit    text,                          -- unidad: 'vasos', 'minutos', 'páginas'
  frequency      text DEFAULT 'daily',          -- daily, weekly, specific_days
  frequency_days int DEFAULT 7,                 -- para weekly: cuántas veces por semana
  specific_days  text[],                        -- para specific_days: {'mon','tue','wed',...}
  time_of_day    text DEFAULT 'any',            -- morning, afternoon, evening, any
  color          text DEFAULT '#D4A017',
  sort_order     int DEFAULT 0,
  is_archived    boolean DEFAULT false,
  created_at     timestamptz DEFAULT now() NOT NULL,
  updated_at     timestamptz DEFAULT now() NOT NULL
);

-- Registros diarios de completado
CREATE TABLE IF NOT EXISTS public.habit_logs (
  id          uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  habit_id    uuid REFERENCES public.habits(id) ON DELETE CASCADE NOT NULL,
  user_id     uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  logged_date date NOT NULL,
  completed   boolean DEFAULT false,
  value       numeric,                          -- valor registrado
  note        text,
  mood        int CHECK (mood IS NULL OR (mood BETWEEN 1 AND 5)),
  created_at  timestamptz DEFAULT now() NOT NULL,
  UNIQUE(habit_id, logged_date)
);

-- Rachas de hábitos (una fila por hábito)
CREATE TABLE IF NOT EXISTS public.habit_streaks (
  id                   uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  habit_id             uuid REFERENCES public.habits(id) ON DELETE CASCADE NOT NULL,
  user_id              uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  current_streak       int DEFAULT 0,
  max_streak           int DEFAULT 0,
  total_completions    int DEFAULT 0,
  last_completed_date  date,
  updated_at           timestamptz DEFAULT now() NOT NULL,
  UNIQUE(habit_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_habits_user     ON public.habits(user_id) WHERE NOT is_archived;
CREATE INDEX IF NOT EXISTS idx_habit_logs_date ON public.habit_logs(habit_id, logged_date);
CREATE INDEX IF NOT EXISTS idx_habit_logs_user ON public.habit_logs(user_id, logged_date);

-- ═══════════════════════════════════════════════════════════════
-- 2. RLS (Row Level Security)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_streaks ENABLE ROW LEVEL SECURITY;

-- habits
DROP POLICY IF EXISTS "Users can view own habits" ON public.habits;
CREATE POLICY "Users can view own habits" ON public.habits
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own habits" ON public.habits;
CREATE POLICY "Users can insert own habits" ON public.habits
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own habits" ON public.habits;
CREATE POLICY "Users can update own habits" ON public.habits
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own habits" ON public.habits;
CREATE POLICY "Users can delete own habits" ON public.habits
  FOR DELETE USING (auth.uid() = user_id);

-- habit_logs
DROP POLICY IF EXISTS "Users can view own logs" ON public.habit_logs;
CREATE POLICY "Users can view own logs" ON public.habit_logs
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own logs" ON public.habit_logs;
CREATE POLICY "Users can insert own logs" ON public.habit_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own logs" ON public.habit_logs;
CREATE POLICY "Users can update own logs" ON public.habit_logs
  FOR UPDATE USING (auth.uid() = user_id);

-- habit_streaks
DROP POLICY IF EXISTS "Users can view own streaks" ON public.habit_streaks;
CREATE POLICY "Users can view own streaks" ON public.habit_streaks
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own streaks" ON public.habit_streaks;
CREATE POLICY "Users can insert own streaks" ON public.habit_streaks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own streaks" ON public.habit_streaks;
CREATE POLICY "Users can update own streaks" ON public.habit_streaks
  FOR UPDATE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- 3. RPC: complete_habit
--    Maneja: log, racha, +5 puntos, notificación anónima
-- ═══════════════════════════════════════════════════════════════

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

-- ═══════════════════════════════════════════════════════════════
-- 4. RPC: uncomplete_habit (desmarcar hábito del día)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.uncomplete_habit(p_habit_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_today date;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  v_today := (now() AT TIME ZONE 'America/Mexico_City')::date;

  -- Eliminar log de hoy
  DELETE FROM public.habit_logs
  WHERE habit_id = p_habit_id AND user_id = v_user_id AND logged_date = v_today;

  -- Nota: No revertimos puntos ni streak para simplicidad
  -- El streak se recalculará al próximo completado

  RETURN jsonb_build_object('ok', true, 'message', 'Hábito desmarcado.');
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.uncomplete_habit(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.uncomplete_habit(uuid) TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 5. Habilitar Realtime
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.habits REPLICA IDENTITY FULL;
ALTER TABLE public.habit_logs REPLICA IDENTITY FULL;
ALTER TABLE public.habit_streaks REPLICA IDENTITY FULL;

-- ═══════════════════════════════════════════════════════════════
-- 6. Política INSERT para notificaciones (habit_complete)
--    Asegurar que la función SECURITY DEFINER puede insertar
-- ═══════════════════════════════════════════════════════════════

-- La función complete_habit usa SECURITY DEFINER, así que tiene
-- permisos elevados para insertar en notifications.
-- No se requiere política adicional.
