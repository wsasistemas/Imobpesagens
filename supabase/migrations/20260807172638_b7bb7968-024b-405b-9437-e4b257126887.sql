CREATE TABLE public.pesagem_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pesagem_id uuid NOT NULL REFERENCES public.pesagens(id) ON DELETE CASCADE,
  evento text NOT NULL,
  justificativa text,
  alteracoes jsonb NOT NULL DEFAULT '[]'::jsonb,
  usuario_id uuid,
  usuario_nome text,
  usuario_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pesagem_logs_pesagem ON public.pesagem_logs (pesagem_id, created_at DESC);

GRANT SELECT ON public.pesagem_logs TO authenticated;
GRANT ALL ON public.pesagem_logs TO service_role;

ALTER TABLE public.pesagem_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin e operador podem ler logs"
ON public.pesagem_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operador'));