ALTER TABLE public.sucata_processos
  ADD COLUMN IF NOT EXISTS concluido_em timestamptz,
  ADD COLUMN IF NOT EXISTS concluido_por uuid,
  ADD COLUMN IF NOT EXISTS relatorio_versao integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reaberto_em timestamptz,
  ADD COLUMN IF NOT EXISTS reaberto_por uuid,
  ADD COLUMN IF NOT EXISTS reabertura_motivo text;

CREATE TABLE IF NOT EXISTS public.sucata_relatorios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid NOT NULL REFERENCES public.sucata_processos(id),
  versao integer NOT NULL,
  storage_path text NOT NULL,
  gerado_em timestamptz NOT NULL DEFAULT now(),
  gerado_por uuid,
  enviado_para jsonb NOT NULL DEFAULT '[]'::jsonb,
  enviado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sucata_relatorios_processo_versao_uidx
  ON public.sucata_relatorios (processo_id, versao);

GRANT SELECT, INSERT, UPDATE ON public.sucata_relatorios TO authenticated;
GRANT ALL ON public.sucata_relatorios TO service_role;
ALTER TABLE public.sucata_relatorios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sucata_relatorios_select" ON public.sucata_relatorios;
CREATE POLICY "sucata_relatorios_select" ON public.sucata_relatorios
  FOR SELECT TO authenticated
  USING (
    public.sucata_pode_ler()
    AND EXISTS (
      SELECT 1 FROM public.sucata_processos p
      WHERE p.id = sucata_relatorios.processo_id
        AND public.pode_ver_coligada(p.coligada_origem)
    )
  );

DROP POLICY IF EXISTS "sucata_relatorios_insert" ON public.sucata_relatorios;
CREATE POLICY "sucata_relatorios_insert" ON public.sucata_relatorios
  FOR INSERT TO authenticated
  WITH CHECK (
    public.sucata_pode_escrever()
    AND EXISTS (
      SELECT 1 FROM public.sucata_processos p
      WHERE p.id = sucata_relatorios.processo_id
        AND public.pode_ver_coligada(p.coligada_origem)
    )
  );

DROP POLICY IF EXISTS "sucata_relatorios_update" ON public.sucata_relatorios;
CREATE POLICY "sucata_relatorios_update" ON public.sucata_relatorios
  FOR UPDATE TO authenticated
  USING (
    public.sucata_pode_escrever()
    AND EXISTS (
      SELECT 1 FROM public.sucata_processos p
      WHERE p.id = sucata_relatorios.processo_id
        AND public.pode_ver_coligada(p.coligada_origem)
    )
  );

DROP TRIGGER IF EXISTS trg_sucata_relatorios_updated ON public.sucata_relatorios;
CREATE TRIGGER trg_sucata_relatorios_updated BEFORE UPDATE ON public.sucata_relatorios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.sucata_destinatarios_relatorio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coligada text NOT NULL,
  nome text NOT NULL,
  email text NOT NULL,
  papel text,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sucata_dest_rel_coligada_email_uidx
  ON public.sucata_destinatarios_relatorio (coligada, lower(email));

GRANT SELECT, INSERT, UPDATE ON public.sucata_destinatarios_relatorio TO authenticated;
GRANT ALL ON public.sucata_destinatarios_relatorio TO service_role;
ALTER TABLE public.sucata_destinatarios_relatorio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sucata_dest_rel_select" ON public.sucata_destinatarios_relatorio;
CREATE POLICY "sucata_dest_rel_select" ON public.sucata_destinatarios_relatorio
  FOR SELECT TO authenticated
  USING (public.sucata_pode_ler() AND public.pode_ver_coligada(coligada));

DROP POLICY IF EXISTS "sucata_dest_rel_insert" ON public.sucata_destinatarios_relatorio;
CREATE POLICY "sucata_dest_rel_insert" ON public.sucata_destinatarios_relatorio
  FOR INSERT TO authenticated
  WITH CHECK (public.sucata_pode_escrever() AND public.pode_ver_coligada(coligada));

DROP POLICY IF EXISTS "sucata_dest_rel_update" ON public.sucata_destinatarios_relatorio;
CREATE POLICY "sucata_dest_rel_update" ON public.sucata_destinatarios_relatorio
  FOR UPDATE TO authenticated
  USING (public.sucata_pode_escrever() AND public.pode_ver_coligada(coligada));

DROP TRIGGER IF EXISTS trg_sucata_dest_rel_updated ON public.sucata_destinatarios_relatorio;
CREATE TRIGGER trg_sucata_dest_rel_updated BEFORE UPDATE ON public.sucata_destinatarios_relatorio
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Conclusão exige as 12 evidências vigentes; processo concluído é somente leitura (reabertura só TI).
CREATE OR REPLACE FUNCTION public.sucata_encerramento_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE faltam integer;
BEGIN
  IF NEW.concluido_em IS NOT NULL AND OLD.concluido_em IS NULL THEN
    SELECT 12 - count(*) INTO faltam
    FROM public.sucata_evidencias e
    WHERE e.processo_id = NEW.id AND e.substituida_por IS NULL;
    IF faltam > 0 THEN
      RAISE EXCEPTION 'Sequencia fotografica incompleta: faltam % evidencias para encerrar.', faltam;
    END IF;
  END IF;

  IF OLD.situacao = 'CONCLUIDO' THEN
    IF NEW.reaberto_em IS DISTINCT FROM OLD.reaberto_em THEN
      IF NOT public.has_role(auth.uid(), 'superadmin') THEN
        RAISE EXCEPTION 'Reabertura de processo concluido e exclusiva do perfil TI.';
      END IF;
      IF coalesce(btrim(NEW.reabertura_motivo), '') = '' THEN
        RAISE EXCEPTION 'Reabertura exige motivo.';
      END IF;
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Processo concluido e somente leitura. Reabertura somente pela TI.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sucata_encerramento ON public.sucata_processos;
CREATE TRIGGER trg_sucata_encerramento BEFORE UPDATE ON public.sucata_processos
  FOR EACH ROW EXECUTE FUNCTION public.sucata_encerramento_trg();

-- Bloqueia novas evidências em processo concluído.
CREATE OR REPLACE FUNCTION public.sucata_evidencia_processo_aberto_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.sucata_processos p
    WHERE p.id = NEW.processo_id AND p.situacao = 'CONCLUIDO'
  ) THEN
    RAISE EXCEPTION 'Processo concluido: nao e possivel incluir ou alterar evidencias.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sucata_evidencia_processo_aberto ON public.sucata_evidencias;
CREATE TRIGGER trg_sucata_evidencia_processo_aberto BEFORE INSERT OR UPDATE ON public.sucata_evidencias
  FOR EACH ROW EXECUTE FUNCTION public.sucata_evidencia_processo_aberto_trg();