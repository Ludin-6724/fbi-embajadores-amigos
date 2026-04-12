/* ============================================================
   FBI EMBAJADORES — REPARACIÓN COMPLETA
   Ejecutar de una sola vez en Supabase SQL Editor > New Query
   ============================================================ */

-- ============================================================
-- 1. QUITAR RESTRICCIÓN QUE BLOQUEA COMENTARIOS Y NOTIFICACIONES
-- ============================================================
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ALTER COLUMN user_id DROP NOT NULL;


-- ============================================================
-- 2. LIMPIAR REACCIONES DUPLICADAS
-- ============================================================
DELETE FROM public.post_reactions
WHERE id NOT IN (
  SELECT DISTINCT ON (post_id, user_id) id
  FROM public.post_reactions
  ORDER BY post_id, user_id, created_at DESC
);

DELETE FROM public.comment_reactions
WHERE id NOT IN (
  SELECT DISTINCT ON (comment_id, user_id) id
  FROM public.comment_reactions
  ORDER BY comment_id, user_id, created_at DESC
);


-- ============================================================
-- 3. CONSTRAINTS DE UNICIDAD (1 REACCIÓN POR USUARIO POR POST)
-- ============================================================
ALTER TABLE public.post_reactions DROP CONSTRAINT IF EXISTS post_reactions_post_id_user_id_reaction_key;
ALTER TABLE public.post_reactions DROP CONSTRAINT IF EXISTS post_reactions_post_id_user_id_key;
ALTER TABLE public.post_reactions ADD CONSTRAINT post_reactions_post_id_user_id_key UNIQUE(post_id, user_id);

ALTER TABLE public.comment_reactions DROP CONSTRAINT IF EXISTS comment_reactions_comment_id_user_id_reaction_key;
ALTER TABLE public.comment_reactions DROP CONSTRAINT IF EXISTS comment_reactions_comment_id_user_id_key;
ALTER TABLE public.comment_reactions ADD CONSTRAINT comment_reactions_comment_id_user_id_key UNIQUE(comment_id, user_id);


-- ============================================================
-- 4. RLS — PERMISOS CORRECTOS PARA REACCIONES
-- ============================================================
ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Reactions are viewable by everyone." ON public.post_reactions;
CREATE POLICY "Reactions are viewable by everyone." ON public.post_reactions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can add reactions." ON public.post_reactions;
CREATE POLICY "Authenticated users can add reactions." ON public.post_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can remove their own reactions." ON public.post_reactions;
CREATE POLICY "Users can remove their own reactions." ON public.post_reactions FOR DELETE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own reactions." ON public.post_reactions;
CREATE POLICY "Users can update their own reactions." ON public.post_reactions FOR UPDATE USING (auth.uid() = user_id);

ALTER TABLE public.comment_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Comment reactions viewable by everyone." ON public.comment_reactions;
CREATE POLICY "Comment reactions viewable by everyone." ON public.comment_reactions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can add comment reactions." ON public.comment_reactions;
CREATE POLICY "Authenticated users can add comment reactions." ON public.comment_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can remove their own comment reactions." ON public.comment_reactions;
CREATE POLICY "Users can remove their own comment reactions." ON public.comment_reactions FOR DELETE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own comment reactions." ON public.comment_reactions;
CREATE POLICY "Users can update their own comment reactions." ON public.comment_reactions FOR UPDATE USING (auth.uid() = user_id);


-- ============================================================
-- 5. TRIGGER MAESTRO DE NOTIFICACIONES (TODOS LOS TIPOS)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_notification()
RETURNS TRIGGER AS $$
DECLARE
  target_post_author uuid;
  target_comment_author uuid;
  actor_name text;
  post_snippet text;
  comm_name text;
  actor_id_val uuid;
BEGIN
  IF (TG_TABLE_NAME = 'post_reactions') THEN actor_id_val := NEW.user_id;
  ELSIF (TG_TABLE_NAME = 'comments') THEN actor_id_val := NEW.author_id;
  ELSIF (TG_TABLE_NAME = 'community_join_requests') THEN actor_id_val := NEW.user_id;
  ELSIF (TG_TABLE_NAME = 'posts') THEN actor_id_val := NEW.author_id;
  END IF;

  IF actor_id_val IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(username, full_name, 'Un agente') INTO actor_name FROM public.profiles WHERE id = actor_id_val;

  IF (TG_TABLE_NAME IN ('comments', 'posts') AND NEW.is_anonymous = true) THEN
    actor_name := 'Agente Anónimo';
  END IF;

  IF (TG_TABLE_NAME = 'post_reactions') THEN
    SELECT author_id, COALESCE(LEFT(content, 30), 'una publicación') INTO target_post_author, post_snippet FROM public.posts WHERE id = NEW.post_id;
    IF (target_post_author IS NOT NULL AND target_post_author != NEW.user_id) THEN
      INSERT INTO public.notifications (user_id, actor_id, type, message, link)
      VALUES (target_post_author, NEW.user_id, 'reaction', actor_name || ' reaccionó a tu publicación: "' || post_snippet || '..."', '/post/' || NEW.post_id);
    END IF;

  ELSIF (TG_TABLE_NAME = 'comments') THEN
    SELECT author_id, COALESCE(LEFT(content, 30), 'una publicación') INTO target_post_author, post_snippet FROM public.posts WHERE id = NEW.post_id;
    IF (target_post_author IS NOT NULL AND target_post_author != NEW.author_id) THEN
      INSERT INTO public.notifications (user_id, actor_id, type, message, link)
      VALUES (target_post_author, NEW.author_id, 'comment', actor_name || ' comentó en tu publicación: "' || post_snippet || '..."', '/post/' || NEW.post_id);
    END IF;
    IF (NEW.parent_id IS NOT NULL) THEN
      SELECT author_id INTO target_comment_author FROM public.comments WHERE id = NEW.parent_id;
      IF (target_comment_author IS NOT NULL AND target_comment_author != NEW.author_id AND target_comment_author != target_post_author) THEN
        INSERT INTO public.notifications (user_id, actor_id, type, message, link)
        VALUES (target_comment_author, NEW.author_id, 'reply', actor_name || ' respondió a tu comentario.', '/post/' || NEW.post_id);
      END IF;
    END IF;

  ELSIF (TG_TABLE_NAME = 'posts') THEN
    IF (NEW.community_id IS NULL) THEN
      INSERT INTO public.notifications (user_id, actor_id, type, message, link)
      VALUES (NULL, NEW.author_id, 'global_post', actor_name || ' ha publicado algo en el Muro.', '/post/' || NEW.id);
    END IF;

  ELSIF (TG_TABLE_NAME = 'community_join_requests') THEN
    IF (NEW.status = 'approved' AND OLD.status = 'pending') THEN
      SELECT name INTO comm_name FROM public.communities WHERE id = NEW.community_id;
      INSERT INTO public.notifications (user_id, type, message, link)
      VALUES (NEW.user_id, 'community_approved', '¡Te han aceptado en la comunidad ' || comm_name || '!', '/c/' || NEW.community_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 6. TRIGGER PARA REACCIONES EN COMENTARIOS
-- ============================================================
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


-- ============================================================
-- 7. TRIGGER PARA NUEVAS PUBLICACIONES (ya existía, recrear)
-- ============================================================
DROP TRIGGER IF EXISTS on_global_post ON public.posts;
CREATE TRIGGER on_global_post
  AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_notification();

DROP TRIGGER IF EXISTS on_post_reaction ON public.post_reactions;
CREATE TRIGGER on_post_reaction
  AFTER INSERT ON public.post_reactions
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_notification();

DROP TRIGGER IF EXISTS on_post_comment ON public.comments;
CREATE TRIGGER on_post_comment
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_notification();

DROP TRIGGER IF EXISTS on_community_approve ON public.community_join_requests;
CREATE TRIGGER on_community_approve
  AFTER UPDATE ON public.community_join_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_notification();

/* FIN — Si ves "Success" todo está correcto */
