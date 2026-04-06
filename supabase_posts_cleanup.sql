/* 
   FBI Embajadores Amigos - Post Cleanup Script
   Ejecutar en: Supabase Dashboard > SQL Editor
*/

-- 1. Create the cleanup function
CREATE OR REPLACE FUNCTION public.delete_old_posts()
RETURNS void AS $$
BEGIN
  DELETE FROM public.posts
  WHERE created_at < now() - interval '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. (Optional) Enable pg_cron and schedule the job
-- This requires the 'pg_cron' extension to be enabled in your Supabase project.
-- To enable it: Go to Dashboard > Database > Extensions > Search "pg_cron" > Enable.

/*
-- Uncomment the following block once pg_cron is enabled to schedule the job daily at midnight:

SELECT cron.schedule(
  'cleanup-old-posts',   -- name of the cron job
  '0 0 * * *',           -- cron schedule (every day at 00:00)
  'SELECT public.delete_old_posts()'
);
*/

-- 3. Verify the function exists:
-- SELECT public.delete_old_posts();
