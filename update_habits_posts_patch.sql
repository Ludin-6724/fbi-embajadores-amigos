/* ============================================================
   FBI Embajadores Amigos — Parche de Notificaciones de Hábitos
   Ejecutar en: Supabase Dashboard > SQL Editor
   ============================================================ */

-- 1. Actualizar la función trigger para soportar mensajes de ánimo de hábitos personalizados
CREATE OR REPLACE FUNCTION public.handle_new_notification()
RETURNS TRIGGER AS $$
DECLARE
  target_user_id uuid;
  actor_name text;
  post_snippet text;
  comm_name text;
BEGIN
    -- Obtener nombre del actor (quien realiza la acción)
    SELECT COALESCE(username, full_name, 'Un agente') INTO actor_name 
    FROM public.profiles WHERE id = NEW.user_id OR id = (CASE 
        WHEN TG_TABLE_NAME = 'post_reactions' THEN NEW.user_id 
        WHEN TG_TABLE_NAME = 'comments' THEN NEW.author_id 
        ELSE NEW.user_id 
    END);

    -- Lógica según la tabla que dispara el trigger
    IF (TG_TABLE_NAME = 'post_reactions') THEN
        -- Obtener autor del post y snippet del contenido
        SELECT author_id, LEFT(content, 30) INTO target_user_id, post_snippet FROM public.posts WHERE id = NEW.post_id;
        -- No notificar si el autor reacciona a su propio post
        IF (target_user_id = NEW.user_id) THEN RETURN NEW; END IF;

        -- Si la publicación es de hábito completado, personalizar el mensaje de ánimo
        IF post_snippet LIKE '🎯 [HABIT_COMPLETE]%' THEN
            INSERT INTO public.notifications (user_id, actor_id, type, message, link)
            VALUES (target_user_id, NEW.user_id, 'reaction', actor_name || ' te animó a seguir constante con tu hábito 💪', '#post-' || NEW.post_id);
        ELSE
            INSERT INTO public.notifications (user_id, actor_id, type, message, link)
            VALUES (target_user_id, NEW.user_id, 'reaction', actor_name || ' reaccionó a tu publicación: "' || post_snippet || '..."', '#post-' || NEW.post_id);
        END IF;

    ELSIF (TG_TABLE_NAME = 'comments') THEN
        -- Obtener autor del post y snippet del contenido
        SELECT author_id, LEFT(content, 30) INTO target_user_id, post_snippet FROM public.posts WHERE id = NEW.post_id;
        -- No notificar si el autor comenta su propio post
        IF (target_user_id = NEW.author_id) THEN RETURN NEW; END IF;

        INSERT INTO public.notifications (user_id, actor_id, type, message, link)
        VALUES (target_user_id, NEW.author_id, 'comment', actor_name || ' comentó en tu publicación: "' || post_snippet || '..."', '#post-' || NEW.post_id);

    ELSIF (TG_TABLE_NAME = 'community_join_requests') THEN
        -- Solo notificar si pasa a 'approved'
        IF (NEW.status = 'approved' AND OLD.status = 'pending') THEN
            SELECT name INTO comm_name FROM public.communities WHERE id = NEW.community_id;
            
            INSERT INTO public.notifications (user_id, type, message, link)
            VALUES (NEW.user_id, 'community_approved', '¡Te han aceptado en la comunidad ' || comm_name || '!', '/c/' || NEW.community_id);
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
