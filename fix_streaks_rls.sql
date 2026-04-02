-- FBI Embajadores Amigos - FIX STREAKS RLS POLICIES
-- Ejecuta este script en el SQL EDITOR de Supabase

-- 1. Habilitar RLS (por si acaso no está activa)
ALTER TABLE public.streaks ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar políticas antiguas si existen para evitar conflictos
DROP POLICY IF EXISTS "Streaks are viewable by everyone." ON public.streaks;
DROP POLICY IF EXISTS "Authenticated users can create their own streak." ON public.streaks;
DROP POLICY IF EXISTS "Users can update their own streak." ON public.streaks;

-- 3. Crear política de SELECCIÓN (Ver)
CREATE POLICY "Streaks are viewable by everyone." ON public.streaks 
FOR SELECT USING (true);

-- 4. Crear política de INSERCIÓN (Crear)
-- Permite que un usuario autenticado inserte una racha para su propio ID
CREATE POLICY "Authenticated users can create their own streak." ON public.streaks 
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 5. Crear política de ACTUALIZACIÓN (Modificar)
-- Permite que un usuario autenticado actualice su propia racha
CREATE POLICY "Users can update their own streak." ON public.streaks 
FOR UPDATE USING (auth.uid() = user_id);

-- 6. Garantizar que profiles están bien configurados para Rachas Nacionales
DROP POLICY IF EXISTS "Profiles are viewable by everyone." ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone." ON public.profiles
FOR SELECT USING (true);
