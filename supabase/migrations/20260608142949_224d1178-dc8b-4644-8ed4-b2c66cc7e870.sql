CREATE OR REPLACE FUNCTION public.disputes_validate_reason()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v text;
  word_count int;
BEGIN
  v := COALESCE(trim(NEW.reason), '');
  IF length(v) < 10 THEN
    RAISE EXCEPTION 'Dispute reason must be at least 10 characters';
  END IF;
  IF v !~* '[aeiou]' THEN
    RAISE EXCEPTION 'Dispute reason appears invalid';
  END IF;
  IF v ~ '(.)\1{3,}' THEN
    RAISE EXCEPTION 'Dispute reason appears invalid';
  END IF;
  word_count := array_length(regexp_split_to_array(v, '\s+'), 1);
  IF word_count IS NULL OR word_count < 2 THEN
    RAISE EXCEPTION 'Dispute reason must contain at least two words';
  END IF;
  RETURN NEW;
END;
$function$;
