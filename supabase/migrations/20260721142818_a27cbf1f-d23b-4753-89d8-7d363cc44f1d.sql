
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tem_acesso_obra(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_calper_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.dashboard_recebimento(uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_recebimento(uuid, timestamptz, timestamptz) TO authenticated;
