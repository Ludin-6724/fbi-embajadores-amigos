-- 1. Asegurar que las suscripciones a push puedan ser leídas por Vercel sin Service Role Key
DROP POLICY IF EXISTS "Users can read their own subscriptions." ON public.push_subscriptions;
CREATE POLICY "Allow Webhook to read all subscriptions" ON public.push_subscriptions
  FOR SELECT USING (true);

-- 2. Asegurar y forzar que el Realtime esté encendido para la tabla "notifications"
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- 3. Insertar la tabla en la publicación nativa (bloque PL/pgSQL corregido)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_publication 
        WHERE pubname = 'supabase_realtime'
    ) THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
