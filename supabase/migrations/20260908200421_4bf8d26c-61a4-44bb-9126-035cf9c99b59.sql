DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'sucata_docs_select'
  ) THEN
    CREATE POLICY "sucata_docs_select" ON storage.objects
      FOR SELECT TO authenticated
      USING (
        bucket_id = 'sucata-documentos'
        AND (
          public.has_role(auth.uid(), 'admin')
          OR public.has_role(auth.uid(), 'superadmin')
          OR public.has_role(auth.uid(), 'coordenador')
          OR public.has_role(auth.uid(), 'operador')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'sucata_docs_insert'
  ) THEN
    CREATE POLICY "sucata_docs_insert" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'sucata-documentos'
        AND (
          public.has_role(auth.uid(), 'admin')
          OR public.has_role(auth.uid(), 'superadmin')
          OR public.has_role(auth.uid(), 'operador')
        )
      );
  END IF;
END $$;