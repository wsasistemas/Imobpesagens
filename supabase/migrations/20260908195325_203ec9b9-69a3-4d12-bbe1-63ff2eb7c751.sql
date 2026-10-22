REVOKE ALL ON FUNCTION public.sucata_proximo_numero(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sucata_processos_numero_trg() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sucata_pode_escrever() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sucata_pode_ler() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sucata_pode_escrever() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sucata_pode_ler() TO authenticated;