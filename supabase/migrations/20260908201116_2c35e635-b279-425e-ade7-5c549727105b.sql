REVOKE ALL ON FUNCTION public.sucata_posicao_faltante_bloco_a(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sucata_valida_bruto_trg() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sucata_posicao_faltante_bloco_a(uuid) TO service_role;