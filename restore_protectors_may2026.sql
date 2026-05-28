-- ============================================================
-- RESTAURACIÓN DE PROTECTORES - Mayo 2026
-- Devuelve protectores consumidos incorrectamente por el bug
-- en register_streak_checkin
--
-- ⚠️ EJECUTAR PRIMERO audit_protectors_may2026.sql PARA VERIFICAR
-- Ejecutar en Supabase SQL Editor > New Query
-- ============================================================

DO $$
DECLARE
  rec RECORD;
  v_notif_date DATE;
  v_post_exists BOOLEAN;
  v_refunded_count INT := 0;
  v_username TEXT;
  v_total_checked INT := 0;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RESTAURACIÓN DE PROTECTORES - Mayo 2026';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  
  -- Solo procesar notificaciones generadas por register_streak_checkin (el bug)
  -- Estas tienen el mensaje "Tu protector salvó tu racha"
  -- Las del cron tienen "Protector Automático" y son legítimas
  FOR rec IN
    SELECT id, user_id, created_at, message
    FROM public.notifications
    WHERE type = 'protector_used'
      AND message LIKE '%Tu protector salvó tu racha%'
    ORDER BY created_at DESC
  LOOP
    v_total_checked := v_total_checked + 1;
    
    -- Fecha de la notificación en zona horaria de México
    v_notif_date := (rec.created_at AT TIME ZONE 'America/Mexico_City')::date;
    
    -- Nombre del usuario para el log
    SELECT COALESCE(full_name, username, 'Agente Desconocido') INTO v_username
    FROM public.profiles
    WHERE id = rec.user_id;
    
    -- Verificar si el usuario publicó una misión ese mismo día
    -- (lo que confirma que el protector no debía consumirse)
    SELECT EXISTS (
      SELECT 1
      FROM public.posts
      WHERE author_id = rec.user_id
        AND content LIKE '%¡Acabo de registrar mi misión del día!%'
        AND (created_at AT TIME ZONE 'America/Mexico_City')::date = v_notif_date
    ) INTO v_post_exists;
    
    IF v_post_exists THEN
      -- El usuario SÍ registró su misión ese día → el protector fue consumido por el bug
      -- Devolver el protector
      UPDATE public.profiles
      SET streak_protectors = COALESCE(streak_protectors, 0) + 1
      WHERE id = rec.user_id;
      
      -- Eliminar la notificación incorrecta del bug
      DELETE FROM public.notifications WHERE id = rec.id;
      
      v_refunded_count := v_refunded_count + 1;
      RAISE NOTICE '✅ Devuelto 1 protector a % (user_id: %) — Notif fecha: %', 
        v_username, rec.user_id, v_notif_date;
    ELSE
      RAISE NOTICE '⏭️  Omitido % (user_id: %) — No publicó misión el % (protector pudo ser legítimo)', 
        v_username, rec.user_id, v_notif_date;
    END IF;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RESUMEN';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Notificaciones revisadas: %', v_total_checked;
  RAISE NOTICE 'Protectores devueltos: %', v_refunded_count;
  RAISE NOTICE 'Omitidos (posiblemente legítimos): %', v_total_checked - v_refunded_count;
  RAISE NOTICE '========================================';
END $$;
