-- FBI Embajadores Amigos - RE-VERIFY SOCIAL RLS POLICIES
-- Ejecuta este script en el SQL EDITOR de Supabase para asegurar permisos totales

-- 1. Asegurar RLS en reacciones
ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Reactions are viewable by everyone." ON public.post_reactions;
CREATE POLICY "Reactions are viewable by everyone." ON public.post_reactions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can add reactions." ON public.post_reactions;
CREATE POLICY "Authenticated users can add reactions." ON public.post_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can remove their own reactions." ON public.post_reactions;
CREATE POLICY "Users can remove their own reactions." ON public.post_reactions FOR DELETE USING (auth.uid() = user_id);

-- 2. Asegurar RLS en comentarios
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Comments are viewable by everyone." ON public.comments;
CREATE POLICY "Comments are viewable by everyone." ON public.comments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can comment." ON public.comments;
CREATE POLICY "Authenticated users can comment." ON public.comments FOR INSERT WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS "Users can delete their own comments." ON public.comments;
CREATE POLICY "Users can delete their own comments." ON public.comments FOR DELETE USING (auth.uid() = author_id);
