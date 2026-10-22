CREATE TABLE public.usuario_coligadas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  codcoligada text NOT NULL,
  nome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, codcoligada)
);

GRANT SELECT ON public.usuario_coligadas TO authenticated;
GRANT ALL ON public.usuario_coligadas TO service_role;

ALTER TABLE public.usuario_coligadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuario ve proprias coligadas"
ON public.usuario_coligadas FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'));

CREATE INDEX idx_usuario_coligadas_user ON public.usuario_coligadas(user_id);

CREATE OR REPLACE FUNCTION public.pode_ver_coligada(_cod text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(),'admin')
      OR public.has_role(auth.uid(),'superadmin')
      OR EXISTS (
        SELECT 1 FROM public.usuario_coligadas uc
        WHERE uc.user_id = auth.uid() AND uc.codcoligada = _cod
      );
$$;

CREATE OR REPLACE FUNCTION public.pode_ver_obra_coligada(_obra_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.obras o
    WHERE o.id = _obra_id AND public.pode_ver_coligada(o.coligada)
  );
$$;

DROP POLICY IF EXISTS "Ver obras ativas" ON public.obras;
CREATE POLICY "Ver obras ativas"
ON public.obras FOR SELECT TO authenticated
USING (ativo = true AND public.pode_ver_coligada(coligada));

DROP POLICY IF EXISTS "Ver pesagens da obra" ON public.pesagens;
CREATE POLICY "Ver pesagens da obra"
ON public.pesagens FOR SELECT TO authenticated
USING (public.tem_acesso_obra(obra_id) AND public.pode_ver_obra_coligada(obra_id));

DROP POLICY IF EXISTS "Ver evidencias da obra" ON public.evidencias;
CREATE POLICY "Ver evidencias da obra"
ON public.evidencias FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.pesagens p
  WHERE p.id = evidencias.pesagem_id
    AND public.tem_acesso_obra(p.obra_id)
    AND public.pode_ver_obra_coligada(p.obra_id)
));

DROP POLICY IF EXISTS "Ver notas da obra" ON public.notas_fiscais;
CREATE POLICY "Ver notas da obra"
ON public.notas_fiscais FOR SELECT TO authenticated
USING (
  (obra_id IS NOT NULL AND public.tem_acesso_obra(obra_id) AND public.pode_ver_obra_coligada(obra_id))
  OR (obra_id IS NULL AND public.has_role(auth.uid(),'admin'))
);

CREATE OR REPLACE FUNCTION public.dashboard_recebimento(_obra_id uuid, _ini timestamp with time zone, _fim timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'operador', 'coordenador', 'superadmin')
  ) THEN
    RAISE EXCEPTION 'Sem acesso ao sistema';
  END IF;

  IF NOT public.pode_ver_obra_coligada(_obra_id) THEN
    RAISE EXCEPTION 'Coligada não liberada para este usuário';
  END IF;

  WITH base AS (
    SELECT 
      id, 
      descricao, 
      peso_liquido, 
      emissor, 
      peso_nf, 
      saiu_em, 
      created_at,
      COALESCE(NULLIF(trim(descricao),''),'Sem descrição') as desc_norm
    FROM public.pesagens
    WHERE obra_id = _obra_id AND status = 'concluida'
      AND COALESCE(saiu_em, created_at) >= _ini
      AND COALESCE(saiu_em, created_at) <  _fim
  ),
  top_merc AS (
    SELECT 
      desc_norm AS nome,
      SUM(peso_liquido) AS peso,
      COUNT(*) AS qtd,
      (
        SELECT b2.emissor 
        FROM base b2
        WHERE b2.desc_norm = b.desc_norm
        GROUP BY b2.emissor 
        ORDER BY SUM(b2.peso_liquido) DESC NULLS LAST 
        LIMIT 1
      ) AS principal
    FROM base b
    GROUP BY desc_norm
    ORDER BY peso DESC NULLS LAST 
    LIMIT 10
  ),
  kpis AS (
    SELECT
      COALESCE(SUM(peso_liquido), 0) AS total_kg,
      COUNT(*) AS total_receb,
      COUNT(DISTINCT emissor) FILTER (WHERE emissor IS NOT NULL) AS total_forn,
      COALESCE(SUM(ABS(peso_liquido - peso_nf)) FILTER (WHERE peso_nf IS NOT NULL AND peso_nf > 0), 0) AS diverg,
      COALESCE(SUM(peso_nf) FILTER (WHERE peso_nf IS NOT NULL AND peso_nf > 0), 0) AS peso_nf_tot
    FROM base
  ),
  top_forn AS (
    SELECT COALESCE(emissor,'Sem emissor') AS nome, SUM(peso_liquido) AS peso
    FROM base GROUP BY 1 ORDER BY peso DESC NULLS LAST LIMIT 8
  ),
  por_dia AS (
    SELECT to_char(COALESCE(saiu_em, created_at),'DD') AS dia, SUM(peso_liquido)/1000 AS peso
    FROM base GROUP BY 1 ORDER BY 1
  )
  SELECT jsonb_build_object(
    'kpis', (SELECT to_jsonb(kpis) FROM kpis),
    'top_mercadorias', COALESCE((SELECT jsonb_agg(to_jsonb(top_merc)) FROM top_merc), '[]'::jsonb),
    'top_fornecedores', COALESCE((SELECT jsonb_agg(to_jsonb(top_forn)) FROM top_forn), '[]'::jsonb),
    'por_dia', COALESCE((SELECT jsonb_agg(to_jsonb(por_dia)) FROM por_dia), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END; $function$;