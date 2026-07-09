
-- 1. Profiles: restrict SELECT to self + admin
DROP POLICY IF EXISTS "Profiles select own or admin" ON public.profiles;
CREATE POLICY "Profiles select self"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

-- 2. user_roles: only admins can write; users still read their own
CREATE POLICY "Roles admin insert"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Roles admin update"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Roles admin delete"
  ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. handle_new_user: never auto-grant admin from metadata; allow-list only
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  assigned_role public.app_role := 'student';
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  IF lower(NEW.email) = 'nivishna689@gmail.com' THEN
    assigned_role := 'admin';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role);
  RETURN NEW;
END;
$$;

-- Ensure the trigger is wired (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Self-service claim for the allow-listed admin email
CREATE OR REPLACE FUNCTION public.claim_admin_if_allowed()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  email_lower text;
BEGIN
  IF uid IS NULL THEN RETURN false; END IF;
  SELECT lower(email) INTO email_lower FROM auth.users WHERE id = uid;
  IF email_lower <> 'nivishna689@gmail.com' THEN RETURN false; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION public.claim_admin_if_allowed() TO authenticated;

-- 5. activity_logs: forbid update/delete for everyone (no permissive policies = denied,
--    but add explicit restrictive ones to satisfy auditors)
CREATE POLICY "Logs no update"
  ON public.activity_logs AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY "Logs no delete"
  ON public.activity_logs AS RESTRICTIVE FOR DELETE TO authenticated
  USING (false);

-- 6. lost_books: add delete restriction (admin only)
CREATE POLICY "Lost admin delete"
  ON public.lost_books FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
