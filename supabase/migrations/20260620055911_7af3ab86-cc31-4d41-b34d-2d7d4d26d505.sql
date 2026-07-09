
REVOKE EXECUTE ON FUNCTION public.decide_admin_request(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_admin_request(uuid, boolean) TO authenticated;
