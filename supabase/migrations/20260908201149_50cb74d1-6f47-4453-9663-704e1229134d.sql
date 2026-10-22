DROP POLICY IF EXISTS "sucata_evid_obj_select" ON storage.objects;
CREATE POLICY "sucata_evid_obj_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'sucata-evidencias' AND public.sucata_pode_ler());

DROP POLICY IF EXISTS "sucata_evid_obj_insert" ON storage.objects;
CREATE POLICY "sucata_evid_obj_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'sucata-evidencias' AND public.sucata_pode_escrever());