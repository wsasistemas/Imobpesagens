-- FASE 3 — aceite do peso, valor e recibo pelo sucateiro (aditivo)

ALTER TABLE public.sucata_processos
  ADD COLUMN IF NOT EXISTS aceite_token_hash text,
  ADD COLUMN IF NOT EXISTS aceite_token_expira_em timestamptz,
  ADD COLUMN IF NOT EXISTS aceite_em timestamptz,
  ADD COLUMN IF NOT EXISTS aceite_ip inet,
  ADD COLUMN IF NOT EXISTS aceite_email text,
  ADD COLUMN IF NOT EXISTS contestacao_em timestamptz,
  ADD COLUMN IF NOT EXISTS contestacao_motivo text,
  ADD COLUMN IF NOT EXISTS valor_total numeric(12,2),
  ADD COLUMN IF NOT EXISTS recibo_modo text,
  ADD COLUMN IF NOT EXISTS notificado_em timestamptz,
  ADD COLUMN IF NOT EXISTS reenvio_em timestamptz,
  ADD COLUMN IF NOT EXISTS alerta_admin_em timestamptz;

DO $$ BEGIN
  ALTER TABLE public.sucata_processos
    ADD CONSTRAINT sucata_processos_recibo_modo_chk
    CHECK (recibo_modo IS NULL OR recibo_modo IN ('SISTEMA','PROPRIO'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Valor por tonelada é sempre calculado pelo banco (a partir de bruto - tara,
-- pois o Postgres não permite gerar coluna a partir de outra coluna gerada).
ALTER TABLE public.sucata_processos
  ADD COLUMN IF NOT EXISTS valor_por_tonelada numeric(12,2)
  GENERATED ALWAYS AS (
    CASE WHEN valor_total IS NOT NULL AND (bruto_kg - tara_kg) > 0
      THEN round(valor_total / ((bruto_kg - tara_kg) / 1000.0), 2)
      ELSE NULL END
  ) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS sucata_processos_aceite_token_hash_uidx
  ON public.sucata_processos (aceite_token_hash)
  WHERE aceite_token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS sucata_processos_aceite_pendente_idx
  ON public.sucata_processos (notificado_em)
  WHERE aceite_em IS NULL AND aceite_token_hash IS NOT NULL;

-- Faixa de referência do valor por tonelada, por tipo de sucata
ALTER TABLE public.sucata_tipos
  ADD COLUMN IF NOT EXISTS valor_ton_min numeric(12,2),
  ADD COLUMN IF NOT EXISTS valor_ton_max numeric(12,2);

-- Notificações enviadas
CREATE TABLE IF NOT EXISTS public.sucata_notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid NOT NULL REFERENCES public.sucata_processos(id),
  tipo text NOT NULL CHECK (tipo IN ('ACEITE_PESO','REENVIO_ACEITE','CONTESTACAO_ADMIN','ALERTA_SEM_RESPOSTA','SOLICITACAO_NFA','ENVIO_NFA')),
  destinatario text NOT NULL,
  assunto text NOT NULL,
  status text NOT NULL DEFAULT 'ENFILEIRADA' CHECK (status IN ('ENFILEIRADA','ENVIADA','FALHA')),
  provider_message_id text,
  erro text,
  enviada_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sucata_notificacoes TO authenticated;
GRANT ALL ON public.sucata_notificacoes TO service_role;
ALTER TABLE public.sucata_notificacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sucata_notificacoes_select" ON public.sucata_notificacoes;
CREATE POLICY "sucata_notificacoes_select" ON public.sucata_notificacoes
  FOR SELECT TO authenticated
  USING (
    public.sucata_pode_ler()
    AND EXISTS (
      SELECT 1 FROM public.sucata_processos p
      WHERE p.id = sucata_notificacoes.processo_id
        AND public.pode_ver_coligada(p.coligada_origem)
    )
  );

CREATE INDEX IF NOT EXISTS sucata_notificacoes_processo_idx
  ON public.sucata_notificacoes (processo_id, created_at DESC);

-- Parâmetros do módulo (prazos nunca fixos no código)
CREATE TABLE IF NOT EXISTS public.sucata_parametros (
  chave text PRIMARY KEY,
  valor text NOT NULL,
  descricao text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sucata_parametros TO authenticated;
GRANT INSERT, UPDATE ON public.sucata_parametros TO authenticated;
GRANT ALL ON public.sucata_parametros TO service_role;
ALTER TABLE public.sucata_parametros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sucata_parametros_select" ON public.sucata_parametros;
CREATE POLICY "sucata_parametros_select" ON public.sucata_parametros
  FOR SELECT TO authenticated USING (public.sucata_pode_ler());

DROP POLICY IF EXISTS "sucata_parametros_insert" ON public.sucata_parametros;
CREATE POLICY "sucata_parametros_insert" ON public.sucata_parametros
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'));

DROP POLICY IF EXISTS "sucata_parametros_update" ON public.sucata_parametros;
CREATE POLICY "sucata_parametros_update" ON public.sucata_parametros
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'));

DROP TRIGGER IF EXISTS trg_sucata_parametros_updated ON public.sucata_parametros;
CREATE TRIGGER trg_sucata_parametros_updated BEFORE UPDATE ON public.sucata_parametros
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.sucata_parametros (chave, valor, descricao) VALUES
  ('reenvio_horas', '48', 'Horas sem resposta do sucateiro para reenviar o e-mail de aceite'),
  ('alerta_admin_dias', '5', 'Dias sem resposta do sucateiro para alertar o administrativo da obra'),
  ('token_validade_dias', '7', 'Validade do link de aceite, em dias')
ON CONFLICT (chave) DO NOTHING;

-- Imutabilidade dos pesos após o aceite (exceção: superadmin, com evento de reabertura)
CREATE OR REPLACE FUNCTION public.sucata_pesos_imutaveis_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.aceite_em IS NOT NULL
     AND (NEW.tara_kg IS DISTINCT FROM OLD.tara_kg OR NEW.bruto_kg IS DISTINCT FROM OLD.bruto_kg)
  THEN
    IF NOT public.has_role(auth.uid(), 'superadmin') THEN
      RAISE EXCEPTION 'Pesos bloqueados: o sucateiro já aceitou o peso aferido deste processo. Reabertura somente pela TI.';
    END IF;
  END IF;
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.sucata_pesos_imutaveis_trg() FROM public;
REVOKE EXECUTE ON FUNCTION public.sucata_pesos_imutaveis_trg() FROM anon;
REVOKE EXECUTE ON FUNCTION public.sucata_pesos_imutaveis_trg() FROM authenticated;

DROP TRIGGER IF EXISTS trg_sucata_pesos_imutaveis ON public.sucata_processos;
CREATE TRIGGER trg_sucata_pesos_imutaveis BEFORE UPDATE ON public.sucata_processos
  FOR EACH ROW EXECUTE FUNCTION public.sucata_pesos_imutaveis_trg();

-- Valor da coleta e modo do recibo: só pelo portal externo (chave de serviço)
CREATE OR REPLACE FUNCTION public.sucata_valor_somente_portal_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.valor_total IS DISTINCT FROM OLD.valor_total
      OR NEW.recibo_modo IS DISTINCT FROM OLD.recibo_modo)
     AND coalesce(auth.role(), '') <> 'service_role'
  THEN
    RAISE EXCEPTION 'O valor da coleta é informado somente pelo sucateiro, no portal externo.';
  END IF;
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.sucata_valor_somente_portal_trg() FROM public;
REVOKE EXECUTE ON FUNCTION public.sucata_valor_somente_portal_trg() FROM anon;
REVOKE EXECUTE ON FUNCTION public.sucata_valor_somente_portal_trg() FROM authenticated;

DROP TRIGGER IF EXISTS trg_sucata_valor_somente_portal ON public.sucata_processos;
CREATE TRIGGER trg_sucata_valor_somente_portal BEFORE UPDATE ON public.sucata_processos
  FOR EACH ROW EXECUTE FUNCTION public.sucata_valor_somente_portal_trg();