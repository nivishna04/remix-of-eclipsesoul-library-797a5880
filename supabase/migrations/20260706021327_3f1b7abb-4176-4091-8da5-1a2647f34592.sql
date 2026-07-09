-- Restore Data API access for existing public tables used by the app.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_requests TO authenticated;
GRANT ALL ON public.admin_requests TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.books TO authenticated;
GRANT ALL ON public.books TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lost_books TO authenticated;
GRANT ALL ON public.lost_books TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reservations TO authenticated;
GRANT ALL ON public.reservations TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.seat_reservations TO authenticated;
GRANT ALL ON public.seat_reservations TO service_role;

GRANT SELECT ON public.seats TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seats TO authenticated;
GRANT ALL ON public.seats TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

-- Ensure the owner email is always an admin when the account already exists.
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE lower(email) = 'nivishna689@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Real seat reservation validation: valid time windows and no active overlap for the same seat.
CREATE OR REPLACE FUNCTION public.validate_seat_reservation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.end_time <= NEW.start_time THEN
    RAISE EXCEPTION 'Seat reservation end time must be after start time';
  END IF;

  IF NEW.status <> 'cancelled' AND EXISTS (
    SELECT 1
    FROM public.seat_reservations existing
    WHERE existing.seat_id = NEW.seat_id
      AND existing.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND existing.status <> 'cancelled'
      AND existing.start_time < NEW.end_time
      AND existing.end_time > NEW.start_time
  ) THEN
    RAISE EXCEPTION 'This seat is already reserved for that time window';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_seat_reservation_before_write ON public.seat_reservations;
CREATE TRIGGER validate_seat_reservation_before_write
BEFORE INSERT OR UPDATE ON public.seat_reservations
FOR EACH ROW
EXECUTE FUNCTION public.validate_seat_reservation();