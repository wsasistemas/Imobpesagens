GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tem_acesso_obra(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_recebimento(uuid, timestamp with time zone, timestamp with time zone) TO authenticated;