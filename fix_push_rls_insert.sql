-- Relajar temporalmente las políticas de RLS para permitir que la BD guarde el registro
-- incluso si Vercel no tiene configurada la llave de Administrador (Service Role Key).

DROP POLICY IF EXISTS "Users can insert their own subscriptions." ON public.push_subscriptions;
CREATE POLICY "Allow any insert for subscriptions" ON public.push_subscriptions
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update their own subscriptions." ON public.push_subscriptions;
CREATE POLICY "Allow any update for subscriptions" ON public.push_subscriptions
  FOR UPDATE USING (true);
