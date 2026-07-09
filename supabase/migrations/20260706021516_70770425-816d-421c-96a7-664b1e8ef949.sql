REVOKE EXECUTE ON FUNCTION public.claim_admin_if_allowed() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.decide_admin_request(uuid, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_admin_if_allowed() TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_admin_request(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;