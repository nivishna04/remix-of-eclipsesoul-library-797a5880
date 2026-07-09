REVOKE EXECUTE ON FUNCTION public.claim_admin_if_allowed() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.decide_admin_request(uuid, boolean) FROM authenticated;