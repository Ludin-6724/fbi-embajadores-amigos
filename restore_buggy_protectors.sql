-- ============================================================
-- SCRIPT DE DEVOLUCIÓN DE PROTECTORES DE RACHAS AFECTADOS
-- Ejecutar en Supabase SQL Editor > New Query
-- ============================================================

DO $$
DECLARE
  rec RECORD;
  v_notif_date DATE;
  v_post_exists BOOLEAN;
  v_refunded_count INT := 0;
  v_username text;
BEGIN
  RAISE NOTICE 'Iniciando proceso de devolución de protectores de racha...';
  
  FOR rec IN
    SELECT id, user_id, created_at, message
    FROM public.notifications
    WHERE type = 'protector_used'
  LOOP
    -- Obtener la fecha de la notificación en zona horaria local de México
    v_notif_date := (rec.created_at AT TIME ZONE 'America/Mexico_City')::date;
    
    -- Obtener el nombre del usuario para el log
    SELECT COALESCE(username, full_name, 'Agente') INTO v_username
    FROM public.profiles
    WHERE id = rec.user_id;
    
    -- Verificar si el usuario publicó una misión el día de ayer (v_notif_date - 1)
    SELECT EXISTS (
      SELECT 1
      FROM public.posts
      WHERE author_id = rec.user_id
        AND content LIKE '%¡Acabo de registrar mi misión del día!%'
        AND (created_at AT TIME ZONE 'America/Mexico_City')::date = v_notif_date - 1
    ) INTO v_post_exists;
    
    -- Si publicó ayer, el protector fue consumido incorrectamente por el bug
    IF v_post_exists THEN
      -- Devolver el protector al usuario en public.profiles
      UPDATE public.profiles
      SET streak_protectors = COALESCE(streak_protectors, 0) + 1
      WHERE id = rec.user_id;
      
      v_refunded_count := v_refunded_count + 1;
      RAISE NOTICE 'Devuelto 1 protector al agente % (user_id: %) - Notificación del % (misión cubierta: %)', 
        v_username, rec.user_id, v_notif_date, v_notif_date - 1;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Proceso completado. Total de protectores devueltos: %', v_refunded_count;
END $$;
