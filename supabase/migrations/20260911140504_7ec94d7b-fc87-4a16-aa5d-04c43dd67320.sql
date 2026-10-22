ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'contador';

ALTER TABLE public.sucata_processos ADD COLUMN IF NOT EXISTS descricao_carga text;

INSERT INTO public.perfil_descricoes (role, nome, descricao, ordem)
VALUES ('contador', 'Contabilidade', 'Emite a Nota Fiscal Avulsa e consulta os relatórios técnicos do módulo Sucata.', 50)
ON CONFLICT (role) DO NOTHING;

INSERT INTO public.perfil_menu_permissoes (role, menu_key, permitido)
SELECT 'contador', m.menu_key, m.menu_key = 'sucata'
FROM (VALUES ('pesagem'),('sucata'),('dashboard'),('relatorios_ocorrencias'),('configuracoes'),
             ('whatsapp'),('whatsapp_bulk'),('conectar_assistente'),('documentacao'),('treinamento')) AS m(menu_key)
ON CONFLICT (role, menu_key) DO NOTHING;

INSERT INTO public.sucata_parametros (chave, valor, descricao)
VALUES ('contabilidade_emails', 'marco.aurelio@calper.com.br', 'E-mails que recebem o pedido de Nota Fiscal Avulsa')
ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor;

CREATE OR REPLACE FUNCTION public.sucata_posicao_faltante_bloco_a(_processo_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.posicao
  FROM (VALUES (1)) AS p(posicao)
  WHERE NOT EXISTS (
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
    IF COALESCE(NEW.teste_manual, false) AND public.has_role(auth.uid(), 'superadmin') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Processo concluido e somente leitura. Reabertura somente pela TI.';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sucata_nfa_exige_aprovacao_trg()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.aprovado_em IS NULL AND (
       (NEW.nfa_solicitada_em IS NOT NULL AND NEW.nfa_solicitada_em IS DISTINCT FROM OLD.nfa_solicitada_em)
    OR (NEW.nfa_numero IS NOT NULL AND NEW.nfa_numero IS DISTINCT FROM OLD.nfa_numero)
    OR (NEW.nfa_emissao IS NOT NULL AND NEW.nfa_emissao IS DISTINCT FROM OLD.nfa_emissao)
    OR (NEW.nfa_storage_path IS NOT NULL AND NEW.nfa_storage_path IS DISTINCT FROM OLD.nfa_storage_path)
    OR (NEW.nfa_enviada_em IS NOT NULL AND NEW.nfa_enviada_em IS DISTINCT FROM OLD.nfa_enviada_em)
  ) THEN
    RAISE EXCEPTION 'A Nota Fiscal Avulsa depende do pedido aprovado pelo administrativo da obra.';
  END IF;

  IF NEW.aprovado_em IS NOT NULL AND OLD.aprovado_em IS NULL THEN
    IF NEW.valor_total IS NULL THEN
      RAISE EXCEPTION 'O pedido da nota exige o valor total da coleta.';
    END IF;
    IF COALESCE(NEW.pagamento_conta_divergente, false)
       AND COALESCE(btrim(NEW.pagamento_justificativa), '') = '' THEN
      RAISE EXCEPTION 'Conta creditada fora do cadastro da obra exige justificativa para aprovar.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;