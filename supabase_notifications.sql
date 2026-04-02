/* ============================================================
   FBI Embajadores Amigos — Notifications System
   Ejecutar en: Supabase Dashboard > SQL Editor
   ============================================================ */

-- 1. Crear tabla de notificaciones
CREATE TABLE IF NOT EXISTS public.notifications (
  id          uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id     uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL, -- Destinatario
  actor_id    uuid REFERENCES public.profiles(id) ON DELETE CASCADE,          -- Quien genera la acción
  type        text NOT NULL, -- 'reaction', 'comment', 'community_approved'
  message     text NOT NULL,
  link        text,          -- URL para redirección
  is_read     boolean DEFAULT false,
  created_at  timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Habilitar RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can see their own notifications." ON public.notifications;
CREATE POLICY "Users can see their own notifications." ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications." ON public.notifications;
CREATE POLICY "Users can update their own notifications." ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- 3. Habilitar Realtime para la tabla
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
-- Asegúrate de habilitar 'Realtime' en el Dashboard de Supabase para esta tabla.

-- 4. Función para insertar notificaciones automáticamente
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
        -- Obtener autor del post
        SELECT author_id, LEFT(content, 30) INTO target_user_id, post_snippet FROM public.posts WHERE id = NEW.post_id;
        -- No notificar si el autor reacciona a su propio post
        IF (target_user_id = NEW.user_id) THEN RETURN NEW; END IF;

        INSERT INTO public.notifications (user_id, actor_id, type, message, link)
        VALUES (target_user_id, NEW.user_id, 'reaction', actor_name || ' reaccionó a tu publicación: "' || post_snippet || '..."', '#post-' || NEW.post_id);

    ELSIF (TG_TABLE_NAME = 'comments') THEN
        -- Obtener autor del post
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

-- 5. Crear Triggers
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
