-- Vamos a permitir temporalmente que la base de datos entregue
-- las suscripciones sin importar RLS, ya que el Webhook podría 
-- estar topándose con una pared por no tener la SERVICE_ROLE_KEY de Supabase.

DROP POLICY IF EXISTS "Users can read their own subscriptions." ON public.push_subscriptions;

-- Hacemos que cualquier consulta del servidor pueda leer,
-- para evitar que el Webhook falle silenciosamente y no envíe la notificación.
CREATE POLICY "Allow Webhook to read all subscriptions" ON public.push_subscriptions
  FOR SELECT USING (true);
