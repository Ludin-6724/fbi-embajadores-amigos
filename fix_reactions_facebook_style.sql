-- 1. Asegurar que los nuevos tipos existan en el ENUM reaction_type (si existe)
-- Nota: ALTER TYPE ADD VALUE no puede ejecutarse dentro de bloques de transacciones BEGIN/COMMIT en algunas versiones de Postgres.
-- Ejecuta estas líneas por separado si Supabase te da error de transacción.
ALTER TYPE public.reaction_type ADD VALUE IF NOT EXISTS 'heart';
ALTER TYPE public.reaction_type ADD VALUE IF NOT EXISTS 'haha';

-- 2. Crear tabla de reacciones para comentarios (usando el mismo ENUM para consistencia)
CREATE TABLE IF NOT EXISTS public.comment_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reaction public.reaction_type NOT NULL, -- Usamos el mismo ENUM que post_reactions
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(comment_id, user_id, reaction)
);

-- 3. Habilitar RLS en la nueva tabla
ALTER TABLE public.comment_reactions ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de acceso para comment_reactions
DROP POLICY IF EXISTS "Authenticated users can view comment reactions." ON public.comment_reactions;
CREATE POLICY "Authenticated users can view comment reactions." ON public.comment_reactions 
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can manage their own comment reactions." ON public.comment_reactions;
CREATE POLICY "Users can manage their own comment reactions." ON public.comment_reactions 
  FOR ALL USING (auth.uid() = user_id);

-- 5. Asegurar índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment_id ON public.comment_reactions(comment_id);
