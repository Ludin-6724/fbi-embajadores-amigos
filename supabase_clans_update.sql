/* FBI Embajadores Amigos - CLANS & SUB-COMMUNITIES UPDATE */

-- 1. Añadir el concepto de "Sede / Tribu" (community_id) a los POSTS
-- Si el community_id es NULL, entonces el post pertenece a la "Red Global Nacional".
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS community_id uuid REFERENCES public.communities(id) ON DELETE CASCADE;

-- 2. Añadir el concepto de "Sede / Tribu" a las RACHAS (streaks)
ALTER TABLE public.streaks ADD COLUMN IF NOT EXISTS community_id uuid REFERENCES public.communities(id) ON DELETE CASCADE;

-- 3. Modificamos la restricción de unicidad para las RACHAS
-- Actualmente una persona solo puede tener UNA racha en toda la BD.
-- Retiramos la restricción antigua (si existe) utilizando bloque condicional anónimo.
DO $$ 
BEGIN
  -- Intenta dar de baja las restricciones de clave primaria/unika previas
  -- El nombre tipico de la restriccion de supabase es streaks_user_id_key o similar.
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'streaks_user_id_key') THEN
    ALTER TABLE public.streaks DROP CONSTRAINT streaks_user_id_key;
  END IF;
  
  -- Para RLS, la primary key de auth.users on conflict puede generar error, 
  -- por lo que supabase pudo forzar la primary id a ser el user_id. 
  -- Si 'user_id' era la Primary Key, necesitará un rediseño de Primary Key,
  -- pero supongamos que el ID de la racha es el "id" original.
END $$;

-- En caso de que haya una restriccion uniqueness invisible en Supabase:
-- Nos aseguramos indexando con indices parciales
DROP INDEX IF EXISTS unique_global_streak;
DROP INDEX IF EXISTS unique_comm_streak;

CREATE UNIQUE INDEX unique_global_streak ON public.streaks (user_id) WHERE community_id IS NULL;
CREATE UNIQUE INDEX unique_comm_streak ON public.streaks (user_id, community_id) WHERE community_id IS NOT NULL;

-- Nota: Para que UPSERT funcione, necesitamos crear explícitamente un constraint único por grupo:
-- PERO Postgres 14 no permite UPSERT en UNIQUE INDEX parciales con facilidad. 
-- Por la vía más limpia: se agregará la lógica lógica en el FRONTEND en Rachas.tsx para 
-- obtener el UUID del streak (si existe) y luego UPSERT vía ID unificado, o manual match.

-- Vamos a forzar un constraint UNICO natural con coalesce:
ALTER TABLE public.streaks ADD COLUMN IF NOT EXISTS coalesce_community_id uuid GENERATED ALWAYS AS (COALESCE(community_id, '00000000-0000-0000-0000-000000000000'::uuid)) STORED;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'streaks_userid_community_unique') THEN
    ALTER TABLE public.streaks ADD CONSTRAINT streaks_userid_community_unique UNIQUE(user_id, coalesce_community_id);
  END IF;
END $$;
