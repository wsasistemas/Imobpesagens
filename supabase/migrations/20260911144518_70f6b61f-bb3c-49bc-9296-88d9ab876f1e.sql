REVOKE ALL ON FUNCTION public.sucata_proteger_exclusao_logica_trg() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sucata_proteger_exclusao_logica_trg() FROM anon;
REVOKE ALL ON FUNCTION public.sucata_proteger_exclusao_logica_trg() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sucata_proteger_exclusao_logica_trg() TO service_role;