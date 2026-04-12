ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS is_anonymous boolean DEFAULT false;
