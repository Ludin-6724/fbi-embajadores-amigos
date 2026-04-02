/* ============================================================
   FBI Embajadores Amigos — Communities V2 Migration
   Ejecutar en: Supabase Dashboard > SQL Editor
   ============================================================ */

-- 1. Añadir campo is_private a communities
ALTER TABLE public.communities ADD COLUMN IF NOT EXISTS is_private boolean DEFAULT false;

-- 2. Añadir código de invitación único a communities
ALTER TABLE public.communities ADD COLUMN IF NOT EXISTS invite_code text UNIQUE;

-- 3. Permitir DELETE en communities (solo al owner) — añadir policy si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'communities' AND policyname = 'Only owner can delete community.'
  ) THEN
    EXECUTE 'CREATE POLICY "Only owner can delete community." ON communities FOR DELETE USING (auth.uid() = owner_id)';
  END IF;
END $$;

-- 4. Crear tabla de solicitudes de membresía
CREATE TABLE IF NOT EXISTS public.community_join_requests (
  id          uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  community_id uuid REFERENCES public.communities(id) ON DELETE CASCADE NOT NULL,
  user_id     uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  status      text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')) NOT NULL,
  message     text,
  created_at  timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  reviewed_at timestamptz,
  UNIQUE(community_id, user_id)
);

-- 5. RLS para join_requests
ALTER TABLE public.community_join_requests ENABLE ROW LEVEL SECURITY;

-- Usuarios ven sus propias solicitudes
CREATE POLICY "Users see their own requests." ON public.community_join_requests
  FOR SELECT USING (auth.uid() = user_id);

-- El owner de la comunidad ve todas las solicitudes de su comunidad
CREATE POLICY "Owner sees all requests for their community." ON public.community_join_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.communities
      WHERE communities.id = community_join_requests.community_id
        AND communities.owner_id = auth.uid()
    )
  );

-- Usuario autenticado puede enviar solicitud (solo la suya)
CREATE POLICY "Authenticated users can request to join." ON public.community_join_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- El owner puede actualizar el estado (aprobar / rechazar)
CREATE POLICY "Owner can approve or reject requests." ON public.community_join_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.communities
      WHERE communities.id = community_join_requests.community_id
        AND communities.owner_id = auth.uid()
    )
  );

-- El mismo usuario puede cancelar su solicitud
CREATE POLICY "User can delete own request." ON public.community_join_requests
  FOR DELETE USING (auth.uid() = user_id);
