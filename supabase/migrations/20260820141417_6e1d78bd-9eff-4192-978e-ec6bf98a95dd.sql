ALTER TABLE public.obras
  ADD COLUMN IF NOT EXISTS endereco text,
  ADD COLUMN IF NOT EXISTS engenheiro_nome text,
  ADD COLUMN IF NOT EXISTS engenheiro_email text;