ALTER TABLE public.sucata_processos
  ADD COLUMN IF NOT EXISTS teste_manual boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.sucata_processos.teste_manual IS
  'Processo criado/preenchido manualmente para teste do fluxo por Admin/SuperAdmin.';

CREATE OR REPLACE FUNCTION public.sucata_valida_bruto_trg()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE faltante integer;
BEGIN
  IF COALESCE(NEW.teste_manual, false) THEN
    RETURN NEW;
  END IF;
  IF NEW.bruto_kg IS NOT NULL AND (OLD.bruto_kg IS NULL OR OLD.bruto_kg <> NEW.bruto_kg) THEN
    faltante := public.sucata_posicao_faltante_bloco_a(NEW.id);
    IF faltante IS NOT NULL THEN
      RAISE EXCEPTION 'Sequencia fotografica incompleta: falta a foto %', lpad(faltante::text, 3, '0');
    END IF;
  END IF;
  RETURN NEW;
END;
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
    SELECT 12 - count(*) INTO faltam
    FROM public.sucata_evidencias e
    WHERE e.processo_id = NEW.id AND e.substituida_por IS NULL;
    IF faltam > 0 THEN
      RAISE EXCEPTION 'Sequencia fotografica incompleta: faltam % evidencias para encerrar.', faltam;
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
    IF COALESCE(NEW.teste_manual, false) AND public.has_role(auth.uid(), 'superadmin') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Processo concluido e somente leitura. Reabertura somente pela TI.';
  END IF;

  RETURN NEW;
END;
$function$;