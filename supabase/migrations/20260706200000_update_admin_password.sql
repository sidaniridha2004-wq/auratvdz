CREATE OR REPLACE FUNCTION public.admin_password_matches(_password text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT _password = 'mermita2020';
$$;
