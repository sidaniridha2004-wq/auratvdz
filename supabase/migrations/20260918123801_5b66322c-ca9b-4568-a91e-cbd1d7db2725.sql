DROP POLICY IF EXISTS "Admin password can insert channels" ON public.channels;
DROP POLICY IF EXISTS "Admin password can update channels" ON public.channels;
DROP POLICY IF EXISTS "Admin password can delete custom channels" ON public.channels;
DROP POLICY IF EXISTS "Admin password can insert now_on_tv" ON public.now_on_tv;
DROP POLICY IF EXISTS "Admin password can update now_on_tv" ON public.now_on_tv;
DROP POLICY IF EXISTS "Admin password can delete now_on_tv" ON public.now_on_tv;

DROP FUNCTION IF EXISTS public.admin_password_matches(text);

REVOKE INSERT, UPDATE, DELETE ON public.channels FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.now_on_tv FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.app_settings FROM anon, authenticated;

GRANT SELECT ON public.channels TO anon, authenticated;
GRANT SELECT ON public.now_on_tv TO anon, authenticated;
GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT ALL ON public.channels TO service_role;
GRANT ALL ON public.now_on_tv TO service_role;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.now_on_tv ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read app_settings" ON public.app_settings;
CREATE POLICY "Public can read app_settings" ON public.app_settings FOR SELECT USING (true);