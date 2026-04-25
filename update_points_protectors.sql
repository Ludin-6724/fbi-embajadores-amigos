-- Añadir columnas a profiles si no existen
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS points INT DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS streak_protectors INT DEFAULT 0;

-- RPC para otorgar puntos al usuario
CREATE OR REPLACE FUNCTION award_streak_points(user_id uuid, points_to_add int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles 
  SET points = COALESCE(points, 0) + points_to_add 
  WHERE id = user_id;
END;
$$;

-- RPC para comprar un protector
CREATE OR REPLACE FUNCTION purchase_protector(user_id uuid, cost int)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_points int;
BEGIN
  SELECT points INTO current_points FROM public.profiles WHERE id = user_id;
  
  IF current_points >= cost THEN
    UPDATE public.profiles 
    SET 
      points = current_points - cost,
      streak_protectors = COALESCE(streak_protectors, 0) + 1
    WHERE id = user_id;
    RETURN true;
  ELSE
    RETURN false;
  END IF;
END;
$$;

-- RPC para consumir un protector
CREATE OR REPLACE FUNCTION consume_protector(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_protectors int;
BEGIN
  SELECT streak_protectors INTO current_protectors FROM public.profiles WHERE id = user_id;
  
  IF current_protectors > 0 THEN
    UPDATE public.profiles 
    SET streak_protectors = current_protectors - 1
    WHERE id = user_id;
    RETURN true;
  ELSE
    RETURN false;
  END IF;
END;
$$;
