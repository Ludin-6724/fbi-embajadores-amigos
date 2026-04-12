-- 1. Permitir que user_id sea nulo para notificaciones globales de "Broadcast"
ALTER TABLE public.notifications ALTER COLUMN user_id DROP NOT NULL;

-- 2. Actualizar el Trigger para soportar publicaciones nuevas (posts)
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
    -- 1. Identificar el actor según la tabla
    IF (TG_TABLE_NAME = 'post_reactions') THEN
        actor_id_val := NEW.user_id;
    ELSIF (TG_TABLE_NAME = 'comments') THEN
        actor_id_val := NEW.author_id;
    ELSIF (TG_TABLE_NAME = 'community_join_requests') THEN
        actor_id_val := NEW.user_id;
    ELSIF (TG_TABLE_NAME = 'posts') THEN
        actor_id_val := NEW.author_id;
    END IF;

    -- Si no hay actor o el actor falló, salir
    IF actor_id_val IS NULL THEN RETURN NEW; END IF;

    -- 2. Obtener nombre del actor
    SELECT COALESCE(username, full_name, 'Un agente') INTO actor_name 
    FROM public.profiles WHERE id = actor_id_val;

    -- Si la acción es anónima (para comentarios o posts), cambiar nombre
    IF ((TG_TABLE_NAME = 'comments' OR TG_TABLE_NAME = 'posts') AND NEW.is_anonymous = true) THEN
        actor_name := 'Agente Anónimo';
    END IF;

    -- 3. Lógica según la tabla
    IF (TG_TABLE_NAME = 'post_reactions') THEN
        SELECT author_id, LEFT(content, 30) INTO target_post_author, post_snippet 
        FROM public.posts WHERE id = NEW.post_id;
        
        IF (target_post_author != NEW.user_id) THEN 
            INSERT INTO public.notifications (user_id, actor_id, type, message, link)
            VALUES (target_post_author, NEW.user_id, 'reaction', actor_name || ' reaccionó a tu publicación: "' || post_snippet || '..."', '/post/' || NEW.post_id);
        END IF;

    ELSIF (TG_TABLE_NAME = 'comments') THEN
        SELECT author_id, LEFT(content, 30) INTO target_post_author, post_snippet 
        FROM public.posts WHERE id = NEW.post_id;

        IF (target_post_author != NEW.author_id) THEN 
            INSERT INTO public.notifications (user_id, actor_id, type, message, link)
            VALUES (target_post_author, NEW.author_id, 'comment', actor_name || ' comentó en tu publicación: "' || post_snippet || '..."', '/post/' || NEW.post_id);
        END IF;

        IF (NEW.parent_id IS NOT NULL) THEN
            SELECT author_id INTO target_comment_author FROM public.comments WHERE id = NEW.parent_id;
            
            IF (target_comment_author != NEW.author_id AND target_comment_author != target_post_author) THEN
                INSERT INTO public.notifications (user_id, actor_id, type, message, link)
                VALUES (target_comment_author, NEW.author_id, 'reply', actor_name || ' respondió a tu comentario.', '/post/' || NEW.post_id);
            END IF;
        END IF;

    ELSIF (TG_TABLE_NAME = 'posts') THEN
        -- Solo notificar masivamente si la publicación va al Muro General (comunidad Nula)
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

-- 3. Crear el Trigger para POSTS
DROP TRIGGER IF EXISTS on_global_post ON public.posts;
CREATE TRIGGER on_global_post
  AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_notification();
