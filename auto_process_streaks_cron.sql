-- Activar pg_cron si no está activo (en Supabase suele estar disponible pero hay que activarlo en Database -> Extensions)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Función para procesar las rachas diariamente
CREATE OR REPLACE FUNCTION process_daily_streaks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  streak_record RECORD;
  user_protectors INT;
  -- Definir "ayer" basado en la hora de México
  yesterday_date DATE := (now() AT TIME ZONE 'America/Mexico_City')::date - 1;
  streak_last_checkin DATE;
  days_missed INT;
BEGIN
  -- Recorrer todas las rachas que tienen días > 0
  FOR streak_record IN 
    SELECT id, user_id, streak_days, max_streak, last_checkin 
    FROM public.streaks 
    WHERE streak_days > 0 
  LOOP
    -- Obtener la fecha del último check-in en la zona horaria de México
    streak_last_checkin := (streak_record.last_checkin AT TIME ZONE 'America/Mexico_City')::date;
    
    -- Si el último checkin fue antes de ayer, significa que falló ayer (o más días)
    IF streak_last_checkin < yesterday_date THEN
      
      -- Cuántos días han pasado sin publicar hasta ayer
      days_missed := yesterday_date - streak_last_checkin;
      
      -- Obtener los protectores del usuario
      SELECT streak_protectors INTO user_protectors 
      FROM public.profiles 
      WHERE id = streak_record.user_id;
      
      IF user_protectors IS NULL THEN
        user_protectors := 0;
      END IF;

      -- Si tiene protectores suficientes para cubrir el día de ayer (o los días que faltan)
      IF user_protectors >= days_missed THEN
        -- Consumir protectores
        UPDATE public.profiles 
        SET streak_protectors = streak_protectors - days_missed 
        WHERE id = streak_record.user_id;

        -- Sumar los días a la racha y actualizar last_checkin al día de ayer (simulando que lo hizo)
        UPDATE public.streaks 
        SET 
          streak_days = streak_days + days_missed,
          max_streak = GREATEST(max_streak, streak_days + days_missed),
          last_checkin = (yesterday_date + time '12:00:00') AT TIME ZONE 'America/Mexico_City',
          last_mission_note = '🛡️ Racha salvada automáticamente por Protector'
        WHERE id = streak_record.id;

        -- Enviar notificación informando que el protector actuó
        INSERT INTO public.notifications (user_id, actor_id, type, message, link)
        VALUES (
          streak_record.user_id, 
          streak_record.user_id, 
          'protector_used', 
          '🛡️ ¡No publicaste ayer, pero tu Protector Automático salvó tu racha y sumó ' || days_missed || ' día(s)!', 
          '#rachas'
        );

      ELSE
        -- No tiene suficientes protectores, la racha se rompe y vuelve a cero
        UPDATE public.streaks 
        SET streak_days = 0 
        WHERE id = streak_record.id;
        
        -- Enviar notificación de que perdió la racha
        INSERT INTO public.notifications (user_id, actor_id, type, message, link)
        VALUES (
          streak_record.user_id, 
          streak_record.user_id, 
          'streak_lost', 
          '💔 Perdiste tu racha de ' || streak_record.streak_days || ' días porque no publicaste ayer.', 
          '#rachas'
        );
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- Programar el cron para que corra todos los días a las 00:05 AM (hora de servidor, en UTC sería ~06:05 AM para coincidir con MX)
-- Si ya existe un cron con este nombre, primero lo borramos para evitar duplicados
DO $$
BEGIN
  PERFORM cron.unschedule('process_daily_streaks_cron');
EXCEPTION WHEN OTHERS THEN
  -- Ignorar si no existe
END $$;

SELECT cron.schedule(
  'process_daily_streaks_cron',
  '5 6 * * *', -- Minuto 5, Hora 6 (UTC), equivale a las 00:05 am (Ciudad de México)
  $$ SELECT public.process_daily_streaks(); $$
);
