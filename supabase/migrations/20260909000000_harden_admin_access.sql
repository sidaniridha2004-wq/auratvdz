-- Security hardening (2026-09-09)
--
-- 1. The admin password used to live in plain text inside migration files
--    (`admin_password_matches`). Anyone with the anon key could brute-force it
--    by calling the RPC. The function is removed; auth now happens only in the
--    server runtime against the ADMIN_PASSWORD environment variable.
-- 2. Anonymous roles no longer hold INSERT/UPDATE/DELETE on editable tables.
--    Admin writes go through the server with the service-role key after the
--    server has verified the operator's session.
-- 3. Public reads stay exactly as before.

-- Drop every policy that depended on the password RPC.
DROP POLICY IF EXISTS "Admin password can insert channels" ON public.channels;
DROP POLICY IF EXISTS "Admin password can update channels" ON public.channels;
DROP POLICY IF EXISTS "Admin password can delete custom channels" ON public.channels;
DROP POLICY IF EXISTS "Admin password can insert now_on_tv" ON public.now_on_tv;
DROP POLICY IF EXISTS "Admin password can update now_on_tv" ON public.now_on_tv;
DROP POLICY IF EXISTS "Admin password can delete now_on_tv" ON public.now_on_tv;

-- Remove the hard-coded password function entirely.
DROP FUNCTION IF EXISTS public.admin_password_matches(text);

-- Anonymous / authenticated users: read only.
REVOKE INSERT, UPDATE, DELETE ON public.channels FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.now_on_tv FROM anon, authenticated;

DO $$
BEGIN
  IF to_regclass('public.app_settings') IS NOT NULL THEN
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.app_settings FROM anon, authenticated';
    EXECUTE 'GRANT SELECT ON public.app_settings TO anon, authenticated';
    EXECUTE 'GRANT ALL ON public.app_settings TO service_role';
    EXECUTE 'ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Public can read app_settings" ON public.app_settings';
    EXECUTE 'CREATE POLICY "Public can read app_settings" ON public.app_settings FOR SELECT USING (true)';
  END IF;
END $$;

GRANT SELECT ON public.channels TO anon, authenticated;
GRANT SELECT ON public.now_on_tv TO anon, authenticated;
GRANT ALL ON public.channels TO service_role;
GRANT ALL ON public.now_on_tv TO service_role;

ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.now_on_tv ENABLE ROW LEVEL SECURITY;
