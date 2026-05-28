/* ============================================================
   FBI Embajadores Amigos — Migración: Límites de Creación de Hábitos
   Ejecutar en: Supabase Dashboard > SQL Editor
   ============================================================ */

-- 1. Crear o reemplazar la función que valida los límites de hábitos
CREATE OR REPLACE FUNCTION public.check_habit_limits()
RETURNS TRIGGER AS $$
DECLARE
  v_active_count int;
  v_today_count int;
  v_today date;
BEGIN
  -- A. Validar límite de hábitos activos (máximo 5)
  SELECT COUNT(*) INTO v_active_count
  FROM public.habits
  WHERE user_id = NEW.user_id AND is_archived = false;

  IF v_active_count >= 5 THEN
    RAISE EXCEPTION 'Límite alcanzado: No puedes tener más de 5 hábitos activos a la vez. Archiva o elimina alguno para crear uno nuevo.';
  END IF;

  -- B. Validar límite de creación diaria (máximo 3 por día)
  v_today := (now() AT TIME ZONE 'America/Mexico_City')::date;
  
  SELECT COUNT(*) INTO v_today_count
  FROM public.habits
  WHERE user_id = NEW.user_id
    AND (created_at AT TIME ZONE 'America/Mexico_City')::date = v_today;

  IF v_today_count >= 3 THEN
    RAISE EXCEPTION 'Límite diario alcanzado: Solo puedes crear un máximo de 3 hábitos por día para evitar abusos.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Asignar el trigger BEFORE INSERT a la tabla habits
DROP TRIGGER IF EXISTS trg_check_habit_limits ON public.habits;
CREATE TRIGGER trg_check_habit_limits
  BEFORE INSERT ON public.habits
  FOR EACH ROW
  EXECUTE FUNCTION public.check_habit_limits();
