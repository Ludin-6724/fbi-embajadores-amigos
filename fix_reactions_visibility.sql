-- PERMISOS DE SUPERVIVENCIA PARA REACCIONES Y COMENTARIOS
-- Ejecuta esto en el SQL Editor de Supabase para asegurar que los datos sean visibles

-- 1. Habilitar lectura pública para reacciones de posts
DROP POLICY IF EXISTS "Permitir lectura de reacciones" ON public.post_reactions;
CREATE POLICY "Permitir lectura de reacciones" ON public.post_reactions
FOR SELECT USING (true);

-- 2. Habilitar lectura pública para reacciones de comentarios
DROP POLICY IF EXISTS "Permitir lectura de reacciones de comentarios" ON public.comment_reactions;
CREATE POLICY "Permitir lectura de reacciones de comentarios" ON public.comment_reactions
FOR SELECT USING (true);

-- 3. Habilitar inserción/borrado para usuarios autenticados
DROP POLICY IF EXISTS "Los usuarios pueden reaccionar" ON public.post_reactions;
CREATE POLICY "Los usuarios pueden reaccionar" ON public.post_reactions
FOR ALL TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Los usuarios pueden reaccionar a comentarios" ON public.comment_reactions;
CREATE POLICY "Los usuarios pueden reaccionar a comentarios" ON public.comment_reactions
FOR ALL TO authenticated USING (auth.uid() = user_id);

-- 4. Asegurar que las columnas sean UUID correctamente (si falló antes)
ALTER TABLE IF EXISTS public.post_reactions 
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN reaction SET NOT NULL;

ALTER TABLE IF EXISTS public.comment_reactions 
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN reaction SET NOT NULL;

-- 5. Grant permissions explicitos
GRANT ALL ON TABLE public.post_reactions TO authenticated;
GRANT SELECT ON TABLE public.post_reactions TO anon;
GRANT ALL ON TABLE public.comment_reactions TO authenticated;
GRANT SELECT ON TABLE public.comment_reactions TO anon;
