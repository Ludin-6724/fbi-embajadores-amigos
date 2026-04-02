/* FBI Embajadores Amigos - Social Features Schema Update */

-- 1. Actualizar tabla POSTS para soportar anonimato
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS is_anonymous boolean DEFAULT false;

-- 2. Crear tipo ENUM de reacción
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reaction_type') THEN
        CREATE TYPE reaction_type AS ENUM ('like', 'amen', 'pray');
    END IF;
END $$;

-- 3. Crear tabla de REACCIONES (post_reactions)
CREATE TABLE IF NOT EXISTS public.post_reactions (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  reaction reaction_type NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Un usuario solo puede reaccionar una vez por tipo a un mismo post
  UNIQUE(post_id, user_id, reaction)
);

ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Reactions are viewable by everyone." ON public.post_reactions;
CREATE POLICY "Reactions are viewable by everyone." ON public.post_reactions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can add reactions." ON public.post_reactions;
CREATE POLICY "Authenticated users can add reactions." ON public.post_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove their own reactions." ON public.post_reactions;
CREATE POLICY "Users can remove their own reactions." ON public.post_reactions FOR DELETE USING (auth.uid() = user_id);

-- 4. Crear tabla de COMENTARIOS (comments)
CREATE TABLE IF NOT EXISTS public.comments (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  author_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Comments are viewable by everyone." ON public.comments;
CREATE POLICY "Comments are viewable by everyone." ON public.comments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can comment." ON public.comments;
CREATE POLICY "Authenticated users can comment." ON public.comments FOR INSERT WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Users can delete their own comments." ON public.comments;
CREATE POLICY "Users can delete their own comments." ON public.comments FOR DELETE USING (auth.uid() = author_id);

-- 5. Actualizar tabla STREAKS para soportar Misiones Diarias Guardadas
ALTER TABLE public.streaks 
  ADD COLUMN IF NOT EXISTS last_mission_title text,
  ADD COLUMN IF NOT EXISTS last_mission_note text;

-- Notas:
-- Ya tienes las tablas 'communities' y 'community_members' listas de tu archivo original supabase_schema.sql.
