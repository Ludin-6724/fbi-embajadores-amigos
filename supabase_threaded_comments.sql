/* FBI Embajadores Amigos - Threaded Comments Migration */

-- 1. Agregar columna parent_id para hilos de comentarios
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.comments(id) ON DELETE CASCADE;

-- 2. Crear índice para mejorar consultas de hilos
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON public.comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON public.comments(post_id);

-- 3. Actualizar políticas RLS (opcional, pero buena práctica si se desea restringir algo más)
-- Las políticas existentes ya cubren INSERT y SELECT, pero parent_id es solo un campo más.

COMMENT ON COLUMN public.comments.parent_id IS 'Permite responder a un comentario específico para crear conversaciones en hilo.';
