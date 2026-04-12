-- 1. Eliminar la restricción de tipo antigua que está causando el error
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- 2. (Opcional) Si quieres mantener una validación, puedes crear una nueva que incluya los nuevos tipos
-- ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check 
-- CHECK (type IN ('reaction', 'comment', 'reply', 'global_post', 'community_approved', 'cheer'));
