-- 1) Tabela de logs de alteração das pesagens
CREATE TABLE IF NOT EXISTS public.pesagem_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pesagem_id uuid NOT NULL REFERENCES public.pesagens(id) ON DELETE CASCADE,
  evento text NOT NULL,
  justificativa text,
  alteracoes jsonb,
  usuario_id uuid,
  usuario_nome text,
  usuario_email text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pesagem_logs_pesagem_idx ON public.pesagem_logs (pesagem_id, created_at DESC);

GRANT SELECT, INSERT ON public.pesagem_logs TO authenticated;
GRANT ALL ON public.pesagem_logs TO service_role;

ALTER TABLE public.pesagem_logs ENABLE ROW LEVEL SECURITY;

-- 2) Função de leitura (inclui coordenador; sem permissão de escrita)
CREATE OR REPLACE FUNCTION public.pode_ler_obra(_obra_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(),'admin')
      OR public.has_role(auth.uid(),'superadmin')
      OR public.has_role(auth.uid(),'operador')
      OR public.has_role(auth.uid(),'coordenador');
$$;

CREATE POLICY "Ver logs da obra"
ON public.pesagem_logs FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.pesagens p
  WHERE p.id = pesagem_logs.pesagem_id
    AND public.pode_ler_obra(p.obra_id)
    AND public.pode_ver_obra_coligada(p.obra_id)
));

CREATE POLICY "Registrar logs da obra"
ON public.pesagem_logs FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.pesagens p
  WHERE p.id = pesagem_logs.pesagem_id
    AND public.tem_acesso_obra(p.obra_id)
));

-- 3) Leitura por coordenador nas visões existentes
DROP POLICY IF EXISTS "Ver pesagens da obra" ON public.pesagens;
CREATE POLICY "Ver pesagens da obra"
ON public.pesagens FOR SELECT TO authenticated
USING (public.pode_ler_obra(obra_id) AND public.pode_ver_obra_coligada(obra_id));

DROP POLICY IF EXISTS "Ver evidencias da obra" ON public.evidencias;
CREATE POLICY "Ver evidencias da obra"
ON public.evidencias FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.pesagens p
  WHERE p.id = evidencias.pesagem_id
    AND public.pode_ler_obra(p.obra_id)
    AND public.pode_ver_obra_coligada(p.obra_id)
));

DROP POLICY IF EXISTS "Ver notas da obra" ON public.notas_fiscais;
CREATE POLICY "Ver notas da obra"
ON public.notas_fiscais FOR SELECT TO authenticated
USING (
  (obra_id IS NOT NULL AND public.pode_ler_obra(obra_id) AND public.pode_ver_obra_coligada(obra_id))
  OR (obra_id IS NULL AND public.has_role(auth.uid(), 'admin'))
);
