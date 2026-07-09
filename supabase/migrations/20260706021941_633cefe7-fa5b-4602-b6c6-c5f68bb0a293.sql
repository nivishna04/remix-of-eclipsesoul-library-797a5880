DROP POLICY IF EXISTS "Logs admin read" ON public.activity_logs;
CREATE POLICY "Logs admin read" ON public.activity_logs
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins update admin requests" ON public.admin_requests;
CREATE POLICY "Admins update admin requests" ON public.admin_requests
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role))
WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role));

DROP POLICY IF EXISTS "Users view own admin requests" ON public.admin_requests;
CREATE POLICY "Users view own admin requests" ON public.admin_requests
FOR SELECT TO authenticated
USING (
  auth.uid() = user_id OR
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Books admin write" ON public.books;
CREATE POLICY "Books admin write" ON public.books
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role))
WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role));

DROP POLICY IF EXISTS "Lost admin delete" ON public.lost_books;
CREATE POLICY "Lost admin delete" ON public.lost_books
FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role));

DROP POLICY IF EXISTS "Lost admin update" ON public.lost_books;
CREATE POLICY "Lost admin update" ON public.lost_books
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role));

DROP POLICY IF EXISTS "Lost own or admin" ON public.lost_books;
CREATE POLICY "Lost own or admin" ON public.lost_books
FOR SELECT TO authenticated
USING (
  student_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Profiles select self" ON public.profiles;
CREATE POLICY "Profiles select self" ON public.profiles
FOR SELECT TO authenticated
USING (
  auth.uid() = id OR
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Reservations admin delete" ON public.reservations;
CREATE POLICY "Reservations admin delete" ON public.reservations
FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role));

DROP POLICY IF EXISTS "Reservations own or admin select" ON public.reservations;
CREATE POLICY "Reservations own or admin select" ON public.reservations
FOR SELECT TO authenticated
USING (
  student_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Reservations self cancel" ON public.reservations;
CREATE POLICY "Reservations self cancel" ON public.reservations
FOR UPDATE TO authenticated
USING (
  student_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Seat res own or admin" ON public.seat_reservations;
CREATE POLICY "Seat res own or admin" ON public.seat_reservations
FOR SELECT TO authenticated
USING (
  student_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Seat res self update" ON public.seat_reservations;
CREATE POLICY "Seat res self update" ON public.seat_reservations
FOR UPDATE TO authenticated
USING (
  student_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Seats admin write" ON public.seats;
CREATE POLICY "Seats admin write" ON public.seats
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role))
WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role));

DROP POLICY IF EXISTS "Tx admin write" ON public.transactions;
CREATE POLICY "Tx admin write" ON public.transactions
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role))
WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role));

DROP POLICY IF EXISTS "Tx own or admin" ON public.transactions;
CREATE POLICY "Tx own or admin" ON public.transactions
FOR SELECT TO authenticated
USING (
  student_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role)
);

DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Roles admin delete" ON public.user_roles;
DROP POLICY IF EXISTS "Roles admin insert" ON public.user_roles;
DROP POLICY IF EXISTS "Roles admin update" ON public.user_roles;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated;