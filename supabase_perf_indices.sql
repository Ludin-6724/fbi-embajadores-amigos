-- FBI Embajadores Performance Optimization - V2
-- Aplica esto en el SQL Editor de Supabase para lograr tiempos de carga de milisegundos.

-- 1. Índices Avanzados para 'posts'
-- Optimiza el Muro y Oratorio con filtrado por comunidad y anonimato + orden cronológico
CREATE INDEX IF NOT EXISTS idx_posts_query_composite 
ON public.posts (community_id, is_anonymous, created_at DESC);

-- Búsqueda rápida por autor para perfiles
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON public.posts (author_id);

-- 2. Índices para 'comments'
-- Carga instantánea de hilos de comentarios ordenados
CREATE INDEX IF NOT EXISTS idx_comments_post_thread 
ON public.comments (post_id, created_at DESC);

-- Búsqueda por autor de comentario
CREATE INDEX IF NOT EXISTS idx_comments_author_id ON public.comments (author_id);

-- 3. Índices para 'post_reactions' y 'comment_reactions'
-- Conteo ultra-rápido de reacciones por post y verificación de reacción del usuario
CREATE INDEX IF NOT EXISTS idx_post_reactions_lookup 
ON public.post_reactions (post_id, user_id, reaction);

CREATE INDEX IF NOT EXISTS idx_comment_reactions_lookup 
ON public.comment_reactions (comment_id, user_id, reaction);

-- 4. Índices para 'streaks' (Leaderboard)
-- Rankings nacionales y por comunidad instantáneos
CREATE INDEX IF NOT EXISTS idx_streaks_ranking 
ON public.streaks (community_id, streak_days DESC);

-- 5. Índices para 'notifications'
-- Centro de notificaciones ordenado por fecha para el usuario
CREATE INDEX IF NOT EXISTS idx_notifications_user_feed 
ON public.notifications (user_id, created_at DESC);

-- 6. Índices para 'profiles'
-- Búsqueda por ID y por nombre de usuario (para menciones o búsquedas)
CREATE INDEX IF NOT EXISTS idx_profiles_id ON public.profiles (id);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles (username);
