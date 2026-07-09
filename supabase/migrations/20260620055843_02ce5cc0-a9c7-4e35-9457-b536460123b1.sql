
CREATE TABLE IF NOT EXISTS public.admin_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  decided_by uuid REFERENCES auth.users(id),
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.admin_requests TO authenticated;
GRANT ALL ON public.admin_requests TO service_role;

ALTER TABLE public.admin_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users create own admin requests" ON public.admin_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own admin requests" ON public.admin_requests
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update admin requests" ON public.admin_requests
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.decide_admin_request(_id uuid, _approve boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  email_lower text;
  target uuid;
BEGIN
  IF uid IS NULL THEN RETURN false; END IF;
  SELECT lower(email) INTO email_lower FROM auth.users WHERE id = uid;
  IF email_lower <> 'nivishna689@gmail.com' THEN
    RAISE EXCEPTION 'Only the owner can decide admin requests';
  END IF;

  SELECT user_id INTO target FROM public.admin_requests WHERE id = _id;
  IF target IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;

  UPDATE public.admin_requests
    SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
        decided_by = uid, decided_at = now(), updated_at = now()
    WHERE id = _id;

  IF _approve THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (target, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.touch_admin_requests() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_admin_requests_updated ON public.admin_requests;
CREATE TRIGGER trg_admin_requests_updated BEFORE UPDATE ON public.admin_requests
FOR EACH ROW EXECUTE FUNCTION public.touch_admin_requests();
