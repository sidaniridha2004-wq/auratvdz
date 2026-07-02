CREATE TABLE public.now_on_tv (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_slug text NOT NULL,
  title text NOT NULL,
  subtitle text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.now_on_tv TO anon;
GRANT SELECT ON public.now_on_tv TO authenticated;
GRANT ALL ON public.now_on_tv TO service_role;

ALTER TABLE public.now_on_tv ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read now_on_tv"
  ON public.now_on_tv FOR SELECT
  USING (true);

CREATE TRIGGER now_on_tv_set_updated_at
  BEFORE UPDATE ON public.now_on_tv
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX now_on_tv_sort_idx ON public.now_on_tv (sort_order, created_at);