-- 1. Crear tabla comment_reactions
CREATE TABLE public.comment_reactions (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    comment_id uuid NOT NULL,
    user_id uuid NOT NULL,
    reaction text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT comment_reactions_pkey PRIMARY KEY (id),
    CONSTRAINT comment_reactions_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
    CONSTRAINT comment_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

-- 2. Habilitar RLS
ALTER TABLE public.comment_reactions ENABLE ROW LEVEL SECURITY;

-- 3. Crear Políticas de Seguridad
CREATE POLICY "Permitir insertar a usuarios autenticados" ON public.comment_reactions
    FOR INSERT WITH CHECK ((auth.role() = 'authenticated'::text));

CREATE POLICY "Permitir leer reacciones a todos los usuarios" ON public.comment_reactions
    FOR SELECT USING (true);

CREATE POLICY "Permitir modificar y eliminar sus propias reacciones" ON public.comment_reactions
    FOR ALL USING ((auth.uid() = user_id));
