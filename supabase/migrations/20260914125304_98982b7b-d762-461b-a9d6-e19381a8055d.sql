-- Painel de teste manual: as gravações saem do servidor (papel service_role),
-- onde auth.uid() é nulo. Libera as travas para processos marcados como teste.
CREATE OR REPLACE FUNCTION public.sucata_pesos_imutaveis_trg()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.aceite_em IS NOT NULL
     AND (NEW.tara_kg IS DISTINCT FROM OLD.tara_kg OR NEW.bruto_kg IS DISTINCT FROM OLD.bruto_kg)
  THEN
    IF NOT (
      public.has_role(auth.uid(), 'superadmin')
      OR (COALESCE(NEW.teste_manual, false) AND coalesce(auth.role(), '') = 'service_role')
    ) THEN
      RAISE EXCEPTION 'Pesos bloqueados: o sucateiro já aceitou o peso aferido deste processo. Reabertura somente pela TI.';
    END IF;
  END IF;
  RETURN NEW;
END $function$;

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
    FROM (VALUES (1),(4),(10),(11),(12)) AS p(posicao)
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
    IF COALESCE(NEW.teste_manual, false)
       AND (public.has_role(auth.uid(), 'superadmin') OR coalesce(auth.role(), '') = 'service_role') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Processo concluido e somente leitura. Reabertura somente pela TI.';
  END IF;

  RETURN NEW;
END;
$function$;