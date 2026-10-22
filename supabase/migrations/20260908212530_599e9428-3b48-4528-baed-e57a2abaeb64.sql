DROP POLICY IF EXISTS "sucata_relatorios_leitura" ON storage.objects;
CREATE POLICY "sucata_relatorios_leitura" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'sucata-relatorios' AND public.sucata_pode_ler());