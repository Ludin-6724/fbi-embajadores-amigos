/* ============================================================
   FBI Embajadores Amigos — Prayer Notifications Update
   Ejecutar en: Supabase Dashboard > SQL Editor
   
   Este script actualiza la función de notificaciones para
   manejar peticiones de oración y refuerzos.
   ============================================================ */

-- Actualizar la función de notificaciones para detectar peticiones de oración y refuerzos
CREATE OR REPLACE FUNCTION public.handle_new_notification()
RETURNS TRIGGER AS $$
DECLARE
  target_user_id uuid;
  actor_name text;
  post_snippet text;
  comm_name text;
  actor_id_val uuid;
BEGIN
    -- Determinar el ID del actor según la tabla
    IF (TG_TABLE_NAME = 'post_reactions') THEN actor_id_val := NEW.user_id;
    ELSIF (TG_TABLE_NAME = 'comments') THEN actor_id_val := NEW.author_id;
    ELSIF (TG_TABLE_NAME = 'community_join_requests') THEN actor_id_val := NEW.user_id;
    ELSIF (TG_TABLE_NAME = 'posts') THEN actor_id_val := NEW.author_id;
    END IF;

    IF actor_id_val IS NULL THEN RETURN NEW; END IF;

    -- Obtener nombre del actor (quien realiza la acción)
    SELECT COALESCE(username, full_name, 'Un agente') INTO actor_name 
    FROM public.profiles WHERE id = actor_id_val;

    -- Anonimato
    IF (TG_TABLE_NAME = 'comments' OR TG_TABLE_NAME = 'posts') THEN
        IF (NEW.is_anonymous = true) THEN
            actor_name := 'Agente Anónimo';
        END IF;
    END IF;

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
        -- Si es una petición de oración
        ELSIF post_snippet LIKE '🙏 [PRAYER_REQUEST]%' THEN
            INSERT INTO public.notifications (user_id, actor_id, type, message, link)
            VALUES (target_user_id, NEW.user_id, 'reaction', actor_name || ' está orando por tu petición 🙏', '/post/' || NEW.post_id);
        -- Si es un refuerzo de oración
        ELSIF post_snippet LIKE '🆘 [PRAYER_REINFORCEM%' THEN
            INSERT INTO public.notifications (user_id, actor_id, type, message, link)
            VALUES (target_user_id, NEW.user_id, 'reaction', actor_name || ' está orando por tu refuerzo de oración 🙏', '/post/' || NEW.post_id);
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

    ELSIF (TG_TABLE_NAME = 'posts') THEN
        -- Cuando se publica un nuevo post global
        IF (NEW.community_id IS NULL) THEN
            IF (NEW.content LIKE '🎯 [HABIT_COMPLETE]%') THEN
                INSERT INTO public.notifications (user_id, actor_id, type, message, link)
                VALUES (NULL, NEW.author_id, 'global_post', actor_name || ' ha completado un hábito personal, ¡anímalo a seguir! 💪', '/post/' || NEW.id);
            -- Petición de oración: notificar a todos
            ELSIF (NEW.content LIKE '🙏 [PRAYER_REQUEST]%') THEN
                -- Solo notificar si NO es privada (verificar que no contiene "is_private":true)
                IF (NEW.content NOT LIKE '%"is_private":true%') THEN
                    INSERT INTO public.notifications (user_id, actor_id, type, message, link)
                    VALUES (NULL, NEW.author_id, 'global_post', actor_name || ' ha publicado una petición de oración 🙏 Ora por este agente.', '/post/' || NEW.id);
                END IF;
            -- Refuerzo de oración: notificación URGENTE global
            ELSIF (NEW.content LIKE '🆘 [PRAYER_REINFORCEMENT]%') THEN
                IF (NEW.content NOT LIKE '%"is_private":true%') THEN
                    INSERT INTO public.notifications (user_id, actor_id, type, message, link)
                    VALUES (NULL, NEW.author_id, 'global_post', '🆘 ' || actor_name || ' necesita refuerzo en oración. ¡Acude al llamado!', '/post/' || NEW.id);
                END IF;
            ELSE
                INSERT INTO public.notifications (user_id, actor_id, type, message, link)
                VALUES (NULL, NEW.author_id, 'global_post', actor_name || ' ha publicado algo en el Muro.', '/post/' || NEW.id);
            END IF;
        END IF;

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

-- Los triggers existentes ya están creados y apuntan a esta función,
-- así que no necesitamos recrearlos. Solo con actualizar la función es suficiente.
