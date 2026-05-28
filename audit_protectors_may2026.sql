-- ============================================================
-- AUDITORÍA: Identificar usuarios que perdieron protectores
-- por el bug en register_streak_checkin
-- 
-- Este script es DE SOLO LECTURA. No modifica nada.
-- Ejecutar en Supabase SQL Editor > New Query
-- ============================================================

-- Buscar notificaciones de tipo 'protector_used' que fueron generadas
-- por register_streak_checkin (mensaje contiene "Tu protector salvó tu racha")
-- vs las generadas por el cron (mensaje contiene "Protector Automático")

SELECT 
  n.id AS notification_id,
  n.user_id,
  COALESCE(p.full_name, p.username, 'Sin nombre') AS nombre_agente,
  p.streak_protectors AS protectores_actuales,
  n.message,
  n.created_at,
  (n.created_at AT TIME ZONE 'America/Mexico_City')::date AS fecha_notif_mx,
  CASE 
    WHEN n.message LIKE '%Tu protector salvó tu racha%' THEN 'BUG: register_streak_checkin'
    WHEN n.message LIKE '%Protector Automático%' THEN 'OK: cron process_daily_streaks'
    ELSE 'OTRO'
  END AS origen,
  -- Verificar si el usuario publicó una misión ese mismo día (lo que confirma el bug)
  EXISTS (
    SELECT 1 FROM public.posts po
    WHERE po.author_id = n.user_id
      AND po.content LIKE '%¡Acabo de registrar mi misión del día!%'
      AND (po.created_at AT TIME ZONE 'America/Mexico_City')::date = (n.created_at AT TIME ZONE 'America/Mexico_City')::date
  ) AS publico_mision_ese_dia
FROM public.notifications n
JOIN public.profiles p ON p.id = n.user_id
WHERE n.type = 'protector_used'
ORDER BY n.created_at DESC;

-- Resumen: cuántos protectores se perdieron por el bug
SELECT 
  COUNT(*) AS total_notificaciones_protector,
  COUNT(*) FILTER (WHERE message LIKE '%Tu protector salvó tu racha%') AS generadas_por_bug,
  COUNT(*) FILTER (WHERE message LIKE '%Protector Automático%') AS generadas_por_cron,
  COUNT(*) FILTER (
    WHERE message LIKE '%Tu protector salvó tu racha%'
    AND EXISTS (
      SELECT 1 FROM public.posts po
      WHERE po.author_id = notifications.user_id
        AND po.content LIKE '%¡Acabo de registrar mi misión del día!%'
        AND (po.created_at AT TIME ZONE 'America/Mexico_City')::date = (notifications.created_at AT TIME ZONE 'America/Mexico_City')::date
    )
  ) AS protectores_a_devolver
FROM public.notifications
WHERE type = 'protector_used';
