-- ═══════════════════════════════════════════════════════════
-- FBI EMBAJADORES AMIGOS — SCRIPT DEFINITIVO DE PERMISOS
-- Ejecutar en Supabase SQL Editor UNA SOLA VEZ
-- ═══════════════════════════════════════════════════════════

-- ╔════════════════════════════════╗
-- ║  1. TABLA: posts               ║
-- ╚════════════════════════════════╝
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Posts are viewable by everyone." ON public.posts;
CREATE POLICY "Posts are viewable by everyone." ON public.posts 
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert posts." ON public.posts;
CREATE POLICY "Authenticated users can insert posts." ON public.posts 
  FOR INSERT WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Users can update their own posts." ON public.posts;
CREATE POLICY "Users can update their own posts." ON public.posts 
  FOR UPDATE USING (auth.uid() = author_id);

DROP POLICY IF EXISTS "Users can delete their own posts." ON public.posts;
CREATE POLICY "Users can delete their own posts." ON public.posts 
  FOR DELETE USING (auth.uid() = author_id);

-- ╔════════════════════════════════╗
-- ║  2. TABLA: post_reactions       ║
-- ╚════════════════════════════════╝
ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Reactions are viewable by everyone." ON public.post_reactions;
CREATE POLICY "Reactions are viewable by everyone." ON public.post_reactions 
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can add reactions." ON public.post_reactions;
CREATE POLICY "Authenticated users can add reactions." ON public.post_reactions 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove their own reactions." ON public.post_reactions;
CREATE POLICY "Users can remove their own reactions." ON public.post_reactions 
  FOR DELETE USING (auth.uid() = user_id);

-- ╔════════════════════════════════╗
-- ║  3. TABLA: comments             ║
-- ╚════════════════════════════════╝
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Comments are viewable by everyone." ON public.comments;
CREATE POLICY "Comments are viewable by everyone." ON public.comments 
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can comment." ON public.comments;
CREATE POLICY "Authenticated users can comment." ON public.comments 
  FOR INSERT WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Users can delete their own comments." ON public.comments;
CREATE POLICY "Users can delete their own comments." ON public.comments 
  FOR DELETE USING (auth.uid() = author_id);

-- ╔════════════════════════════════╗
-- ║  4. TABLA: streaks              ║
-- ╚════════════════════════════════╝
ALTER TABLE public.streaks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Streaks are viewable by everyone." ON public.streaks;
CREATE POLICY "Streaks are viewable by everyone." ON public.streaks 
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can create their own streak." ON public.streaks;
CREATE POLICY "Authenticated users can create their own streak." ON public.streaks 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own streak." ON public.streaks;
CREATE POLICY "Users can update their own streak." ON public.streaks 
  FOR UPDATE USING (auth.uid() = user_id);

-- ╔════════════════════════════════╗
-- ║  5. TABLA: profiles             ║
-- ╚════════════════════════════════╝
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles are viewable by everyone." ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone." ON public.profiles 
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;
CREATE POLICY "Users can update their own profile." ON public.profiles 
  FOR UPDATE USING (auth.uid() = id);

-- ═══════════════════════════════════════════════════════════
-- ¡LISTO! Todas las tablas sociales tienen permisos completos.
-- ═══════════════════════════════════════════════════════════
