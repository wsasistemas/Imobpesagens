ALTER TABLE public.sucata_sucateiros
  ADD COLUMN IF NOT EXISTS valor_por_kg numeric(12,4);

ALTER TABLE public.sucata_processos
  ADD COLUMN IF NOT EXISTS valor_unitario_kg numeric(12,4),
  ADD COLUMN IF NOT EXISTS valor_ajustado_por uuid,
  ADD COLUMN IF NOT EXISTS valor_ajustado_em timestamptz,
  ADD COLUMN IF NOT EXISTS valor_ajuste_justificativa text,
  ADD COLUMN IF NOT EXISTS nfa_exportada_em timestamptz,
  ADD COLUMN IF NOT EXISTS fases_registro jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.sucata_sucateiros.valor_por_kg IS 'Valor pago por quilo de sucata (R$/kg), usado no cálculo automático do valor total da coleta.';
COMMENT ON COLUMN public.sucata_processos.valor_unitario_kg IS 'Valor por quilo usado neste processo (copiado do sucateiro na saída do caminhão).';
COMMENT ON COLUMN public.sucata_processos.fases_registro IS 'Registro de abertura e conclusão de cada fase: {"1":{"aberta_em":...,"aberta_nome":...,"fechada_em":...,"fechada_nome":...}}.';