
-- Policies no storage.objects para o bucket 'evidencias'.
-- Convenção de path: {obra_id}/{pesagem_id}/{filename}
CREATE POLICY "Ver evidencias da obra (storage)" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'evidencias' AND public.tem_acesso_obra((storage.foldername(name))[1]::uuid));

CREATE POLICY "Enviar evidencias na obra (storage)" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'evidencias' AND public.tem_acesso_obra((storage.foldername(name))[1]::uuid));

CREATE POLICY "Apagar evidencias da obra (storage)" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'evidencias' AND public.tem_acesso_obra((storage.foldername(name))[1]::uuid));
