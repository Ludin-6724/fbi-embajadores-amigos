CREATE OR REPLACE FUNCTION public.handle_new_notification()
RETURNS TRIGGER AS $$
DECLARE
  target_user_id uuid;
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
    END IF;

    -- 2. Obtener nombre del actor (quien realiza la acción)
    IF actor_id_val IS NOT NULL THEN
        SELECT COALESCE(username, full_name, 'Un agente') INTO actor_name 
        FROM public.profiles WHERE id = actor_id_val;
    ELSE
        actor_name := 'Un agente';
    END IF;

    -- 3. Lógica según la tabla que dispara el trigger
    IF (TG_TABLE_NAME = 'post_reactions') THEN
        SELECT author_id, LEFT(content, 30) INTO target_user_id, post_snippet FROM public.posts WHERE id = NEW.post_id;
        IF (target_user_id = NEW.user_id) THEN RETURN NEW; END IF;

        INSERT INTO public.notifications (user_id, actor_id, type, message, link)
        VALUES (target_user_id, NEW.user_id, 'reaction', actor_name || ' reaccionó a tu publicación: "' || post_snippet || '..."', '/post/' || NEW.post_id);

    ELSIF (TG_TABLE_NAME = 'comments') THEN
        SELECT author_id, LEFT(content, 30) INTO target_user_id, post_snippet FROM public.posts WHERE id = NEW.post_id;
        IF (target_user_id = NEW.author_id) THEN RETURN NEW; END IF;

        INSERT INTO public.notifications (user_id, actor_id, type, message, link)
        VALUES (target_user_id, NEW.author_id, 'comment', actor_name || ' comentó en tu publicación: "' || post_snippet || '..."', '/post/' || NEW.post_id);

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
