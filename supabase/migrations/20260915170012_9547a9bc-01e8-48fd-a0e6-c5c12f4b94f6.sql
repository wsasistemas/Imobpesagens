-- Foto 002 (frente do caminhao com a placa) obrigatoria na Fase 1,
-- somente para processos abertos a partir da vigencia.
CREATE OR REPLACE FUNCTION public.sucata_posicao_faltante_bloco_a(_processo_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.posicao
  FROM public.sucata_processos pr
  CROSS JOIN LATERAL (
    SELECT 1 AS posicao
    UNION ALL
    SELECT 2 WHERE pr.entrada_em >= timestamptz '2026-09-15 00:00:00+00'
  ) AS p
  WHERE pr.id = _processo_id
    AND NOT EXISTS (
      SELECT 1 FROM public.sucata_evidencias e
      WHERE e.processo_id = _processo_id
        AND e.posicao = p.posicao
        AND e.substituida_por IS NULL
    )
  ORDER BY p.posicao
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.sucata_encerramento_trg()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE faltam integer;
BEGIN
  IF NEW.concluido_em IS NOT NULL AND OLD.concluido_em IS NULL
     AND NOT COALESCE(NEW.teste_manual, false) THEN
    SELECT count(*) INTO faltam
    FROM (
      SELECT 1 AS posicao
      UNION ALL SELECT 2 WHERE NEW.entrada_em >= timestamptz '2026-09-15 00:00:00+00'
      UNION ALL SELECT 4
      UNION ALL SELECT 10
      UNION ALL SELECT 11
      UNION ALL SELECT 12
    ) AS p
    WHERE NOT EXISTS (
      SELECT 1 FROM public.sucata_evidencias e
      WHERE e.processo_id = NEW.id AND e.posicao = p.posicao AND e.substituida_por IS NULL
    );
    IF faltam > 0 THEN
      RAISE EXCEPTION 'Sequencia fotografica incompleta: faltam % fotos para encerrar.', faltam;
    END IF;
  END IF;

  IF OLD.situacao = 'CONCLUIDO' THEN
    IF NEW.reaberto_em IS DISTINCT FROM OLD.reaberto_em THEN
      IF NOT public.has_role(auth.uid(), 'superadmin') THEN
        RAISE EXCEPTION 'Reabertura de processo concluido e exclusiva do perfil TI.';
      END IF;
      IF coalesce(btrim(NEW.reabertura_motivo), '') = '' THEN
        RAISE EXCEPTION 'Reabertura exige motivo.';
      END IF;
      RETURN NEW;
    END IF;
    IF NEW.excluido_em IS DISTINCT FROM OLD.excluido_em
       AND OLD.excluido_em IS NULL
       AND NEW.excluido_em IS NOT NULL
       AND NEW.situacao = OLD.situacao
       AND NEW.concluido_em IS NOT DISTINCT FROM OLD.concluido_em
       AND NEW.tara_kg IS NOT DISTINCT FROM OLD.tara_kg
       AND NEW.bruto_kg IS NOT DISTINCT FROM OLD.bruto_kg
       AND (public.has_role(auth.uid(), 'superadmin') OR coalesce(auth.role(), '') = 'service_role') THEN
      RETURN NEW;
    END IF;
    IF COALESCE(NEW.teste_manual, false)
       AND (public.has_role(auth.uid(), 'superadmin') OR coalesce(auth.role(), '') = 'service_role') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Processo concluido e somente leitura. Reabertura somente pela TI.';
  END IF;

  RETURN NEW;
END;
$function$;