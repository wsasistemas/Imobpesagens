-- ============ Fase 4: conferência da obra e Nota Fiscal Avulsa (aditivo) ============

-- 1) Contas bancárias cadastradas da obra
CREATE TABLE IF NOT EXISTS public.sucata_contas_obra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.obras(id),
  coligada_origem text NOT NULL,
  banco text NOT NULL,
  agencia text NOT NULL,
  conta text NOT NULL,
  tipo_conta text NOT NULL DEFAULT 'Corrente',
  titular text NOT NULL,
  titular_documento text,
  chave_pix text,
  situacao text NOT NULL DEFAULT 'ATIVA' CHECK (situacao IN ('ATIVA','INATIVA')),
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.sucata_contas_obra TO authenticated;
GRANT ALL ON public.sucata_contas_obra TO service_role;

ALTER TABLE public.sucata_contas_obra ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contas_obra_select" ON public.sucata_contas_obra;
CREATE POLICY "contas_obra_select" ON public.sucata_contas_obra
  FOR SELECT TO authenticated
  USING (public.sucata_pode_ler() AND public.pode_ver_coligada(coligada_origem));

DROP POLICY IF EXISTS "contas_obra_insert" ON public.sucata_contas_obra;
CREATE POLICY "contas_obra_insert" ON public.sucata_contas_obra
  FOR INSERT TO authenticated
  WITH CHECK (public.sucata_pode_escrever() AND public.pode_ver_coligada(coligada_origem));

DROP POLICY IF EXISTS "contas_obra_update" ON public.sucata_contas_obra;
CREATE POLICY "contas_obra_update" ON public.sucata_contas_obra
  FOR UPDATE TO authenticated
  USING (public.sucata_pode_escrever() AND public.pode_ver_coligada(coligada_origem))
  WITH CHECK (public.sucata_pode_escrever() AND public.pode_ver_coligada(coligada_origem));

CREATE INDEX IF NOT EXISTS idx_sucata_contas_obra_obra ON public.sucata_contas_obra (obra_id, situacao);
CREATE INDEX IF NOT EXISTS idx_sucata_contas_obra_coligada ON public.sucata_contas_obra (coligada_origem);

DROP TRIGGER IF EXISTS trg_sucata_contas_obra_updated ON public.sucata_contas_obra;
CREATE TRIGGER trg_sucata_contas_obra_updated
  BEFORE UPDATE ON public.sucata_contas_obra
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Colunas do processo (todas anuláveis)
ALTER TABLE public.sucata_processos
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz,
  ADD COLUMN IF NOT EXISTS aprovado_por uuid,
  ADD COLUMN IF NOT EXISTS aprovacao_observacao text,
  ADD COLUMN IF NOT EXISTS devolvido_em timestamptz,
  ADD COLUMN IF NOT EXISTS devolvido_por uuid,
  ADD COLUMN IF NOT EXISTS devolucao_motivo text,
  ADD COLUMN IF NOT EXISTS devolucao_fase_origem text,
  ADD COLUMN IF NOT EXISTS conta_obra_id uuid REFERENCES public.sucata_contas_obra(id),
  ADD COLUMN IF NOT EXISTS pagamento_valor numeric(12,2),
  ADD COLUMN IF NOT EXISTS pagamento_data date,
  ADD COLUMN IF NOT EXISTS pagamento_conta_divergente boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pagamento_justificativa text,
  ADD COLUMN IF NOT EXISTS pagamento_comprovante_hash text,
  ADD COLUMN IF NOT EXISTS pagamento_conta_lida text,
  ADD COLUMN IF NOT EXISTS recibo_valor_lido numeric(12,2),
  ADD COLUMN IF NOT EXISTS nfa_numero text,
  ADD COLUMN IF NOT EXISTS nfa_emissao date,
  ADD COLUMN IF NOT EXISTS nfa_storage_path text,
  ADD COLUMN IF NOT EXISTS nfa_enviada_em timestamptz,
  ADD COLUMN IF NOT EXISTS nfa_impedimento_motivo text,
  ADD COLUMN IF NOT EXISTS nfa_solicitada_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_sucata_processos_comprovante_hash
  ON public.sucata_processos (pagamento_comprovante_hash)
  WHERE pagamento_comprovante_hash IS NOT NULL;

-- 3) Fases: ampliar a trilha permitida até o encerramento (F01..F15)
ALTER TABLE public.sucata_processos DROP CONSTRAINT IF EXISTS sucata_processos_fase_check;
ALTER TABLE public.sucata_processos
  ADD CONSTRAINT sucata_processos_fase_check CHECK (fase = ANY (ARRAY[
    'F01','F02','F03','F04','F05','F06','F07','F08','F09','F10','F11','F12','F13','F14','F15'
  ]));

-- 4) Parâmetros novos
INSERT INTO public.sucata_parametros (chave, valor, descricao)
VALUES
  ('contabilidade_emails', '', 'E-mails da Contabilidade que recebem a solicitação de Nota Fiscal Avulsa (separados por vírgula).'),
  ('aviso_fiscal_pf', 'Sucateiro pessoa física: confira o tratamento fiscal aplicável antes de emitir a Nota Fiscal Avulsa.', 'Texto exibido na tela de emissão quando o comprador é pessoa física.')
ON CONFLICT (chave) DO NOTHING;

-- 5) Trava: NFA só depois da aprovação da obra
CREATE OR REPLACE FUNCTION public.sucata_nfa_exige_aprovacao_trg()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.aprovado_em IS NULL AND (
       (NEW.nfa_solicitada_em IS NOT NULL AND NEW.nfa_solicitada_em IS DISTINCT FROM OLD.nfa_solicitada_em)
    OR (NEW.nfa_numero IS NOT NULL AND NEW.nfa_numero IS DISTINCT FROM OLD.nfa_numero)
    OR (NEW.nfa_emissao IS NOT NULL AND NEW.nfa_emissao IS DISTINCT FROM OLD.nfa_emissao)
    OR (NEW.nfa_storage_path IS NOT NULL AND NEW.nfa_storage_path IS DISTINCT FROM OLD.nfa_storage_path)
    OR (NEW.nfa_enviada_em IS NOT NULL AND NEW.nfa_enviada_em IS DISTINCT FROM OLD.nfa_enviada_em)
  ) THEN
    RAISE EXCEPTION 'A Nota Fiscal Avulsa depende da aprovacao do administrativo da obra.';
  END IF;

  IF NEW.aprovado_em IS NOT NULL AND OLD.aprovado_em IS NULL THEN
    IF NEW.aceite_em IS NULL OR NEW.valor_total IS NULL THEN
      RAISE EXCEPTION 'Aprovacao exige aceite do peso e valor informado pelo sucateiro.';
    END IF;
    IF COALESCE(NEW.pagamento_conta_divergente, false)
       AND COALESCE(btrim(NEW.pagamento_justificativa), '') = '' THEN
      RAISE EXCEPTION 'Conta creditada fora do cadastro da obra exige justificativa para aprovar.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sucata_nfa_exige_aprovacao ON public.sucata_processos;
CREATE TRIGGER trg_sucata_nfa_exige_aprovacao
  BEFORE UPDATE ON public.sucata_processos
  FOR EACH ROW EXECUTE FUNCTION public.sucata_nfa_exige_aprovacao_trg();

REVOKE ALL ON FUNCTION public.sucata_nfa_exige_aprovacao_trg() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sucata_nfa_exige_aprovacao_trg() FROM authenticated;
REVOKE ALL ON FUNCTION public.sucata_nfa_exige_aprovacao_trg() FROM anon;