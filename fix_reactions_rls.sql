-- DIAGNÓSTICO Y CORRECCIÓN COMPLETA DE REACCIONES

-- 1. Verificar y corregir RLS de post_reactions
ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own reactions" ON public.post_reactions;
CREATE POLICY "Users can insert own reactions" ON public.post_reactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own reactions" ON public.post_reactions;
CREATE POLICY "Users can delete own reactions" ON public.post_reactions
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view all reactions" ON public.post_reactions;
CREATE POLICY "Users can view all reactions" ON public.post_reactions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own reactions" ON public.post_reactions;
CREATE POLICY "Users can update own reactions" ON public.post_reactions
  FOR UPDATE USING (auth.uid() = user_id);

-- 2. Verificar y corregir RLS de comment_reactions
ALTER TABLE public.comment_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own comment reactions" ON public.comment_reactions;
CREATE POLICY "Users can insert own comment reactions" ON public.comment_reactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own comment reactions" ON public.comment_reactions;
CREATE POLICY "Users can delete own comment reactions" ON public.comment_reactions
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view all comment reactions" ON public.comment_reactions;
CREATE POLICY "Users can view all comment reactions" ON public.comment_reactions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own comment reactions" ON public.comment_reactions;
CREATE POLICY "Users can update own comment reactions" ON public.comment_reactions
  FOR UPDATE USING (auth.uid() = user_id);

-- 3. Trigger para notificaciones de reacciones en comentarios
CREATE OR REPLACE FUNCTION public.handle_comment_reaction_notification()
RETURNS TRIGGER AS $$
DECLARE
  target_comment_author uuid;
  actor_name text;
  is_anon boolean;
BEGIN
  -- Obtener el autor del comentario
  SELECT author_id, is_anonymous INTO target_comment_author, is_anon FROM public.comments WHERE id = NEW.comment_id;
  
  -- No notificar si el autor reaccionó a su propio comentario
  IF target_comment_author IS NULL OR target_comment_author = NEW.user_id THEN RETURN NEW; END IF;
  
  -- Obtener nombre
  SELECT COALESCE(username, full_name, 'Un agente') INTO actor_name FROM public.profiles WHERE id = NEW.user_id;
  
  INSERT INTO public.notifications (user_id, actor_id, type, message, link)
  VALUES (
    target_comment_author, 
    NEW.user_id, 
    'reaction', 
    actor_name || ' reaccionó a tu comentario.',
    '/post/' || (SELECT post_id FROM public.comments WHERE id = NEW.comment_id)
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_comment_reaction ON public.comment_reactions;
CREATE TRIGGER on_comment_reaction
  AFTER INSERT ON public.comment_reactions
  FOR EACH ROW EXECUTE FUNCTION public.handle_comment_reaction_notification();
