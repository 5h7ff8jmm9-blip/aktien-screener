CREATE TABLE public.api_cache (
  key text PRIMARY KEY,
  payload jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.api_cache TO service_role;
ALTER TABLE public.api_cache ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.saved_screens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_screens TO authenticated;
GRANT ALL ON public.saved_screens TO service_role;
ALTER TABLE public.saved_screens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own screens select" ON public.saved_screens FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own screens insert" ON public.saved_screens FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own screens update" ON public.saved_screens FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own screens delete" ON public.saved_screens FOR DELETE TO authenticated USING (auth.uid() = user_id);
