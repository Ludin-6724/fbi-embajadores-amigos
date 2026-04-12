-- PASO 1: Limpiar duplicados de post_reactions (dejar solo la más reciente por usuario+post)
DELETE FROM public.post_reactions
WHERE id NOT IN (
  SELECT DISTINCT ON (post_id, user_id) id
  FROM public.post_reactions
  ORDER BY post_id, user_id, created_at DESC
);

-- PASO 2: Eliminar constraint viejo y crear el correcto
ALTER TABLE public.post_reactions DROP CONSTRAINT IF EXISTS post_reactions_post_id_user_id_reaction_key;
ALTER TABLE public.post_reactions DROP CONSTRAINT IF EXISTS post_reactions_post_id_user_id_key;
ALTER TABLE public.post_reactions ADD CONSTRAINT post_reactions_post_id_user_id_key UNIQUE(post_id, user_id);

-- PASO 3: Limpiar duplicados de comment_reactions
DELETE FROM public.comment_reactions
WHERE id NOT IN (
  SELECT DISTINCT ON (comment_id, user_id) id
  FROM public.comment_reactions
  ORDER BY comment_id, user_id, created_at DESC
);

-- PASO 4: Constraint único para comment_reactions
ALTER TABLE public.comment_reactions DROP CONSTRAINT IF EXISTS comment_reactions_comment_id_user_id_reaction_key;
ALTER TABLE public.comment_reactions DROP CONSTRAINT IF EXISTS comment_reactions_comment_id_user_id_key;
ALTER TABLE public.comment_reactions ADD CONSTRAINT comment_reactions_comment_id_user_id_key UNIQUE(comment_id, user_id);

-- PASO 5: RLS post_reactions
ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Reactions are viewable by everyone." ON public.post_reactions;
CREATE POLICY "Reactions are viewable by everyone." ON public.post_reactions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can add reactions." ON public.post_reactions;
CREATE POLICY "Authenticated users can add reactions." ON public.post_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can remove their own reactions." ON public.post_reactions;
CREATE POLICY "Users can remove their own reactions." ON public.post_reactions FOR DELETE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own reactions." ON public.post_reactions;
CREATE POLICY "Users can update their own reactions." ON public.post_reactions FOR UPDATE USING (auth.uid() = user_id);

-- PASO 6: RLS comment_reactions
ALTER TABLE public.comment_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Comment reactions viewable by everyone." ON public.comment_reactions;
CREATE POLICY "Comment reactions viewable by everyone." ON public.comment_reactions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can add comment reactions." ON public.comment_reactions;
CREATE POLICY "Authenticated users can add comment reactions." ON public.comment_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can remove their own comment reactions." ON public.comment_reactions;
CREATE POLICY "Users can remove their own comment reactions." ON public.comment_reactions FOR DELETE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own comment reactions." ON public.comment_reactions;
CREATE POLICY "Users can update their own comment reactions." ON public.comment_reactions FOR UPDATE USING (auth.uid() = user_id);

-- PASO 7: Trigger notificación de reacciones en comentarios
CREATE OR REPLACE FUNCTION public.handle_comment_reaction_notification()
RETURNS TRIGGER AS $$
DECLARE
  target_comment_author uuid;
  actor_name text;
  target_post_id uuid;
BEGIN
  SELECT author_id, post_id INTO target_comment_author, target_post_id FROM public.comments WHERE id = NEW.comment_id;
  IF target_comment_author IS NULL OR target_comment_author = NEW.user_id THEN RETURN NEW; END IF;
  SELECT COALESCE(username, full_name, 'Un agente') INTO actor_name FROM public.profiles WHERE id = NEW.user_id;
  INSERT INTO public.notifications (user_id, actor_id, type, message, link)
  VALUES (target_comment_author, NEW.user_id, 'reaction', actor_name || ' reaccionó a tu comentario.', '/post/' || target_post_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_comment_reaction ON public.comment_reactions;
CREATE TRIGGER on_comment_reaction
  AFTER INSERT ON public.comment_reactions
  FOR EACH ROW EXECUTE FUNCTION public.handle_comment_reaction_notification();
