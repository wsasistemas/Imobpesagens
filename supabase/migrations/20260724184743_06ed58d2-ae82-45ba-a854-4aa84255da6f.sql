ALTER TABLE public.pesagens
  ADD COLUMN IF NOT EXISTS ocorrencia_saida_tipo text,
  ADD COLUMN IF NOT EXISTS ocorrencia_saida_tipo_outro text,
  ADD COLUMN IF NOT EXISTS ocorrencia_saida_relato text,
  ADD COLUMN IF NOT EXISTS ocorrencia_saida_em timestamptz,
  ADD COLUMN IF NOT EXISTS ocorrencia_saida_por uuid;