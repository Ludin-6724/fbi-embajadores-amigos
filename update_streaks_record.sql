-- Add max_streak column to store the historical record format
ALTER TABLE public.streaks 
ADD COLUMN IF NOT EXISTS max_streak integer DEFAULT 0;

-- Backfill data: set the record to their current streak if it's 0 (newly added column)
UPDATE public.streaks 
SET max_streak = streak_days 
WHERE max_streak = 0;
