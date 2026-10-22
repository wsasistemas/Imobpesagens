-- 1) Coluna aditiva de peso do depósito
ALTER TABLE public.sucata_processos ADD COLUMN IF NOT EXISTS peso_deposito_kg numeric NULL;

-- 2) Tabela de evidências
CREATE TABLE IF NOT EXISTS public.sucata_evidencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid NOT NULL REFERENCES public.sucata_processos(id),
  posicao integer NOT NULL CHECK (posicao BETWEEN 1 AND 12),
  rotulo text NOT NULL,
  storage_path text NOT NULL,
  capturado_em timestamptz NOT NULL DEFAULT now(),
  capturado_por uuid NOT NULL,
  lat numeric(9,6),
  lng numeric(9,6),
  versao integer NOT NULL DEFAULT 1,
  substituida_por uuid NULL REFERENCES public.sucata_evidencias(id),
  motivo_substituicao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sucata_evidencias_posicao_vigente_uidx
  ON public.sucata_evidencias (processo_id, posicao)
  WHERE substituida_por IS NULL;

CREATE INDEX IF NOT EXISTS sucata_evidencias_processo_idx ON public.sucata_evidencias (processo_id);

GRANT SELECT, INSERT, UPDATE ON public.sucata_evidencias TO authenticated;
GRANT ALL ON public.sucata_evidencias TO service_role;

ALTER TABLE public.sucata_evidencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sucata_evidencias_select" ON public.sucata_evidencias;
CREATE POLICY "sucata_evidencias_select" ON public.sucata_evidencias
  FOR SELECT TO authenticated
  USING (
    public.sucata_pode_ler()
    AND EXISTS (
      SELECT 1 FROM public.sucata_processos p
      WHERE p.id = sucata_evidencias.processo_id
        AND public.pode_ver_coligada(p.coligada_origem)
    )
  );

DROP POLICY IF EXISTS "sucata_evidencias_insert" ON public.sucata_evidencias;
CREATE POLICY "sucata_evidencias_insert" ON public.sucata_evidencias
  FOR INSERT TO authenticated
  WITH CHECK (
    public.sucata_pode_escrever()
    AND EXISTS (
      SELECT 1 FROM public.sucata_processos p
      WHERE p.id = sucata_evidencias.processo_id
        AND public.pode_ver_coligada(p.coligada_origem)
    )
  );

DROP POLICY IF EXISTS "sucata_evidencias_update" ON public.sucata_evidencias;
CREATE POLICY "sucata_evidencias_update" ON public.sucata_evidencias
  FOR UPDATE TO authenticated
  USING (
    public.sucata_pode_escrever()
    AND EXISTS (
      SELECT 1 FROM public.sucata_processos p
      WHERE p.id = sucata_evidencias.processo_id
        AND public.pode_ver_coligada(p.coligada_origem)
    )
  )
  WITH CHECK (
    public.sucata_pode_escrever()
    AND EXISTS (
      SELECT 1 FROM public.sucata_processos p
      WHERE p.id = sucata_evidencias.processo_id
        AND public.pode_ver_coligada(p.coligada_origem)
    )
  );

DROP TRIGGER IF EXISTS trg_sucata_evidencias_updated ON public.sucata_evidencias;
CREATE TRIGGER trg_sucata_evidencias_updated
  BEFORE UPDATE ON public.sucata_evidencias
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) Trava do bloco A (posições 001 a 004) para gravar o peso bruto
CREATE OR REPLACE FUNCTION public.sucata_posicao_faltante_bloco_a(_processo_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.posicao
  FROM (VALUES (1),(2),(3),(4)) AS p(posicao)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.sucata_evidencias e
    WHERE e.processo_id = _processo_id
      AND e.posicao = p.posicao
      AND e.substituida_por IS NULL
  )
  ORDER BY p.posicao
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.sucata_posicao_faltante_bloco_a(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sucata_posicao_faltante_bloco_a(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.sucata_valida_bruto_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE faltante integer;
BEGIN
  IF NEW.bruto_kg IS NOT NULL AND (OLD.bruto_kg IS NULL OR OLD.bruto_kg <> NEW.bruto_kg) THEN
    faltante := public.sucata_posicao_faltante_bloco_a(NEW.id);
    IF faltante IS NOT NULL THEN
      RAISE EXCEPTION 'Sequencia fotografica incompleta: falta a foto %', lpad(faltante::text, 3, '0');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sucata_valida_bruto ON public.sucata_processos;
CREATE TRIGGER trg_sucata_valida_bruto
  BEFORE UPDATE ON public.sucata_processos
  FOR EACH ROW EXECUTE FUNCTION public.sucata_valida_bruto_trg();