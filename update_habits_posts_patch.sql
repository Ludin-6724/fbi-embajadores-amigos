/* ============================================================
   FBI Embajadores Amigos — Parche de Notificaciones de Hábitos
   Ejecutar en: Supabase Dashboard > SQL Editor
   ============================================================ */

-- 1. Actualizar la función trigger para soportar mensajes de ánimo de hábitos y notificaciones globales
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
    IF (TG_TABLE_NAME IN ('comments', 'posts') AND NEW.is_anonymous = true) THEN
        actor_name := 'Agente Anónimo';
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

-- 2. Asegurar que los triggers están activos
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

-- ============================================================
-- 3. SOLUCIÓN DEFINITIVA DE SEGURIDAD RLS PARA REACCIONES
-- ============================================================

-- 3.1 Asegurar que los valores del ENUM 'celebrate' y 'sad' existen
DO $$ 
BEGIN
    BEGIN
        ALTER TYPE public.reaction_type ADD VALUE 'celebrate';
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END;
    
    BEGIN
        ALTER TYPE public.reaction_type ADD VALUE 'sad';
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END;
END $$;

-- 3.2 Limpiar duplicados antiguos de post_reactions para evitar errores en la restricción UNIQUE
DELETE FROM public.post_reactions
WHERE id NOT IN (
  SELECT DISTINCT ON (post_id, user_id) id
  FROM public.post_reactions
  ORDER BY post_id, user_id, created_at DESC
);

-- 3.3 Asegurar la restricción de unicidad de 1 reacción por usuario por publicación
ALTER TABLE public.post_reactions DROP CONSTRAINT IF EXISTS post_reactions_post_id_user_id_reaction_key;
ALTER TABLE public.post_reactions DROP CONSTRAINT IF EXISTS post_reactions_post_id_user_id_key;
ALTER TABLE public.post_reactions ADD CONSTRAINT post_reactions_post_id_user_id_key UNIQUE(post_id, user_id);

-- 3.4 Habilitar RLS robusto en post_reactions
ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas conflictivas antiguas
DROP POLICY IF EXISTS "Reactions are viewable by everyone." ON public.post_reactions;
DROP POLICY IF EXISTS "Authenticated users can add reactions." ON public.post_reactions;
DROP POLICY IF EXISTS "Users can remove their own reactions." ON public.post_reactions;
DROP POLICY IF EXISTS "Users can update their own reactions." ON public.post_reactions;
DROP POLICY IF EXISTS "Los usuarios pueden reaccionar" ON public.post_reactions;
DROP POLICY IF EXISTS "Permitir lectura de reacciones" ON public.post_reactions;
DROP POLICY IF EXISTS "post_reactions_select" ON public.post_reactions;
DROP POLICY IF EXISTS "post_reactions_insert" ON public.post_reactions;
DROP POLICY IF EXISTS "post_reactions_update" ON public.post_reactions;
DROP POLICY IF EXISTS "post_reactions_delete" ON public.post_reactions;

-- Crear políticas explícitas y robustas para post_reactions
CREATE POLICY "post_reactions_select" ON public.post_reactions
  FOR SELECT USING (true);

CREATE POLICY "post_reactions_insert" ON public.post_reactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "post_reactions_update" ON public.post_reactions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "post_reactions_delete" ON public.post_reactions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Dar privilegios explícitos a roles
GRANT ALL ON TABLE public.post_reactions TO authenticated;
GRANT SELECT ON TABLE public.post_reactions TO anon;


-- 3.5 Limpiar duplicados antiguos de comment_reactions
DELETE FROM public.comment_reactions
WHERE id NOT IN (
  SELECT DISTINCT ON (comment_id, user_id) id
  FROM public.comment_reactions
  ORDER BY comment_id, user_id, created_at DESC
);

-- Asegurar la restricción de unicidad de 1 reacción por usuario por comentario
ALTER TABLE public.comment_reactions DROP CONSTRAINT IF EXISTS comment_reactions_comment_id_user_id_reaction_key;
ALTER TABLE public.comment_reactions DROP CONSTRAINT IF EXISTS comment_reactions_comment_id_user_id_key;
ALTER TABLE public.comment_reactions ADD CONSTRAINT comment_reactions_comment_id_user_id_key UNIQUE(comment_id, user_id);

-- Habilitar RLS en comment_reactions
ALTER TABLE public.comment_reactions ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas conflictivas antiguas
DROP POLICY IF EXISTS "Comment reactions viewable by everyone." ON public.comment_reactions;
DROP POLICY IF EXISTS "Authenticated users can add comment reactions." ON public.comment_reactions;
DROP POLICY IF EXISTS "Users can remove their own comment reactions." ON public.comment_reactions;
DROP POLICY IF EXISTS "Users can update their own comment reactions." ON public.comment_reactions;
DROP POLICY IF EXISTS "Los usuarios pueden reaccionar a comentarios" ON public.comment_reactions;
DROP POLICY IF EXISTS "Permitir lectura de reacciones de comentarios" ON public.comment_reactions;
DROP POLICY IF EXISTS "comment_reactions_select" ON public.comment_reactions;
DROP POLICY IF EXISTS "comment_reactions_insert" ON public.comment_reactions;
DROP POLICY IF EXISTS "comment_reactions_update" ON public.comment_reactions;
DROP POLICY IF EXISTS "comment_reactions_delete" ON public.comment_reactions;

-- Crear políticas explícitas y robustas para comment_reactions
CREATE POLICY "comment_reactions_select" ON public.comment_reactions
  FOR SELECT USING (true);

CREATE POLICY "comment_reactions_insert" ON public.comment_reactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "comment_reactions_update" ON public.comment_reactions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "comment_reactions_delete" ON public.comment_reactions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Dar privilegios explícitos a roles
GRANT ALL ON TABLE public.comment_reactions TO authenticated;
GRANT SELECT ON TABLE public.comment_reactions TO anon;
