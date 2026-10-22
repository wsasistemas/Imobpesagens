
ALTER TABLE public.pesagens
  ADD COLUMN IF NOT EXISTS modelo text,
  ADD COLUMN IF NOT EXISTS marca text,
  ADD COLUMN IF NOT EXISTS carreta text,
  ADD COLUMN IF NOT EXISTS valor_total_nf numeric,
  ADD COLUMN IF NOT EXISTS qtd_total numeric,
  ADD COLUMN IF NOT EXISTS itens_nf jsonb;
