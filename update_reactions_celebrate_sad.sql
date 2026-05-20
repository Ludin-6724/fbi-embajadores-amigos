-- Añadir reacciones Felicidades (🎉) y Triste (😢)
-- Ejecutar en Supabase SQL Editor

ALTER TYPE public.reaction_type ADD VALUE IF NOT EXISTS 'celebrate';
ALTER TYPE public.reaction_type ADD VALUE IF NOT EXISTS 'sad';
