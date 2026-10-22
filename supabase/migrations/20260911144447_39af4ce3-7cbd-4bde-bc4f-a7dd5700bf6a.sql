ALTER TABLE public.sucata_processos
  ADD COLUMN IF NOT EXISTS excluido_em timestamptz,
  ADD COLUMN IF NOT EXISTS excluido_por uuid,
  ADD COLUMN IF NOT EXISTS exclusao_motivo text;

CREATE INDEX IF NOT EXISTS sucata_proc_excluido_em_idx
  ON public.sucata_processos (excluido_em)
  WHERE excluido_em IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sucata_proteger_exclusao_logica_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.excluido_em IS DISTINCT FROM OLD.excluido_em
     OR NEW.excluido_por IS DISTINCT FROM OLD.excluido_por
     OR NEW.exclusao_motivo IS DISTINCT FROM OLD.exclusao_motivo THEN
    IF auth.role() <> 'service_role'
       AND NOT public.has_role(auth.uid(), 'superadmin') THEN
      RAISE EXCEPTION 'Somente o SuperAdmin pode excluir um processo de sucata.';
    END IF;

    IF NEW.excluido_em IS NOT NULL THEN
      IF NEW.excluido_por IS NULL THEN
        RAISE EXCEPTION 'O responsável pela exclusão é obrigatório.';
      END IF;
      IF length(trim(COALESCE(NEW.exclusao_motivo, ''))) < 5 THEN
        RAISE EXCEPTION 'O motivo da exclusão deve ter ao menos 5 caracteres.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_sucata_proteger_exclusao_logica'
      AND tgrelid = 'public.sucata_processos'::regclass
  ) THEN
    CREATE TRIGGER trg_sucata_proteger_exclusao_logica
      BEFORE UPDATE OF excluido_em, excluido_por, exclusao_motivo
      ON public.sucata_processos
      FOR EACH ROW
      EXECUTE FUNCTION public.sucata_proteger_exclusao_logica_trg();
  END IF;
END;
$$;

ALTER POLICY "sucata_proc_select" ON public.sucata_processos
  USING (
    public.sucata_pode_ler()
    AND public.pode_ver_coligada(coligada_origem)
    AND (excluido_em IS NULL OR public.has_role(auth.uid(), 'superadmin'))
  );

ALTER POLICY "sucata_proc_update" ON public.sucata_processos
  USING (
    public.sucata_pode_escrever()
    AND public.pode_ver_coligada(coligada_origem)
    AND (excluido_em IS NULL OR public.has_role(auth.uid(), 'superadmin'))
  )
  WITH CHECK (
    public.sucata_pode_escrever()
    AND public.pode_ver_coligada(coligada_origem)
  );