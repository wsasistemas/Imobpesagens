ALTER TABLE public.pesagens ADD COLUMN IF NOT EXISTS selecionado_exclusao BOOLEAN DEFAULT FALSE;
GRANT UPDATE(selecionado_exclusao) ON public.pesagens TO authenticated;
COMMENT ON COLUMN public.pesagens.selecionado_exclusao IS 'Flag para marcar registros selecionados para exclusão em lote ou identificação visual.';