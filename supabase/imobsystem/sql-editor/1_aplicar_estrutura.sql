-- Rodar no SQL Editor do projeto ikvjaowvpvxojvcfwnct (ImobSystem). Tudo numa transação: se der erro, nada fica pela metade.
-- Conteúdo igual a migrations/20261022120000_imobpesagens_01_estrutura.sql. Depois: 2_expor_schema_api.sql.
begin;

-- Trava: se a estrutura já existe, para aqui (rollback) sem alterar nada.
do $trava$
begin
  if to_regclass('imobpesagens.pesagens') is not null then
    raise exception 'O schema imobpesagens já tem a estrutura aplicada. Nada foi alterado.';
  end if;
end
$trava$;

-- =====================================================================================================
-- Portal de Pesagem (imobpesagens) — estrutura do schema no Supabase ImobSystem (ikvjaowvpvxojvcfwnct)
-- Gerado por supabase/imobsystem/gerador/gerar.mjs a partir do estado final das migrations do Lovable
-- (supabase/migrations + drizzle/migrations), com os ajustes de gerador/1_preparar_replica.sql:
--   • sem gatilho em auth.users (o auth é compartilhado com os outros sistemas Imob);
--   • sem dados (tabelas vazias); configuração inicial em migration própria;
--   • leitura das tabelas de referência só para quem tem papel no app (usuario_do_app());
--   • nada para o anon; funções com search_path = imobpesagens.
-- Aditiva: só cria objetos no schema imobpesagens. Não altera public, auth nem outros schemas.
-- NÃO EDITAR À MÃO: ajuste o gerador e gere de novo.
-- =====================================================================================================

create schema if not exists imobpesagens;
comment on schema imobpesagens is 'Portal de Pesagem (WSA Sistemas): pesagem rodoviária, sucata, tolerâncias e alertas.';

revoke all on schema imobpesagens from public;
revoke all on schema imobpesagens from anon;
grant usage on schema imobpesagens to authenticated, service_role;

alter default privileges for role postgres in schema imobpesagens revoke all on tables from public, anon;
alter default privileges for role postgres in schema imobpesagens revoke all on sequences from public, anon;
alter default privileges for role postgres in schema imobpesagens revoke execute on functions from public, anon;
alter default privileges for role postgres in schema imobpesagens grant all on tables to service_role;
alter default privileges for role postgres in schema imobpesagens grant all on sequences to service_role;
alter default privileges for role postgres in schema imobpesagens grant all on functions to service_role;

--
-- PostgreSQL database dump
--

-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE imobpesagens.app_role AS ENUM (
    'admin',
    'operador',
    'coordenador',
    'superadmin',
    'contador',
    'administrativo_obra'
);

--
-- Name: fonte_nota; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE imobpesagens.fonte_nota AS ENUM (
    'sefaz',
    'ocr',
    'ocr_pendente',
    'manual'
);

--
-- Name: fonte_peso; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE imobpesagens.fonte_peso AS ENUM (
    'balanca',
    'manual'
);

--
-- Name: status_pesagem; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE imobpesagens.status_pesagem AS ENUM (
    'aguardando_saida',
    'concluida',
    'recusado',
    'fechada_com_ocorrencia',
    'aguardando_saida_ocorrencia',
    'rascunho_entrada',
    'rascunho_saida'
);

--
-- Name: tipo_evidencia; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE imobpesagens.tipo_evidencia AS ENUM (
    'placa',
    'carga',
    'lateral',
    'nota',
    'outro',
    'ocorrencia'
);

--
-- Name: dashboard_recebimento(uuid, timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION imobpesagens.dashboard_recebimento(_obra_id uuid, _ini timestamp with time zone, _fim timestamp with time zone) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'imobpesagens'
    AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM imobpesagens.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'operador', 'coordenador', 'superadmin')
  ) THEN
    RAISE EXCEPTION 'Sem acesso ao sistema';
  END IF;

  IF NOT imobpesagens.pode_ver_obra_coligada(_obra_id) THEN
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
    FROM imobpesagens.pesagens
    WHERE obra_id = _obra_id
      AND status IN ('concluida','fechada_com_ocorrencia')
      AND peso_entrada IS NOT NULL
      AND peso_saida IS NOT NULL
      AND peso_liquido IS NOT NULL
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
END; $$;

--
-- Name: has_role(uuid, imobpesagens.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION imobpesagens.has_role(_user_id uuid, _role imobpesagens.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'imobpesagens'
    AS $$
  SELECT EXISTS (SELECT 1 FROM imobpesagens.user_roles WHERE user_id = _user_id AND role = _role);
$$;

--
-- Name: pode_ler_obra(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION imobpesagens.pode_ler_obra(_obra_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'imobpesagens'
    AS $$
  SELECT imobpesagens.has_role(auth.uid(),'admin')
      OR imobpesagens.has_role(auth.uid(),'superadmin')
      OR imobpesagens.has_role(auth.uid(),'operador')
      OR imobpesagens.has_role(auth.uid(),'coordenador');
$$;

--
-- Name: pode_ver_coligada(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION imobpesagens.pode_ver_coligada(_cod text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'imobpesagens'
    AS $$
  SELECT imobpesagens.has_role(auth.uid(),'admin')
      OR imobpesagens.has_role(auth.uid(),'superadmin')
      OR EXISTS (
        SELECT 1 FROM imobpesagens.usuario_coligadas uc
        WHERE uc.user_id = auth.uid() AND uc.codcoligada = _cod
      );
$$;

--
-- Name: pode_ver_obra_coligada(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION imobpesagens.pode_ver_obra_coligada(_obra_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'imobpesagens'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM imobpesagens.obras o
    WHERE o.id = _obra_id AND imobpesagens.pode_ver_coligada(o.coligada)
  );
$$;

--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION imobpesagens.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'imobpesagens'
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

--
-- Name: sucata_encerramento_trg(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION imobpesagens.sucata_encerramento_trg() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'imobpesagens'
    AS $$
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
      SELECT 1 FROM imobpesagens.sucata_evidencias e
      WHERE e.processo_id = NEW.id AND e.posicao = p.posicao AND e.substituida_por IS NULL
    );
    IF faltam > 0 THEN
      RAISE EXCEPTION 'Sequencia fotografica incompleta: faltam % fotos para encerrar.', faltam;
    END IF;
  END IF;

  IF OLD.situacao = 'CONCLUIDO' THEN
    IF NEW.reaberto_em IS DISTINCT FROM OLD.reaberto_em THEN
      IF NOT imobpesagens.has_role(auth.uid(), 'superadmin') THEN
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
       AND (imobpesagens.has_role(auth.uid(), 'superadmin') OR coalesce(auth.role(), '') = 'service_role') THEN
      RETURN NEW;
    END IF;
    IF COALESCE(NEW.teste_manual, false)
       AND (imobpesagens.has_role(auth.uid(), 'superadmin') OR coalesce(auth.role(), '') = 'service_role') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Processo concluido e somente leitura. Reabertura somente pela TI.';
  END IF;

  RETURN NEW;
END;
$$;

--
-- Name: sucata_evidencia_processo_aberto_trg(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION imobpesagens.sucata_evidencia_processo_aberto_trg() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'imobpesagens'
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM imobpesagens.sucata_processos p
    WHERE p.id = NEW.processo_id AND p.situacao = 'CONCLUIDO'
  ) THEN
    RAISE EXCEPTION 'Processo concluido: nao e possivel incluir ou alterar evidencias.';
  END IF;
  RETURN NEW;
END;
$$;

--
-- Name: sucata_nfa_exige_aprovacao_trg(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION imobpesagens.sucata_nfa_exige_aprovacao_trg() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'imobpesagens'
    AS $$
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
$$;

--
-- Name: sucata_pesos_imutaveis_trg(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION imobpesagens.sucata_pesos_imutaveis_trg() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'imobpesagens'
    AS $$
BEGIN
  IF OLD.aceite_em IS NOT NULL
     AND (NEW.tara_kg IS DISTINCT FROM OLD.tara_kg OR NEW.bruto_kg IS DISTINCT FROM OLD.bruto_kg)
  THEN
    IF NOT (
      imobpesagens.has_role(auth.uid(), 'superadmin')
      OR (COALESCE(NEW.teste_manual, false) AND coalesce(auth.role(), '') = 'service_role')
    ) THEN
      RAISE EXCEPTION 'Pesos bloqueados: o sucateiro já aceitou o peso aferido deste processo. Reabertura somente pela TI.';
    END IF;
  END IF;
  RETURN NEW;
END $$;

--
-- Name: sucata_pode_escrever(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION imobpesagens.sucata_pode_escrever() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'imobpesagens'
    AS $$
  SELECT imobpesagens.has_role(auth.uid(),'admin')
      OR imobpesagens.has_role(auth.uid(),'superadmin')
      OR imobpesagens.has_role(auth.uid(),'operador');
$$;

--
-- Name: sucata_pode_ler(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION imobpesagens.sucata_pode_ler() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'imobpesagens'
    AS $$
  SELECT imobpesagens.has_role(auth.uid(),'admin')
      OR imobpesagens.has_role(auth.uid(),'superadmin')
      OR imobpesagens.has_role(auth.uid(),'operador')
      OR imobpesagens.has_role(auth.uid(),'coordenador')
      OR imobpesagens.has_role(auth.uid(),'contador')
      OR imobpesagens.has_role(auth.uid(),'administrativo_obra');
$$;

--
-- Name: sucata_posicao_faltante_bloco_a(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION imobpesagens.sucata_posicao_faltante_bloco_a(_processo_id uuid) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'imobpesagens'
    AS $$
  SELECT p.posicao
  FROM imobpesagens.sucata_processos pr
  CROSS JOIN LATERAL (
    SELECT 1 AS posicao
    UNION ALL
    SELECT 2 WHERE pr.entrada_em >= timestamptz '2026-09-15 00:00:00+00'
  ) AS p
  WHERE pr.id = _processo_id
    AND NOT EXISTS (
      SELECT 1 FROM imobpesagens.sucata_evidencias e
      WHERE e.processo_id = _processo_id
        AND e.posicao = p.posicao
        AND e.substituida_por IS NULL
    )
  ORDER BY p.posicao
  LIMIT 1;
$$;

--
-- Name: sucata_processos_numero_trg(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION imobpesagens.sucata_processos_numero_trg() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'imobpesagens'
    AS $$
BEGIN
  IF NEW.ano IS NULL THEN
    NEW.ano := EXTRACT(YEAR FROM (now() AT TIME ZONE 'America/Sao_Paulo'))::int;
  END IF;
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := imobpesagens.sucata_proximo_numero(NEW.ano);
  END IF;
  RETURN NEW;
END; $$;

--
-- Name: sucata_proteger_exclusao_logica_trg(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION imobpesagens.sucata_proteger_exclusao_logica_trg() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'imobpesagens'
    AS $$
BEGIN
  IF NEW.excluido_em IS DISTINCT FROM OLD.excluido_em
     OR NEW.excluido_por IS DISTINCT FROM OLD.excluido_por
     OR NEW.exclusao_motivo IS DISTINCT FROM OLD.exclusao_motivo THEN
    IF auth.role() <> 'service_role'
       AND NOT imobpesagens.has_role(auth.uid(), 'superadmin') THEN
      RAISE EXCEPTION 'Somente o SuperAdmin pode excluir um processo de sucata.';
    END IF;

    IF NEW.excluido_em IS NOT NULL THEN
      IF NEW.excluido_por IS NULL THEN
        RAISE EXCEPTION 'O responsável pela exclusão é obrigatório.';
      END IF;
      IF length(trim(COALESCE(NEW.exclusao_motivo, ''))) < 5 THEN
        RAISE EXCEPTION 'O motivo da exclusão deve ter ao menos 5 caracteres.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

--
-- Name: sucata_proximo_numero(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION imobpesagens.sucata_proximo_numero(_ano integer) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'imobpesagens'
    AS $$
DECLARE n integer;
BEGIN
  INSERT INTO imobpesagens.sucata_numeracao (ano, ultimo) VALUES (_ano, 1)
  ON CONFLICT (ano) DO UPDATE SET ultimo = imobpesagens.sucata_numeracao.ultimo + 1
  RETURNING ultimo INTO n;
  RETURN 'SUC-' || lpad(n::text, 4, '0') || '/' || _ano::text;
END; $$;

--
-- Name: sucata_valida_bruto_trg(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION imobpesagens.sucata_valida_bruto_trg() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'imobpesagens'
    AS $$
DECLARE faltante integer;
BEGIN
  IF COALESCE(NEW.teste_manual, false) THEN
    RETURN NEW;
  END IF;
  IF NEW.bruto_kg IS NOT NULL AND (OLD.bruto_kg IS NULL OR OLD.bruto_kg <> NEW.bruto_kg) THEN
    faltante := imobpesagens.sucata_posicao_faltante_bloco_a(NEW.id);
    IF faltante IS NOT NULL THEN
      RAISE EXCEPTION 'Sequencia fotografica incompleta: falta a foto %', lpad(faltante::text, 3, '0');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

--
-- Name: sucata_valida_cnpj(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION imobpesagens.sucata_valida_cnpj(_cnpj text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'imobpesagens'
    AS $_$
DECLARE d text; s int := 0; i int; p int; dv1 int; dv2 int;
BEGIN
  IF _cnpj IS NULL THEN RETURN true; END IF;
  d := regexp_replace(_cnpj, '[^0-9]', '', 'g');
  IF length(d) <> 14 THEN RETURN false; END IF;
  IF d ~ '^(\d)\1{13}$' THEN RETURN false; END IF;
  p := 5; s := 0;
  FOR i IN 1..12 LOOP
    s := s + substr(d, i, 1)::int * p;
    p := CASE WHEN p = 2 THEN 9 ELSE p - 1 END;
  END LOOP;
  dv1 := 11 - (s % 11); IF dv1 >= 10 THEN dv1 := 0; END IF;
  IF dv1 <> substr(d, 13, 1)::int THEN RETURN false; END IF;
  p := 6; s := 0;
  FOR i IN 1..13 LOOP
    s := s + substr(d, i, 1)::int * p;
    p := CASE WHEN p = 2 THEN 9 ELSE p - 1 END;
  END LOOP;
  dv2 := 11 - (s % 11); IF dv2 >= 10 THEN dv2 := 0; END IF;
  RETURN dv2 = substr(d, 14, 1)::int;
END; $_$;

--
-- Name: sucata_valida_cpf(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION imobpesagens.sucata_valida_cpf(_cpf text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'imobpesagens'
    AS $_$
DECLARE d text; s int; i int; dv1 int; dv2 int;
BEGIN
  IF _cpf IS NULL THEN RETURN true; END IF;
  d := regexp_replace(_cpf, '[^0-9]', '', 'g');
  IF length(d) <> 11 THEN RETURN false; END IF;
  IF d ~ '^(\d)\1{10}$' THEN RETURN false; END IF;
  s := 0;
  FOR i IN 1..9 LOOP s := s + substr(d, i, 1)::int * (11 - i); END LOOP;
  dv1 := (s * 10) % 11; IF dv1 = 10 THEN dv1 := 0; END IF;
  IF dv1 <> substr(d, 10, 1)::int THEN RETURN false; END IF;
  s := 0;
  FOR i IN 1..10 LOOP s := s + substr(d, i, 1)::int * (12 - i); END LOOP;
  dv2 := (s * 10) % 11; IF dv2 = 10 THEN dv2 := 0; END IF;
  RETURN dv2 = substr(d, 11, 1)::int;
END; $_$;

--
-- Name: sucata_valor_somente_portal_trg(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION imobpesagens.sucata_valor_somente_portal_trg() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'imobpesagens'
    AS $$
BEGIN
  IF (NEW.valor_total IS DISTINCT FROM OLD.valor_total
      OR NEW.recibo_modo IS DISTINCT FROM OLD.recibo_modo)
     AND coalesce(auth.role(), '') <> 'service_role'
  THEN
    RAISE EXCEPTION 'O valor da coleta é informado somente pelo sucateiro, no portal externo.';
  END IF;
  RETURN NEW;
END $$;

--
-- Name: tem_acesso_obra(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION imobpesagens.tem_acesso_obra(_obra_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'imobpesagens'
    AS $$
  SELECT imobpesagens.has_role(auth.uid(),'admin')
      OR imobpesagens.has_role(auth.uid(),'superadmin')
      OR (
        imobpesagens.has_role(auth.uid(),'operador')
        AND (
          EXISTS (
            SELECT 1 FROM imobpesagens.obra_acessos oa
            WHERE oa.user_id = auth.uid() AND oa.obra_id = _obra_id
          )
          OR imobpesagens.pode_ver_obra_coligada(_obra_id)
        )
      );
$$;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION imobpesagens.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'imobpesagens'
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

--
-- Name: usuario_do_app(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION imobpesagens.usuario_do_app() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'imobpesagens'
    AS $$
  select exists (select 1 from imobpesagens.user_roles ur where ur.user_id = auth.uid());
$$;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: densidades_fornecedor; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE imobpesagens.densidades_fornecedor (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    densidade_material_id uuid NOT NULL,
    fornecedor_nome text NOT NULL,
    densidade numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: densidades_material; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE imobpesagens.densidades_material (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    material text NOT NULL,
    palavras_chave text[] DEFAULT '{}'::text[] NOT NULL,
    unidade_base text DEFAULT 'M3'::text NOT NULL,
    densidade numeric NOT NULL,
    ordem integer DEFAULT 100 NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: evidencias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE imobpesagens.evidencias (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pesagem_id uuid NOT NULL,
    tipo imobpesagens.tipo_evidencia NOT NULL,
    storage_path text NOT NULL,
    nome text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: fornecedores_concreto; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE imobpesagens.fornecedores_concreto (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    cnpj text,
    emissor_keywords text[] DEFAULT '{}'::text[],
    tolerancia_padrao numeric DEFAULT 4 NOT NULL,
    teor_ar numeric,
    ativo boolean DEFAULT true NOT NULL,
    observacoes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

--
-- Name: fornecedores_material; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE imobpesagens.fornecedores_material (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    cnpj text,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: fornecedores_material_v2; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE imobpesagens.fornecedores_material_v2 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    razao_social text NOT NULL,
    cnpj text,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    created_by_nome text,
    ativo boolean DEFAULT true NOT NULL,
    origem text DEFAULT 'lista'::text NOT NULL,
    vinculado boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT fornecedores_material_v2_origem_check CHECK ((origem = ANY (ARRAY['lista'::text, 'manual'::text])))
);

--
-- Name: notas_fiscais; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE imobpesagens.notas_fiscais (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    obra_id uuid,
    chave text NOT NULL,
    numero text,
    emissao timestamp with time zone,
    emissor text,
    emissor_cnpj text,
    destinatario_cnpj text,
    transportadora text,
    placa text,
    uf text,
    peso numeric,
    descricao text,
    xml text,
    fonte imobpesagens.fonte_nota DEFAULT 'sefaz'::imobpesagens.fonte_nota NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: obra_acessos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE imobpesagens.obra_acessos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    obra_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: obras; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE imobpesagens.obras (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    coligada text NOT NULL,
    cnpj text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    endereco text,
    engenheiro_nome text,
    engenheiro_email text
);

--
-- Name: perfil_descricoes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE imobpesagens.perfil_descricoes (
    role text NOT NULL,
    nome text NOT NULL,
    descricao text,
    ordem integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: perfil_menu_permissoes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE imobpesagens.perfil_menu_permissoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role text NOT NULL,
    menu_key text NOT NULL,
    permitido boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: pesagem_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE imobpesagens.pesagem_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pesagem_id uuid NOT NULL,
    evento text NOT NULL,
    justificativa text,
    alteracoes jsonb DEFAULT '[]'::jsonb NOT NULL,
    usuario_id uuid,
    usuario_nome text,
    usuario_email text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: pesagens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE imobpesagens.pesagens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    obra_id uuid NOT NULL,
    chave_nfe text,
    numero_nota text,
    emissao timestamp with time zone,
    emissor text,
    transportadora text,
    placa text,
    uf text,
    motorista text,
    descricao text,
    peso_nf numeric,
    fonte_nota imobpesagens.fonte_nota DEFAULT 'manual'::imobpesagens.fonte_nota NOT NULL,
    peso_entrada numeric,
    peso_saida numeric,
    fonte_peso_entrada imobpesagens.fonte_peso,
    fonte_peso_saida imobpesagens.fonte_peso,
    entrou_em timestamp with time zone,
    saiu_em timestamp with time zone,
    status imobpesagens.status_pesagem DEFAULT 'aguardando_saida'::imobpesagens.status_pesagem NOT NULL,
    justificativa text,
    peso_liquido numeric GENERATED ALWAYS AS (
CASE
    WHEN ((peso_entrada IS NOT NULL) AND (peso_saida IS NOT NULL)) THEN abs((peso_entrada - peso_saida))
    ELSE NULL::numeric
END) STORED,
    criado_por uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    contratante text,
    saida_por uuid,
    modelo text,
    marca text,
    carreta text,
    valor_total_nf numeric,
    qtd_total numeric,
    itens_nf jsonb,
    ocorrencia_tipo text,
    ocorrencia_tipo_outro text,
    ocorrencia_relato text,
    ocorrencia_em timestamp with time zone,
    ocorrencia_por uuid,
    ocorrencia_saida_tipo text,
    ocorrencia_saida_tipo_outro text,
    ocorrencia_saida_relato text,
    ocorrencia_saida_em timestamp with time zone,
    ocorrencia_saida_por uuid,
    modo_pesagem text DEFAULT 'dupla'::text,
    tara_informada numeric,
    volume_residuo numeric,
    requer_conferencia_eng boolean DEFAULT false,
    traco_id uuid,
    resultado_afericao jsonb,
    aud_peso_esperado_anterior numeric,
    aud_diferenca_kg_anterior numeric,
    aud_diferenca_pct_anterior numeric,
    aud_tolerancia_anterior numeric,
    aud_status_anterior text,
    aud_base_calculo_anterior text,
    recalculado_em timestamp with time zone,
    recalculo_versao text,
    peso_esperado numeric,
    diferenca_kg numeric,
    diferenca_pct numeric,
    tolerancia_aplicada numeric,
    status_afericao text,
    base_calculo text,
    volume_m3 numeric,
    volume_derivado_detalhe jsonb,
    dados_adicionais_nf text,
    traco_confirmado_manual boolean DEFAULT false,
    fornecedor_confirmado_manual boolean DEFAULT false,
    is_padrao_fallback boolean DEFAULT false,
    selecionado_exclusao boolean DEFAULT false,
    CONSTRAINT pesagens_modo_pesagem_check CHECK ((modo_pesagem = ANY (ARRAY['dupla'::text, 'unica_excecao'::text])))
);

--
-- Name: COLUMN pesagens.dados_adicionais_nf; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN imobpesagens.pesagens.dados_adicionais_nf IS 'Conteúdo do campo DADOS ADICIONAIS / INFORMAÇÕES COMPLEMENTARES extraído via OCR da nota fiscal.';

--
-- Name: COLUMN pesagens.selecionado_exclusao; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN imobpesagens.pesagens.selecionado_exclusao IS 'Flag para marcar registros selecionados para exclusão em lote ou identificação visual.';

--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE imobpesagens.profiles (
    id uuid NOT NULL,
    nome text,
    cargo text,
    setor text,
    telefone text,
    email text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    whatsapp_e164 text,
    engenheiro_todas_coligadas boolean DEFAULT false NOT NULL
);

--
-- Name: sefaz_certificados; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE imobpesagens.sefaz_certificados (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    obra_id uuid NOT NULL,
    cnpj text NOT NULL,
    ambiente text DEFAULT 'producao'::text NOT NULL,
    certificado_nome text,
    vault_secret_name text,
    ultimo_nsu text,
    notas_cache_count integer DEFAULT 0 NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sefaz_certificados_ambiente_check CHECK ((ambiente = ANY (ARRAY['producao'::text, 'homologacao'::text])))
);

--
-- Name: sucata_cfop; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE imobpesagens.sucata_cfop (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo text NOT NULL,
    descricao text NOT NULL,
    escopo text DEFAULT 'INTERNO'::text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    ordem integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: sucata_contas_obra; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE imobpesagens.sucata_contas_obra (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    obra_id uuid NOT NULL,
    coligada_origem text NOT NULL,
    banco text NOT NULL,
    agencia text NOT NULL,
    conta text NOT NULL,
    tipo_conta text DEFAULT 'Corrente'::text NOT NULL,
    titular text NOT NULL,
    titular_documento text,
    chave_pix text,
    situacao text DEFAULT 'ATIVA'::text NOT NULL,
    observacoes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sucata_contas_obra_situacao_check CHECK ((situacao = ANY (ARRAY['ATIVA'::text, 'INATIVA'::text])))
);

--
-- Name: sucata_destinatarios_relatorio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE imobpesagens.sucata_destinatarios_relatorio (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    coligada text NOT NULL,
    nome text NOT NULL,
    email text NOT NULL,
    papel text,
    ativo boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: sucata_eventos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE imobpesagens.sucata_eventos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    processo_id uuid,
    entidade text NOT NULL,
    entidade_id uuid,
    fase text,
    acao text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    coligada_origem text,
    usuario_id uuid,
    usuario_nome text,
    usuario_email text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: sucata_evidencias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE imobpesagens.sucata_evidencias (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    processo_id uuid NOT NULL,
    posicao integer NOT NULL,
    rotulo text NOT NULL,
    storage_path text NOT NULL,
    capturado_em timestamp with time zone DEFAULT now() NOT NULL,
    capturado_por uuid NOT NULL,
    lat numeric(9,6),
    lng numeric(9,6),
    versao integer DEFAULT 1 NOT NULL,
    substituida_por uuid,
    motivo_substituicao text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sucata_evidencias_posicao_check CHECK (((posicao >= 1) AND (posicao <= 12)))
);

--
-- Name: sucata_notificacoes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE imobpesagens.sucata_notificacoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    processo_id uuid NOT NULL,
    tipo text NOT NULL,
    destinatario text NOT NULL,
    assunto text NOT NULL,
    status text DEFAULT 'ENFILEIRADA'::text NOT NULL,
    provider_message_id text,
    erro text,
    enviada_em timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sucata_notificacoes_status_check CHECK ((status = ANY (ARRAY['ENFILEIRADA'::text, 'ENVIADA'::text, 'FALHA'::text]))),
    CONSTRAINT sucata_notificacoes_tipo_check CHECK ((tipo = ANY (ARRAY['ACEITE_PESO'::text, 'REENVIO_ACEITE'::text, 'CONTESTACAO_ADMIN'::text, 'ALERTA_SEM_RESPOSTA'::text, 'SOLICITACAO_NFA'::text, 'ENVIO_NFA'::text, 'AJUSTE_VALOR_NFA'::text])))
);

--
-- Name: sucata_numeracao; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE imobpesagens.sucata_numeracao (
    ano integer NOT NULL,
    ultimo integer DEFAULT 0 NOT NULL
);

--
-- Name: sucata_parametros; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE imobpesagens.sucata_parametros (
    chave text NOT NULL,
    valor text NOT NULL,
    descricao text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: sucata_processos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE imobpesagens.sucata_processos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    numero text NOT NULL,
    ano integer NOT NULL,
    obra_id uuid NOT NULL,
    coligada_origem text NOT NULL,
    sucateiro_id uuid NOT NULL,
    veiculo_id uuid,
    placa text NOT NULL,
    motorista text,
    documento_motorista text,
    snapshot_fiscal jsonb DEFAULT '{}'::jsonb NOT NULL,
    tara_kg numeric NOT NULL,
    bruto_kg numeric,
    peso_aferido_kg numeric GENERATED ALWAYS AS ((bruto_kg - tara_kg)) STORED,
    tipo_sucata_id uuid,
    fase text DEFAULT 'F01'::text NOT NULL,
    situacao text DEFAULT 'PENDENTE'::text NOT NULL,
    entrada_em timestamp with time zone DEFAULT now() NOT NULL,
    saida_em timestamp with time zone,
    created_by uuid,
    saida_por uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    peso_deposito_kg numeric,
    aceite_token_hash text,
    aceite_token_expira_em timestamp with time zone,
    aceite_em timestamp with time zone,
    aceite_ip inet,
    aceite_email text,
    contestacao_em timestamp with time zone,
    contestacao_motivo text,
    valor_total numeric(12,2),
    recibo_modo text,
    notificado_em timestamp with time zone,
    reenvio_em timestamp with time zone,
    alerta_admin_em timestamp with time zone,
    valor_por_tonelada numeric(12,2) GENERATED ALWAYS AS (
CASE
    WHEN ((valor_total IS NOT NULL) AND ((bruto_kg - tara_kg) > (0)::numeric)) THEN round((valor_total / ((bruto_kg - tara_kg) / 1000.0)), 2)
    ELSE NULL::numeric
END) STORED,
    aprovado_em timestamp with time zone,
    aprovado_por uuid,
    aprovacao_observacao text,
    devolvido_em timestamp with time zone,
    devolvido_por uuid,
    devolucao_motivo text,
    devolucao_fase_origem text,
    conta_obra_id uuid,
    pagamento_valor numeric(12,2),
    pagamento_data date,
    pagamento_conta_divergente boolean DEFAULT false NOT NULL,
    pagamento_justificativa text,
    pagamento_comprovante_hash text,
    pagamento_conta_lida text,
    recibo_valor_lido numeric(12,2),
    nfa_numero text,
    nfa_emissao date,
    nfa_storage_path text,
    nfa_enviada_em timestamp with time zone,
    nfa_impedimento_motivo text,
    nfa_solicitada_em timestamp with time zone,
    concluido_em timestamp with time zone,
    concluido_por uuid,
    relatorio_versao integer DEFAULT 0 NOT NULL,
    reaberto_em timestamp with time zone,
    reaberto_por uuid,
    reabertura_motivo text,
    teste_manual boolean DEFAULT false NOT NULL,
    descricao_carga text,
    excluido_em timestamp with time zone,
    excluido_por uuid,
    exclusao_motivo text,
    valor_unitario_kg numeric(12,4),
    valor_ajustado_por uuid,
    valor_ajustado_em timestamp with time zone,
    valor_ajuste_justificativa text,
    nfa_exportada_em timestamp with time zone,
    fases_registro jsonb DEFAULT '{}'::jsonb NOT NULL,
    nfa_natureza_operacao text,
    nfa_cfop text,
    nfa_formulario jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT sucata_processos_fase_check CHECK ((fase = ANY (ARRAY['F01'::text, 'F02'::text, 'F03'::text, 'F04'::text, 'F05'::text, 'F06'::text, 'F07'::text, 'F08'::text, 'F09'::text, 'F10'::text, 'F11'::text, 'F12'::text, 'F13'::text, 'F14'::text, 'F15'::text]))),
    CONSTRAINT sucata_processos_recibo_modo_chk CHECK (((recibo_modo IS NULL) OR (recibo_modo = ANY (ARRAY['SISTEMA'::text, 'PROPRIO'::text])))),
    CONSTRAINT sucata_processos_situacao_check CHECK ((situacao = ANY (ARRAY['PENDENTE'::text, 'CONCLUIDO'::text, 'BLOQUEADO'::text])))
);

--
-- Name: COLUMN sucata_processos.teste_manual; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN imobpesagens.sucata_processos.teste_manual IS 'Processo criado/preenchido manualmente para teste do fluxo por Admin/SuperAdmin.';

--
-- Name: COLUMN sucata_processos.valor_unitario_kg; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN imobpesagens.sucata_processos.valor_unitario_kg IS 'Valor por quilo usado neste processo (copiado do sucateiro na saída do caminhão).';

--
-- Name: COLUMN sucata_processos.fases_registro; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN imobpesagens.sucata_processos.fases_registro IS 'Registro de abertura e conclusão de cada fase: {"1":{"aberta_em":...,"aberta_nome":...,"fechada_em":...,"fechada_nome":...}}.';

--
-- Name: sucata_relatorios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE imobpesagens.sucata_relatorios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    processo_id uuid NOT NULL,
    versao integer NOT NULL,
    storage_path text NOT NULL,
    gerado_em timestamp with time zone DEFAULT now() NOT NULL,
    gerado_por uuid,
    enviado_para jsonb DEFAULT '[]'::jsonb NOT NULL,
    enviado_em timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: sucata_sucateiro_documentos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE imobpesagens.sucata_sucateiro_documentos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sucateiro_id uuid NOT NULL,
    tipo text NOT NULL,
    storage_path text NOT NULL,
    nome_arquivo text,
    validade date,
    versao integer DEFAULT 1 NOT NULL,
    motivo_substituicao text,
    vigente boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sucata_sucateiro_documentos_tipo_check CHECK ((tipo = ANY (ARRAY['CARTAO_CNPJ'::text, 'CONTRATO_SOCIAL'::text, 'CPF'::text, 'RG'::text, 'COMPROV_RESIDENCIA'::text, 'LICENCA_AMBIENTAL'::text, 'OUTRO'::text])))
);

--
-- Name: sucata_sucateiros; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE imobpesagens.sucata_sucateiros (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tipo_pessoa text NOT NULL,
    razao_social text,
    nome_fantasia text,
    nome_completo text,
    cnpj text,
    cpf text,
    rg text,
    orgao_emissor text,
    data_nascimento date,
    inscricao_estadual text,
    inscricao_municipal text,
    cnae text,
    cep text NOT NULL,
    logradouro text NOT NULL,
    numero text NOT NULL,
    complemento text,
    bairro text NOT NULL,
    municipio text NOT NULL,
    uf text NOT NULL,
    email_coleta text NOT NULL,
    email_financeiro text,
    telefone text NOT NULL,
    contato_responsavel text,
    banco text NOT NULL,
    agencia text NOT NULL,
    conta text NOT NULL,
    tipo_conta text NOT NULL,
    titularidade text NOT NULL,
    chave_pix text,
    situacao text DEFAULT 'EM_HOMOLOGACAO'::text NOT NULL,
    observacoes text,
    coligada_origem text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    valor_por_kg numeric(12,4),
    CONSTRAINT sucata_sucateiros_cnpj_valido CHECK (imobpesagens.sucata_valida_cnpj(cnpj)),
    CONSTRAINT sucata_sucateiros_cpf_valido CHECK (imobpesagens.sucata_valida_cpf(cpf)),
    CONSTRAINT sucata_sucateiros_pf_chk CHECK (((tipo_pessoa <> 'PF'::text) OR ((nome_completo IS NOT NULL) AND (cpf IS NOT NULL) AND (rg IS NOT NULL) AND (razao_social IS NULL) AND (cnpj IS NULL) AND (inscricao_estadual IS NULL)))),
    CONSTRAINT sucata_sucateiros_pj_chk CHECK (((tipo_pessoa <> 'PJ'::text) OR ((razao_social IS NOT NULL) AND (cnpj IS NOT NULL) AND (inscricao_estadual IS NOT NULL) AND (nome_completo IS NULL) AND (cpf IS NULL) AND (rg IS NULL)))),
    CONSTRAINT sucata_sucateiros_situacao_check CHECK ((situacao = ANY (ARRAY['EM_HOMOLOGACAO'::text, 'ATIVO'::text, 'BLOQUEADO'::text]))),
    CONSTRAINT sucata_sucateiros_tipo_pessoa_check CHECK ((tipo_pessoa = ANY (ARRAY['PJ'::text, 'PF'::text])))
);

--
-- Name: COLUMN sucata_sucateiros.valor_por_kg; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN imobpesagens.sucata_sucateiros.valor_por_kg IS 'Valor pago por quilo de sucata (R$/kg), usado no cálculo automático do valor total da coleta.';

--
-- Name: sucata_tipos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE imobpesagens.sucata_tipos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo text NOT NULL,
    nome text NOT NULL,
    ordem integer DEFAULT 0 NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    valor_ton_min numeric(12,2),
    valor_ton_max numeric(12,2)
);

--
-- Name: sucata_veiculos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE imobpesagens.sucata_veiculos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sucateiro_id uuid NOT NULL,
    placa text NOT NULL,
    tipo_veiculo text,
    capacidade_kg integer,
    motorista_habitual text,
    situacao text DEFAULT 'ATIVO'::text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sucata_veiculos_situacao_check CHECK ((situacao = ANY (ARRAY['ATIVO'::text, 'BLOQUEADO'::text])))
);

--
-- Name: tolerancias_fornecedor; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE imobpesagens.tolerancias_fornecedor (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fornecedor_id uuid NOT NULL,
    tolerancia_material_id uuid NOT NULL,
    tolerancia numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: tolerancias_fornecedor_v2; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE imobpesagens.tolerancias_fornecedor_v2 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fornecedor_id uuid NOT NULL,
    tolerancia_padrao_id uuid NOT NULL,
    tolerancia numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

--
-- Name: tolerancias_material; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE imobpesagens.tolerancias_material (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    categoria text NOT NULL,
    condicao text NOT NULL,
    palavras_chave text DEFAULT ''::text NOT NULL,
    tolerancia_pct numeric DEFAULT 3 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tolerancias_material_condicao_check CHECK ((condicao = ANY (ARRAY['seco'::text, 'umido'::text, 'na'::text])))
);

--
-- Name: tolerancias_padrao; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE imobpesagens.tolerancias_padrao (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    categoria text NOT NULL,
    condicao text DEFAULT 'Seco'::text NOT NULL,
    palavras_chave text,
    tolerancia numeric DEFAULT 2 NOT NULL,
    ordem integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT tolerancias_padrao_condicao_check CHECK ((condicao = ANY (ARRAY['Seco'::text, 'Úmido'::text])))
);

--
-- Name: tracos_concreto; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE imobpesagens.tracos_concreto (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fornecedor_id uuid NOT NULL,
    codigo text,
    fck numeric,
    aplicacao text,
    slump_nominal numeric,
    slump_unidade text DEFAULT 'cm'::text,
    slump_tolerancia numeric,
    densidade_teorica numeric,
    densidade_pratica numeric,
    tolerancia_peso numeric,
    match_keywords text[] DEFAULT '{}'::text[],
    carta_arquivo_url text,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    consumo_cimento numeric,
    CONSTRAINT tracos_concreto_slump_unidade_check CHECK ((slump_unidade = ANY (ARRAY['cm'::text, 'mm'::text])))
);

--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE imobpesagens.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role imobpesagens.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: usuario_coligadas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE imobpesagens.usuario_coligadas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    codcoligada text NOT NULL,
    nome text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    engenheiro_responsavel boolean DEFAULT false NOT NULL
);

--
-- Name: whatsapp_alertas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE imobpesagens.whatsapp_alertas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pesagem_id uuid NOT NULL,
    tipo_alerta text DEFAULT 'alerta_tolerancia_acima'::text NOT NULL,
    obra_id uuid,
    coligada text,
    placa text,
    ocorrencia_ref text,
    destinatario_user_id uuid,
    destinatario_nome text,
    telefone text,
    template text,
    template_idioma text,
    variaveis jsonb DEFAULT '[]'::jsonb NOT NULL,
    status text DEFAULT 'pendente'::text NOT NULL,
    meta_message_id text,
    erro_detalhe text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    mensagem_texto text,
    campos_enviados jsonb,
    template_id text,
    template_nome_real text,
    reenvio_manual boolean DEFAULT false NOT NULL,
    destinatario_email text
);

--
-- Name: whatsapp_automacao_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE imobpesagens.whatsapp_automacao_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    respostas_automaticas jsonb DEFAULT '[]'::jsonb NOT NULL,
    horario_inicio text DEFAULT '08:00'::text,
    horario_fim text DEFAULT '18:00'::text,
    msg_fora_horario text,
    ia_modelo text DEFAULT 'google/gemini-3.7-flash'::text,
    ia_temperatura numeric DEFAULT 0.7,
    ia_max_tokens integer DEFAULT 1024,
    ia_prompt_base text,
    notif_novas_msgs boolean DEFAULT false,
    notif_docs_recebidos boolean DEFAULT false,
    notif_erros boolean DEFAULT true,
    notif_relatorio_diario boolean DEFAULT false,
    notif_email text,
    debug_mode boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: whatsapp_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE imobpesagens.whatsapp_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provedor text DEFAULT 'zenvia'::text NOT NULL,
    api_url text,
    api_token text,
    sender_id text,
    instance_name text,
    webhook_url text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    meta_phone_number_id text,
    meta_waba_id text,
    meta_display_name text,
    alertas_tolerancia_ativo boolean DEFAULT false NOT NULL,
    alerta_template_nome text DEFAULT 'alerta_pesagem_acima_tolerancia'::text,
    alerta_template_idioma text DEFAULT 'pt_BR'::text,
    alerta_template_id text
);

--
-- Name: whatsapp_mensagens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE imobpesagens.whatsapp_mensagens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contato_whatsapp text NOT NULL,
    contato_nome text,
    contato_email text,
    obra_id uuid,
    mensagem text NOT NULL,
    direcao text DEFAULT 'enviada'::text NOT NULL,
    tipo text DEFAULT 'texto'::text,
    status text,
    provider_message_id text,
    arquivo_url text,
    arquivo_nome text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: whatsapp_numeros; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE imobpesagens.whatsapp_numeros (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    label text NOT NULL,
    provedor text DEFAULT 'zenvia'::text NOT NULL,
    api_url text,
    api_token text,
    sender_id text,
    instance_name text,
    status text DEFAULT 'ativo'::text NOT NULL,
    prioridade integer DEFAULT 1 NOT NULL,
    limite_diario integer DEFAULT 1000 NOT NULL,
    enviados_hoje integer DEFAULT 0 NOT NULL,
    health_score integer DEFAULT 100 NOT NULL,
    janela_inicio text DEFAULT '08:00'::text,
    janela_fim text DEFAULT '18:00'::text,
    ultimo_check_em timestamp with time zone,
    ultima_falha_em timestamp with time zone,
    reset_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: whatsapp_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE imobpesagens.whatsapp_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    funcao_key text NOT NULL,
    funcao_label text NOT NULL,
    descricao text,
    template_id text,
    sender_id text,
    sender_phone text,
    sender_status text,
    variaveis text[] DEFAULT '{}'::text[] NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: densidades_fornecedor densidades_fornecedor_densidade_material_id_fornecedor_nome_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.densidades_fornecedor
    ADD CONSTRAINT densidades_fornecedor_densidade_material_id_fornecedor_nome_key UNIQUE (densidade_material_id, fornecedor_nome);

--
-- Name: densidades_fornecedor densidades_fornecedor_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.densidades_fornecedor
    ADD CONSTRAINT densidades_fornecedor_pkey PRIMARY KEY (id);

--
-- Name: densidades_material densidades_material_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.densidades_material
    ADD CONSTRAINT densidades_material_pkey PRIMARY KEY (id);

--
-- Name: evidencias evidencias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.evidencias
    ADD CONSTRAINT evidencias_pkey PRIMARY KEY (id);

--
-- Name: fornecedores_concreto fornecedores_concreto_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.fornecedores_concreto
    ADD CONSTRAINT fornecedores_concreto_pkey PRIMARY KEY (id);

--
-- Name: fornecedores_material fornecedores_material_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.fornecedores_material
    ADD CONSTRAINT fornecedores_material_pkey PRIMARY KEY (id);

--
-- Name: fornecedores_material_v2 fornecedores_material_v2_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.fornecedores_material_v2
    ADD CONSTRAINT fornecedores_material_v2_pkey PRIMARY KEY (id);

--
-- Name: notas_fiscais notas_fiscais_chave_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.notas_fiscais
    ADD CONSTRAINT notas_fiscais_chave_key UNIQUE (chave);

--
-- Name: notas_fiscais notas_fiscais_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.notas_fiscais
    ADD CONSTRAINT notas_fiscais_pkey PRIMARY KEY (id);

--
-- Name: obra_acessos obra_acessos_obra_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.obra_acessos
    ADD CONSTRAINT obra_acessos_obra_id_user_id_key UNIQUE (obra_id, user_id);

--
-- Name: obra_acessos obra_acessos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.obra_acessos
    ADD CONSTRAINT obra_acessos_pkey PRIMARY KEY (id);

--
-- Name: obras obras_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.obras
    ADD CONSTRAINT obras_pkey PRIMARY KEY (id);

--
-- Name: perfil_descricoes perfil_descricoes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.perfil_descricoes
    ADD CONSTRAINT perfil_descricoes_pkey PRIMARY KEY (role);

--
-- Name: perfil_menu_permissoes perfil_menu_permissoes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.perfil_menu_permissoes
    ADD CONSTRAINT perfil_menu_permissoes_pkey PRIMARY KEY (id);

--
-- Name: perfil_menu_permissoes perfil_menu_permissoes_role_menu_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.perfil_menu_permissoes
    ADD CONSTRAINT perfil_menu_permissoes_role_menu_key_key UNIQUE (role, menu_key);

--
-- Name: pesagem_logs pesagem_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.pesagem_logs
    ADD CONSTRAINT pesagem_logs_pkey PRIMARY KEY (id);

--
-- Name: pesagens pesagens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.pesagens
    ADD CONSTRAINT pesagens_pkey PRIMARY KEY (id);

--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);

--
-- Name: sefaz_certificados sefaz_certificados_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.sefaz_certificados
    ADD CONSTRAINT sefaz_certificados_pkey PRIMARY KEY (id);

--
-- Name: sucata_cfop sucata_cfop_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.sucata_cfop
    ADD CONSTRAINT sucata_cfop_codigo_key UNIQUE (codigo);

--
-- Name: sucata_cfop sucata_cfop_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.sucata_cfop
    ADD CONSTRAINT sucata_cfop_pkey PRIMARY KEY (id);

--
-- Name: sucata_contas_obra sucata_contas_obra_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.sucata_contas_obra
    ADD CONSTRAINT sucata_contas_obra_pkey PRIMARY KEY (id);

--
-- Name: sucata_destinatarios_relatorio sucata_destinatarios_relatorio_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.sucata_destinatarios_relatorio
    ADD CONSTRAINT sucata_destinatarios_relatorio_pkey PRIMARY KEY (id);

--
-- Name: sucata_eventos sucata_eventos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.sucata_eventos
    ADD CONSTRAINT sucata_eventos_pkey PRIMARY KEY (id);

--
-- Name: sucata_evidencias sucata_evidencias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.sucata_evidencias
    ADD CONSTRAINT sucata_evidencias_pkey PRIMARY KEY (id);

--
-- Name: sucata_notificacoes sucata_notificacoes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.sucata_notificacoes
    ADD CONSTRAINT sucata_notificacoes_pkey PRIMARY KEY (id);

--
-- Name: sucata_numeracao sucata_numeracao_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.sucata_numeracao
    ADD CONSTRAINT sucata_numeracao_pkey PRIMARY KEY (ano);

--
-- Name: sucata_parametros sucata_parametros_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.sucata_parametros
    ADD CONSTRAINT sucata_parametros_pkey PRIMARY KEY (chave);

--
-- Name: sucata_processos sucata_processos_numero_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.sucata_processos
    ADD CONSTRAINT sucata_processos_numero_key UNIQUE (numero);

--
-- Name: sucata_processos sucata_processos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.sucata_processos
    ADD CONSTRAINT sucata_processos_pkey PRIMARY KEY (id);

--
-- Name: sucata_relatorios sucata_relatorios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.sucata_relatorios
    ADD CONSTRAINT sucata_relatorios_pkey PRIMARY KEY (id);

--
-- Name: sucata_sucateiro_documentos sucata_sucateiro_documentos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.sucata_sucateiro_documentos
    ADD CONSTRAINT sucata_sucateiro_documentos_pkey PRIMARY KEY (id);

--
-- Name: sucata_sucateiros sucata_sucateiros_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.sucata_sucateiros
    ADD CONSTRAINT sucata_sucateiros_pkey PRIMARY KEY (id);

--
-- Name: sucata_tipos sucata_tipos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.sucata_tipos
    ADD CONSTRAINT sucata_tipos_pkey PRIMARY KEY (id);

--
-- Name: sucata_veiculos sucata_veiculos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.sucata_veiculos
    ADD CONSTRAINT sucata_veiculos_pkey PRIMARY KEY (id);

--
-- Name: tolerancias_fornecedor tolerancias_fornecedor_fornecedor_id_tolerancia_material_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.tolerancias_fornecedor
    ADD CONSTRAINT tolerancias_fornecedor_fornecedor_id_tolerancia_material_id_key UNIQUE (fornecedor_id, tolerancia_material_id);

--
-- Name: tolerancias_fornecedor tolerancias_fornecedor_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.tolerancias_fornecedor
    ADD CONSTRAINT tolerancias_fornecedor_pkey PRIMARY KEY (id);

--
-- Name: tolerancias_fornecedor_v2 tolerancias_fornecedor_v2_fornecedor_id_tolerancia_padrao_i_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.tolerancias_fornecedor_v2
    ADD CONSTRAINT tolerancias_fornecedor_v2_fornecedor_id_tolerancia_padrao_i_key UNIQUE (fornecedor_id, tolerancia_padrao_id);

--
-- Name: tolerancias_fornecedor_v2 tolerancias_fornecedor_v2_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.tolerancias_fornecedor_v2
    ADD CONSTRAINT tolerancias_fornecedor_v2_pkey PRIMARY KEY (id);

--
-- Name: tolerancias_material tolerancias_material_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.tolerancias_material
    ADD CONSTRAINT tolerancias_material_pkey PRIMARY KEY (id);

--
-- Name: tolerancias_padrao tolerancias_padrao_categoria_condicao_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.tolerancias_padrao
    ADD CONSTRAINT tolerancias_padrao_categoria_condicao_key UNIQUE (categoria, condicao);

--
-- Name: tolerancias_padrao tolerancias_padrao_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.tolerancias_padrao
    ADD CONSTRAINT tolerancias_padrao_pkey PRIMARY KEY (id);

--
-- Name: tracos_concreto tracos_concreto_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.tracos_concreto
    ADD CONSTRAINT tracos_concreto_pkey PRIMARY KEY (id);

--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);

--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);

--
-- Name: usuario_coligadas usuario_coligadas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.usuario_coligadas
    ADD CONSTRAINT usuario_coligadas_pkey PRIMARY KEY (id);

--
-- Name: usuario_coligadas usuario_coligadas_user_id_codcoligada_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.usuario_coligadas
    ADD CONSTRAINT usuario_coligadas_user_id_codcoligada_key UNIQUE (user_id, codcoligada);

--
-- Name: whatsapp_alertas whatsapp_alertas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.whatsapp_alertas
    ADD CONSTRAINT whatsapp_alertas_pkey PRIMARY KEY (id);

--
-- Name: whatsapp_automacao_config whatsapp_automacao_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.whatsapp_automacao_config
    ADD CONSTRAINT whatsapp_automacao_config_pkey PRIMARY KEY (id);

--
-- Name: whatsapp_config whatsapp_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.whatsapp_config
    ADD CONSTRAINT whatsapp_config_pkey PRIMARY KEY (id);

--
-- Name: whatsapp_mensagens whatsapp_mensagens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.whatsapp_mensagens
    ADD CONSTRAINT whatsapp_mensagens_pkey PRIMARY KEY (id);

--
-- Name: whatsapp_numeros whatsapp_numeros_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.whatsapp_numeros
    ADD CONSTRAINT whatsapp_numeros_pkey PRIMARY KEY (id);

--
-- Name: whatsapp_templates whatsapp_templates_funcao_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.whatsapp_templates
    ADD CONSTRAINT whatsapp_templates_funcao_key_key UNIQUE (funcao_key);

--
-- Name: whatsapp_templates whatsapp_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.whatsapp_templates
    ADD CONSTRAINT whatsapp_templates_pkey PRIMARY KEY (id);

--
-- Name: idx_pesagem_logs_pesagem; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pesagem_logs_pesagem ON imobpesagens.pesagem_logs USING btree (pesagem_id, created_at DESC);

--
-- Name: idx_pesagens_chave_nfe; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pesagens_chave_nfe ON imobpesagens.pesagens USING btree (chave_nfe);

--
-- Name: idx_pesagens_contratante; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pesagens_contratante ON imobpesagens.pesagens USING btree (contratante);

--
-- Name: idx_pesagens_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pesagens_created_at ON imobpesagens.pesagens USING btree (created_at DESC);

--
-- Name: idx_pesagens_emissor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pesagens_emissor ON imobpesagens.pesagens USING btree (emissor);

--
-- Name: idx_pesagens_obra_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pesagens_obra_id ON imobpesagens.pesagens USING btree (obra_id);

--
-- Name: idx_sucata_contas_obra_coligada; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sucata_contas_obra_coligada ON imobpesagens.sucata_contas_obra USING btree (coligada_origem);

--
-- Name: idx_sucata_contas_obra_obra; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sucata_contas_obra_obra ON imobpesagens.sucata_contas_obra USING btree (obra_id, situacao);

--
-- Name: idx_sucata_processos_comprovante_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sucata_processos_comprovante_hash ON imobpesagens.sucata_processos USING btree (pagamento_comprovante_hash) WHERE (pagamento_comprovante_hash IS NOT NULL);

--
-- Name: idx_usuario_coligadas_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usuario_coligadas_user ON imobpesagens.usuario_coligadas USING btree (user_id);

--
-- Name: idx_wa_msg_contato; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wa_msg_contato ON imobpesagens.whatsapp_mensagens USING btree (contato_whatsapp, created_at DESC);

--
-- Name: ix_evidencias_pesagem; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_evidencias_pesagem ON imobpesagens.evidencias USING btree (pesagem_id);

--
-- Name: ix_notas_chave; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_notas_chave ON imobpesagens.notas_fiscais USING btree (chave);

--
-- Name: ix_notas_obra; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_notas_obra ON imobpesagens.notas_fiscais USING btree (obra_id);

--
-- Name: ix_obra_acessos_uid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_obra_acessos_uid ON imobpesagens.obra_acessos USING btree (user_id);

--
-- Name: ix_pesagens_chave_nfe; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_pesagens_chave_nfe ON imobpesagens.pesagens USING btree (chave_nfe);

--
-- Name: ix_pesagens_contratante; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_pesagens_contratante ON imobpesagens.pesagens USING btree (contratante);

--
-- Name: ix_pesagens_dash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_pesagens_dash ON imobpesagens.pesagens USING btree (obra_id, status, COALESCE(saiu_em, created_at));

--
-- Name: ix_pesagens_emissor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_pesagens_emissor ON imobpesagens.pesagens USING btree (emissor);

--
-- Name: ix_pesagens_obra_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_pesagens_obra_created ON imobpesagens.pesagens USING btree (obra_id, created_at DESC);

--
-- Name: ix_pesagens_obra_saiu; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_pesagens_obra_saiu ON imobpesagens.pesagens USING btree (obra_id, saiu_em);

--
-- Name: ix_pesagens_obra_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_pesagens_obra_status ON imobpesagens.pesagens USING btree (obra_id, status);

--
-- Name: ix_user_roles_uid_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_user_roles_uid_role ON imobpesagens.user_roles USING btree (user_id, role);

--
-- Name: pesagem_logs_pesagem_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pesagem_logs_pesagem_idx ON imobpesagens.pesagem_logs USING btree (pesagem_id, created_at DESC);

--
-- Name: sucata_dest_rel_coligada_email_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sucata_dest_rel_coligada_email_uidx ON imobpesagens.sucata_destinatarios_relatorio USING btree (coligada, lower(email));

--
-- Name: sucata_doc_sucateiro_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sucata_doc_sucateiro_idx ON imobpesagens.sucata_sucateiro_documentos USING btree (sucateiro_id);

--
-- Name: sucata_ev_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sucata_ev_created_idx ON imobpesagens.sucata_eventos USING btree (created_at DESC);

--
-- Name: sucata_ev_entidade_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sucata_ev_entidade_idx ON imobpesagens.sucata_eventos USING btree (entidade, entidade_id);

--
-- Name: sucata_ev_processo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sucata_ev_processo_idx ON imobpesagens.sucata_eventos USING btree (processo_id);

--
-- Name: sucata_evidencias_posicao_vigente_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sucata_evidencias_posicao_vigente_uidx ON imobpesagens.sucata_evidencias USING btree (processo_id, posicao) WHERE (substituida_por IS NULL);

--
-- Name: sucata_evidencias_processo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sucata_evidencias_processo_idx ON imobpesagens.sucata_evidencias USING btree (processo_id);

--
-- Name: sucata_notificacoes_processo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sucata_notificacoes_processo_idx ON imobpesagens.sucata_notificacoes USING btree (processo_id, created_at DESC);

--
-- Name: sucata_proc_coligada_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sucata_proc_coligada_idx ON imobpesagens.sucata_processos USING btree (coligada_origem);

--
-- Name: sucata_proc_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sucata_proc_created_idx ON imobpesagens.sucata_processos USING btree (created_at DESC);

--
-- Name: sucata_proc_excluido_em_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sucata_proc_excluido_em_idx ON imobpesagens.sucata_processos USING btree (excluido_em) WHERE (excluido_em IS NOT NULL);

--
-- Name: sucata_proc_obra_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sucata_proc_obra_idx ON imobpesagens.sucata_processos USING btree (obra_id);

--
-- Name: sucata_proc_placa_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sucata_proc_placa_idx ON imobpesagens.sucata_processos USING btree (upper(placa));

--
-- Name: sucata_proc_situacao_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sucata_proc_situacao_idx ON imobpesagens.sucata_processos USING btree (situacao);

--
-- Name: sucata_proc_sucateiro_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sucata_proc_sucateiro_idx ON imobpesagens.sucata_processos USING btree (sucateiro_id);

--
-- Name: sucata_proc_tipo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sucata_proc_tipo_idx ON imobpesagens.sucata_processos USING btree (tipo_sucata_id);

--
-- Name: sucata_proc_veiculo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sucata_proc_veiculo_idx ON imobpesagens.sucata_processos USING btree (veiculo_id);

--
-- Name: sucata_processos_aceite_pendente_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sucata_processos_aceite_pendente_idx ON imobpesagens.sucata_processos USING btree (notificado_em) WHERE ((aceite_em IS NULL) AND (aceite_token_hash IS NOT NULL));

--
-- Name: sucata_processos_aceite_token_hash_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sucata_processos_aceite_token_hash_uidx ON imobpesagens.sucata_processos USING btree (aceite_token_hash) WHERE (aceite_token_hash IS NOT NULL);

--
-- Name: sucata_relatorios_processo_versao_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sucata_relatorios_processo_versao_uidx ON imobpesagens.sucata_relatorios USING btree (processo_id, versao);

--
-- Name: sucata_sucateiros_cnpj_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sucata_sucateiros_cnpj_uidx ON imobpesagens.sucata_sucateiros USING btree (cnpj) WHERE (cnpj IS NOT NULL);

--
-- Name: sucata_sucateiros_coligada_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sucata_sucateiros_coligada_idx ON imobpesagens.sucata_sucateiros USING btree (coligada_origem);

--
-- Name: sucata_sucateiros_cpf_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sucata_sucateiros_cpf_uidx ON imobpesagens.sucata_sucateiros USING btree (cpf) WHERE (cpf IS NOT NULL);

--
-- Name: sucata_sucateiros_situacao_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sucata_sucateiros_situacao_idx ON imobpesagens.sucata_sucateiros USING btree (situacao);

--
-- Name: sucata_tipos_codigo_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sucata_tipos_codigo_uidx ON imobpesagens.sucata_tipos USING btree (upper(codigo));

--
-- Name: sucata_veiculos_placa_ativa_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sucata_veiculos_placa_ativa_uidx ON imobpesagens.sucata_veiculos USING btree (upper(placa)) WHERE (situacao = 'ATIVO'::text);

--
-- Name: sucata_veiculos_placa_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sucata_veiculos_placa_idx ON imobpesagens.sucata_veiculos USING btree (upper(placa));

--
-- Name: sucata_veiculos_sucateiro_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sucata_veiculos_sucateiro_idx ON imobpesagens.sucata_veiculos USING btree (sucateiro_id);

--
-- Name: tolerancias_material_cat_cond_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tolerancias_material_cat_cond_idx ON imobpesagens.tolerancias_material USING btree (lower(categoria), condicao);

--
-- Name: tracos_concreto_fornecedor_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tracos_concreto_fornecedor_id_idx ON imobpesagens.tracos_concreto USING btree (fornecedor_id);

--
-- Name: usuario_coligadas_eng_resp_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX usuario_coligadas_eng_resp_idx ON imobpesagens.usuario_coligadas USING btree (codcoligada) WHERE engenheiro_responsavel;

--
-- Name: whatsapp_alertas_meta_msg_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX whatsapp_alertas_meta_msg_idx ON imobpesagens.whatsapp_alertas USING btree (meta_message_id);

--
-- Name: whatsapp_alertas_unico; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX whatsapp_alertas_unico ON imobpesagens.whatsapp_alertas USING btree (pesagem_id, tipo_alerta, destinatario_user_id);

--
-- Name: densidades_fornecedor trg_densidades_fornecedor_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_densidades_fornecedor_updated BEFORE UPDATE ON imobpesagens.densidades_fornecedor FOR EACH ROW EXECUTE FUNCTION imobpesagens.set_updated_at();

--
-- Name: densidades_material trg_densidades_material_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_densidades_material_updated BEFORE UPDATE ON imobpesagens.densidades_material FOR EACH ROW EXECUTE FUNCTION imobpesagens.set_updated_at();

--
-- Name: fornecedores_material trg_fornecedores_material_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fornecedores_material_updated BEFORE UPDATE ON imobpesagens.fornecedores_material FOR EACH ROW EXECUTE FUNCTION imobpesagens.set_updated_at();

--
-- Name: notas_fiscais trg_notas_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notas_updated BEFORE UPDATE ON imobpesagens.notas_fiscais FOR EACH ROW EXECUTE FUNCTION imobpesagens.set_updated_at();

--
-- Name: obras trg_obras_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_obras_updated BEFORE UPDATE ON imobpesagens.obras FOR EACH ROW EXECUTE FUNCTION imobpesagens.set_updated_at();

--
-- Name: perfil_descricoes trg_perfil_descricoes_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_perfil_descricoes_updated BEFORE UPDATE ON imobpesagens.perfil_descricoes FOR EACH ROW EXECUTE FUNCTION imobpesagens.set_updated_at();

--
-- Name: perfil_menu_permissoes trg_perfil_menu_permissoes_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_perfil_menu_permissoes_updated BEFORE UPDATE ON imobpesagens.perfil_menu_permissoes FOR EACH ROW EXECUTE FUNCTION imobpesagens.set_updated_at();

--
-- Name: pesagens trg_pesagens_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pesagens_updated BEFORE UPDATE ON imobpesagens.pesagens FOR EACH ROW EXECUTE FUNCTION imobpesagens.set_updated_at();

--
-- Name: profiles trg_profiles_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON imobpesagens.profiles FOR EACH ROW EXECUTE FUNCTION imobpesagens.set_updated_at();

--
-- Name: sefaz_certificados trg_sefaz_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sefaz_updated BEFORE UPDATE ON imobpesagens.sefaz_certificados FOR EACH ROW EXECUTE FUNCTION imobpesagens.set_updated_at();

--
-- Name: sucata_cfop trg_sucata_cfop_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sucata_cfop_updated BEFORE UPDATE ON imobpesagens.sucata_cfop FOR EACH ROW EXECUTE FUNCTION imobpesagens.set_updated_at();

--
-- Name: sucata_contas_obra trg_sucata_contas_obra_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sucata_contas_obra_updated BEFORE UPDATE ON imobpesagens.sucata_contas_obra FOR EACH ROW EXECUTE FUNCTION imobpesagens.set_updated_at();

--
-- Name: sucata_destinatarios_relatorio trg_sucata_dest_rel_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sucata_dest_rel_updated BEFORE UPDATE ON imobpesagens.sucata_destinatarios_relatorio FOR EACH ROW EXECUTE FUNCTION imobpesagens.set_updated_at();

--
-- Name: sucata_processos trg_sucata_encerramento; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sucata_encerramento BEFORE UPDATE ON imobpesagens.sucata_processos FOR EACH ROW EXECUTE FUNCTION imobpesagens.sucata_encerramento_trg();

--
-- Name: sucata_evidencias trg_sucata_evidencia_processo_aberto; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sucata_evidencia_processo_aberto BEFORE INSERT OR UPDATE ON imobpesagens.sucata_evidencias FOR EACH ROW EXECUTE FUNCTION imobpesagens.sucata_evidencia_processo_aberto_trg();

--
-- Name: sucata_evidencias trg_sucata_evidencias_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sucata_evidencias_updated BEFORE UPDATE ON imobpesagens.sucata_evidencias FOR EACH ROW EXECUTE FUNCTION imobpesagens.set_updated_at();

--
-- Name: sucata_processos trg_sucata_nfa_exige_aprovacao; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sucata_nfa_exige_aprovacao BEFORE UPDATE ON imobpesagens.sucata_processos FOR EACH ROW EXECUTE FUNCTION imobpesagens.sucata_nfa_exige_aprovacao_trg();

--
-- Name: sucata_parametros trg_sucata_parametros_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sucata_parametros_updated BEFORE UPDATE ON imobpesagens.sucata_parametros FOR EACH ROW EXECUTE FUNCTION imobpesagens.set_updated_at();

--
-- Name: sucata_processos trg_sucata_pesos_imutaveis; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sucata_pesos_imutaveis BEFORE UPDATE ON imobpesagens.sucata_processos FOR EACH ROW EXECUTE FUNCTION imobpesagens.sucata_pesos_imutaveis_trg();

--
-- Name: sucata_processos trg_sucata_processos_numero; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sucata_processos_numero BEFORE INSERT ON imobpesagens.sucata_processos FOR EACH ROW EXECUTE FUNCTION imobpesagens.sucata_processos_numero_trg();

--
-- Name: sucata_processos trg_sucata_processos_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sucata_processos_updated BEFORE UPDATE ON imobpesagens.sucata_processos FOR EACH ROW EXECUTE FUNCTION imobpesagens.set_updated_at();

--
-- Name: sucata_processos trg_sucata_proteger_exclusao_logica; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sucata_proteger_exclusao_logica BEFORE UPDATE OF excluido_em, excluido_por, exclusao_motivo ON imobpesagens.sucata_processos FOR EACH ROW EXECUTE FUNCTION imobpesagens.sucata_proteger_exclusao_logica_trg();

--
-- Name: sucata_relatorios trg_sucata_relatorios_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sucata_relatorios_updated BEFORE UPDATE ON imobpesagens.sucata_relatorios FOR EACH ROW EXECUTE FUNCTION imobpesagens.set_updated_at();

--
-- Name: sucata_sucateiros trg_sucata_sucateiros_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sucata_sucateiros_updated BEFORE UPDATE ON imobpesagens.sucata_sucateiros FOR EACH ROW EXECUTE FUNCTION imobpesagens.set_updated_at();

--
-- Name: sucata_tipos trg_sucata_tipos_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sucata_tipos_updated BEFORE UPDATE ON imobpesagens.sucata_tipos FOR EACH ROW EXECUTE FUNCTION imobpesagens.set_updated_at();

--
-- Name: sucata_processos trg_sucata_valida_bruto; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sucata_valida_bruto BEFORE UPDATE ON imobpesagens.sucata_processos FOR EACH ROW EXECUTE FUNCTION imobpesagens.sucata_valida_bruto_trg();

--
-- Name: sucata_processos trg_sucata_valor_somente_portal; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sucata_valor_somente_portal BEFORE UPDATE ON imobpesagens.sucata_processos FOR EACH ROW EXECUTE FUNCTION imobpesagens.sucata_valor_somente_portal_trg();

--
-- Name: sucata_veiculos trg_sucata_veiculos_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sucata_veiculos_updated BEFORE UPDATE ON imobpesagens.sucata_veiculos FOR EACH ROW EXECUTE FUNCTION imobpesagens.set_updated_at();

--
-- Name: tolerancias_fornecedor trg_tolerancias_fornecedor_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tolerancias_fornecedor_updated BEFORE UPDATE ON imobpesagens.tolerancias_fornecedor FOR EACH ROW EXECUTE FUNCTION imobpesagens.set_updated_at();

--
-- Name: tolerancias_material trg_tolerancias_material_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tolerancias_material_updated BEFORE UPDATE ON imobpesagens.tolerancias_material FOR EACH ROW EXECUTE FUNCTION imobpesagens.set_updated_at();

--
-- Name: whatsapp_automacao_config trg_wa_auto_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_wa_auto_updated BEFORE UPDATE ON imobpesagens.whatsapp_automacao_config FOR EACH ROW EXECUTE FUNCTION imobpesagens.set_updated_at();

--
-- Name: whatsapp_config trg_wa_config_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_wa_config_updated BEFORE UPDATE ON imobpesagens.whatsapp_config FOR EACH ROW EXECUTE FUNCTION imobpesagens.set_updated_at();

--
-- Name: whatsapp_mensagens trg_wa_msg_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_wa_msg_updated BEFORE UPDATE ON imobpesagens.whatsapp_mensagens FOR EACH ROW EXECUTE FUNCTION imobpesagens.set_updated_at();

--
-- Name: whatsapp_numeros trg_wa_num_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_wa_num_updated BEFORE UPDATE ON imobpesagens.whatsapp_numeros FOR EACH ROW EXECUTE FUNCTION imobpesagens.set_updated_at();

--
-- Name: whatsapp_templates trg_wa_tpl_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_wa_tpl_updated BEFORE UPDATE ON imobpesagens.whatsapp_templates FOR EACH ROW EXECUTE FUNCTION imobpesagens.set_updated_at();

--
-- Name: whatsapp_alertas trg_whatsapp_alertas_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_whatsapp_alertas_updated BEFORE UPDATE ON imobpesagens.whatsapp_alertas FOR EACH ROW EXECUTE FUNCTION imobpesagens.set_updated_at();

--
-- Name: fornecedores_material_v2 update_fornecedores_material_v2_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_fornecedores_material_v2_updated_at BEFORE UPDATE ON imobpesagens.fornecedores_material_v2 FOR EACH ROW EXECUTE FUNCTION imobpesagens.update_updated_at_column();

--
-- Name: densidades_fornecedor densidades_fornecedor_densidade_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.densidades_fornecedor
    ADD CONSTRAINT densidades_fornecedor_densidade_material_id_fkey FOREIGN KEY (densidade_material_id) REFERENCES imobpesagens.densidades_material(id) ON DELETE CASCADE;

--
-- Name: evidencias evidencias_pesagem_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.evidencias
    ADD CONSTRAINT evidencias_pesagem_id_fkey FOREIGN KEY (pesagem_id) REFERENCES imobpesagens.pesagens(id) ON DELETE CASCADE;

--
-- Name: fornecedores_material_v2 fornecedores_material_v2_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.fornecedores_material_v2
    ADD CONSTRAINT fornecedores_material_v2_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);

--
-- Name: notas_fiscais notas_fiscais_obra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.notas_fiscais
    ADD CONSTRAINT notas_fiscais_obra_id_fkey FOREIGN KEY (obra_id) REFERENCES imobpesagens.obras(id);

--
-- Name: obra_acessos obra_acessos_obra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.obra_acessos
    ADD CONSTRAINT obra_acessos_obra_id_fkey FOREIGN KEY (obra_id) REFERENCES imobpesagens.obras(id) ON DELETE CASCADE;

--
-- Name: obra_acessos obra_acessos_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.obra_acessos
    ADD CONSTRAINT obra_acessos_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: pesagem_logs pesagem_logs_pesagem_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.pesagem_logs
    ADD CONSTRAINT pesagem_logs_pesagem_id_fkey FOREIGN KEY (pesagem_id) REFERENCES imobpesagens.pesagens(id) ON DELETE CASCADE;

--
-- Name: pesagens pesagens_criado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.pesagens
    ADD CONSTRAINT pesagens_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES auth.users(id);

--
-- Name: pesagens pesagens_obra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.pesagens
    ADD CONSTRAINT pesagens_obra_id_fkey FOREIGN KEY (obra_id) REFERENCES imobpesagens.obras(id);

--
-- Name: pesagens pesagens_ocorrencia_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.pesagens
    ADD CONSTRAINT pesagens_ocorrencia_por_fkey FOREIGN KEY (ocorrencia_por) REFERENCES auth.users(id);

--
-- Name: pesagens pesagens_saida_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.pesagens
    ADD CONSTRAINT pesagens_saida_por_fkey FOREIGN KEY (saida_por) REFERENCES auth.users(id);

--
-- Name: pesagens pesagens_traco_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.pesagens
    ADD CONSTRAINT pesagens_traco_id_fkey FOREIGN KEY (traco_id) REFERENCES imobpesagens.tracos_concreto(id);

--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: sefaz_certificados sefaz_certificados_obra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.sefaz_certificados
    ADD CONSTRAINT sefaz_certificados_obra_id_fkey FOREIGN KEY (obra_id) REFERENCES imobpesagens.obras(id) ON DELETE CASCADE;

--
-- Name: sucata_contas_obra sucata_contas_obra_obra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.sucata_contas_obra
    ADD CONSTRAINT sucata_contas_obra_obra_id_fkey FOREIGN KEY (obra_id) REFERENCES imobpesagens.obras(id);

--
-- Name: sucata_eventos sucata_eventos_processo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.sucata_eventos
    ADD CONSTRAINT sucata_eventos_processo_id_fkey FOREIGN KEY (processo_id) REFERENCES imobpesagens.sucata_processos(id);

--
-- Name: sucata_evidencias sucata_evidencias_processo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.sucata_evidencias
    ADD CONSTRAINT sucata_evidencias_processo_id_fkey FOREIGN KEY (processo_id) REFERENCES imobpesagens.sucata_processos(id);

--
-- Name: sucata_evidencias sucata_evidencias_substituida_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.sucata_evidencias
    ADD CONSTRAINT sucata_evidencias_substituida_por_fkey FOREIGN KEY (substituida_por) REFERENCES imobpesagens.sucata_evidencias(id);

--
-- Name: sucata_notificacoes sucata_notificacoes_processo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.sucata_notificacoes
    ADD CONSTRAINT sucata_notificacoes_processo_id_fkey FOREIGN KEY (processo_id) REFERENCES imobpesagens.sucata_processos(id);

--
-- Name: sucata_processos sucata_processos_conta_obra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.sucata_processos
    ADD CONSTRAINT sucata_processos_conta_obra_id_fkey FOREIGN KEY (conta_obra_id) REFERENCES imobpesagens.sucata_contas_obra(id);

--
-- Name: sucata_processos sucata_processos_obra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.sucata_processos
    ADD CONSTRAINT sucata_processos_obra_id_fkey FOREIGN KEY (obra_id) REFERENCES imobpesagens.obras(id);

--
-- Name: sucata_processos sucata_processos_sucateiro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.sucata_processos
    ADD CONSTRAINT sucata_processos_sucateiro_id_fkey FOREIGN KEY (sucateiro_id) REFERENCES imobpesagens.sucata_sucateiros(id);

--
-- Name: sucata_processos sucata_processos_tipo_sucata_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.sucata_processos
    ADD CONSTRAINT sucata_processos_tipo_sucata_id_fkey FOREIGN KEY (tipo_sucata_id) REFERENCES imobpesagens.sucata_tipos(id);

--
-- Name: sucata_processos sucata_processos_veiculo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.sucata_processos
    ADD CONSTRAINT sucata_processos_veiculo_id_fkey FOREIGN KEY (veiculo_id) REFERENCES imobpesagens.sucata_veiculos(id);

--
-- Name: sucata_relatorios sucata_relatorios_processo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.sucata_relatorios
    ADD CONSTRAINT sucata_relatorios_processo_id_fkey FOREIGN KEY (processo_id) REFERENCES imobpesagens.sucata_processos(id);

--
-- Name: sucata_sucateiro_documentos sucata_sucateiro_documentos_sucateiro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.sucata_sucateiro_documentos
    ADD CONSTRAINT sucata_sucateiro_documentos_sucateiro_id_fkey FOREIGN KEY (sucateiro_id) REFERENCES imobpesagens.sucata_sucateiros(id);

--
-- Name: sucata_veiculos sucata_veiculos_sucateiro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.sucata_veiculos
    ADD CONSTRAINT sucata_veiculos_sucateiro_id_fkey FOREIGN KEY (sucateiro_id) REFERENCES imobpesagens.sucata_sucateiros(id);

--
-- Name: tolerancias_fornecedor tolerancias_fornecedor_fornecedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.tolerancias_fornecedor
    ADD CONSTRAINT tolerancias_fornecedor_fornecedor_id_fkey FOREIGN KEY (fornecedor_id) REFERENCES imobpesagens.fornecedores_material(id) ON DELETE CASCADE;

--
-- Name: tolerancias_fornecedor tolerancias_fornecedor_tolerancia_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.tolerancias_fornecedor
    ADD CONSTRAINT tolerancias_fornecedor_tolerancia_material_id_fkey FOREIGN KEY (tolerancia_material_id) REFERENCES imobpesagens.tolerancias_material(id) ON DELETE CASCADE;

--
-- Name: tolerancias_fornecedor_v2 tolerancias_fornecedor_v2_fornecedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.tolerancias_fornecedor_v2
    ADD CONSTRAINT tolerancias_fornecedor_v2_fornecedor_id_fkey FOREIGN KEY (fornecedor_id) REFERENCES imobpesagens.fornecedores_material_v2(id) ON DELETE CASCADE;

--
-- Name: tolerancias_fornecedor_v2 tolerancias_fornecedor_v2_tolerancia_padrao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.tolerancias_fornecedor_v2
    ADD CONSTRAINT tolerancias_fornecedor_v2_tolerancia_padrao_id_fkey FOREIGN KEY (tolerancia_padrao_id) REFERENCES imobpesagens.tolerancias_padrao(id) ON DELETE CASCADE;

--
-- Name: tracos_concreto tracos_concreto_fornecedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.tracos_concreto
    ADD CONSTRAINT tracos_concreto_fornecedor_id_fkey FOREIGN KEY (fornecedor_id) REFERENCES imobpesagens.fornecedores_concreto(id) ON DELETE CASCADE;

--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: usuario_coligadas usuario_coligadas_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.usuario_coligadas
    ADD CONSTRAINT usuario_coligadas_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: whatsapp_alertas whatsapp_alertas_obra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.whatsapp_alertas
    ADD CONSTRAINT whatsapp_alertas_obra_id_fkey FOREIGN KEY (obra_id) REFERENCES imobpesagens.obras(id);

--
-- Name: whatsapp_alertas whatsapp_alertas_pesagem_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.whatsapp_alertas
    ADD CONSTRAINT whatsapp_alertas_pesagem_id_fkey FOREIGN KEY (pesagem_id) REFERENCES imobpesagens.pesagens(id) ON DELETE CASCADE;

--
-- Name: whatsapp_mensagens whatsapp_mensagens_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.whatsapp_mensagens
    ADD CONSTRAINT whatsapp_mensagens_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: whatsapp_mensagens whatsapp_mensagens_obra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY imobpesagens.whatsapp_mensagens
    ADD CONSTRAINT whatsapp_mensagens_obra_id_fkey FOREIGN KEY (obra_id) REFERENCES imobpesagens.obras(id) ON DELETE SET NULL;

--
-- Name: pesagens Admin apaga pesagens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin apaga pesagens" ON imobpesagens.pesagens FOR DELETE TO authenticated USING (imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role));

--
-- Name: fornecedores_material Admin atualiza fornecedores de material; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin atualiza fornecedores de material" ON imobpesagens.fornecedores_material FOR UPDATE TO authenticated USING (imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role)) WITH CHECK (imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role));

--
-- Name: tolerancias_fornecedor Admin atualiza tolerancias por fornecedor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin atualiza tolerancias por fornecedor" ON imobpesagens.tolerancias_fornecedor FOR UPDATE TO authenticated USING (imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role)) WITH CHECK (imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role));

--
-- Name: tolerancias_material Admin atualiza tolerâncias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin atualiza tolerâncias" ON imobpesagens.tolerancias_material FOR UPDATE TO authenticated USING (imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role)) WITH CHECK (imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role));

--
-- Name: pesagem_logs Admin e operador podem ler logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin e operador podem ler logs" ON imobpesagens.pesagem_logs FOR SELECT TO authenticated USING ((imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'operador'::imobpesagens.app_role)));

--
-- Name: obra_acessos Admin gerencia acessos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin gerencia acessos" ON imobpesagens.obra_acessos TO authenticated USING (imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role)) WITH CHECK (imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role));

--
-- Name: sefaz_certificados Admin gerencia certificados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin gerencia certificados" ON imobpesagens.sefaz_certificados TO authenticated USING (imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role)) WITH CHECK (imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role));

--
-- Name: obras Admin gerencia obras; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin gerencia obras" ON imobpesagens.obras TO authenticated USING (imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role)) WITH CHECK (imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role));

--
-- Name: fornecedores_material Admin insere fornecedores de material; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin insere fornecedores de material" ON imobpesagens.fornecedores_material FOR INSERT TO authenticated WITH CHECK (imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role));

--
-- Name: tolerancias_fornecedor Admin insere tolerancias por fornecedor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin insere tolerancias por fornecedor" ON imobpesagens.tolerancias_fornecedor FOR INSERT TO authenticated WITH CHECK (imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role));

--
-- Name: tolerancias_material Admin insere tolerâncias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin insere tolerâncias" ON imobpesagens.tolerancias_material FOR INSERT TO authenticated WITH CHECK (imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role));

--
-- Name: tolerancias_padrao Admin pode editar padrão; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin pode editar padrão" ON imobpesagens.tolerancias_padrao TO authenticated USING ((imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'superadmin'::imobpesagens.app_role))) WITH CHECK ((imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'superadmin'::imobpesagens.app_role)));

--
-- Name: fornecedores_material Admin remove fornecedores de material; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin remove fornecedores de material" ON imobpesagens.fornecedores_material FOR DELETE TO authenticated USING (imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role));

--
-- Name: tolerancias_fornecedor Admin remove tolerancias por fornecedor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin remove tolerancias por fornecedor" ON imobpesagens.tolerancias_fornecedor FOR DELETE TO authenticated USING (imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role));

--
-- Name: tolerancias_material Admin remove tolerâncias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin remove tolerâncias" ON imobpesagens.tolerancias_material FOR DELETE TO authenticated USING (imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role));

--
-- Name: sefaz_certificados Admin ve certificados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin ve certificados" ON imobpesagens.sefaz_certificados FOR SELECT TO authenticated USING (imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role));

--
-- Name: fornecedores_concreto Admins gerenciam fornecedores de concreto; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins gerenciam fornecedores de concreto" ON imobpesagens.fornecedores_concreto TO authenticated USING ((imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'superadmin'::imobpesagens.app_role))) WITH CHECK ((imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'superadmin'::imobpesagens.app_role)));

--
-- Name: perfil_descricoes Admins gerenciam perfis; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins gerenciam perfis" ON imobpesagens.perfil_descricoes TO authenticated USING ((imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'superadmin'::imobpesagens.app_role))) WITH CHECK ((imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'superadmin'::imobpesagens.app_role)));

--
-- Name: perfil_menu_permissoes Admins gerenciam permissoes de menu; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins gerenciam permissoes de menu" ON imobpesagens.perfil_menu_permissoes TO authenticated USING ((imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'superadmin'::imobpesagens.app_role))) WITH CHECK ((imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'superadmin'::imobpesagens.app_role)));

--
-- Name: tracos_concreto Admins gerenciam traços; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins gerenciam traços" ON imobpesagens.tracos_concreto TO authenticated USING ((imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'superadmin'::imobpesagens.app_role))) WITH CHECK ((imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'superadmin'::imobpesagens.app_role)));

--
-- Name: fornecedores_material_v2 Admins podem gerir fornecedores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins podem gerir fornecedores" ON imobpesagens.fornecedores_material_v2 TO authenticated USING ((imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'superadmin'::imobpesagens.app_role))) WITH CHECK ((imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'superadmin'::imobpesagens.app_role)));

--
-- Name: tolerancias_fornecedor_v2 Admins podem gerir overrides; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins podem gerir overrides" ON imobpesagens.tolerancias_fornecedor_v2 TO authenticated USING ((imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'superadmin'::imobpesagens.app_role))) WITH CHECK ((imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'superadmin'::imobpesagens.app_role)));

--
-- Name: evidencias Apagar evidencias da obra; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Apagar evidencias da obra" ON imobpesagens.evidencias FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM imobpesagens.pesagens p
  WHERE ((p.id = evidencias.pesagem_id) AND imobpesagens.tem_acesso_obra(p.obra_id)))));

--
-- Name: fornecedores_material_v2 Apenas admin pode gerir fornecedores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Apenas admin pode gerir fornecedores" ON imobpesagens.fornecedores_material_v2 TO authenticated USING (imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role)) WITH CHECK (imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role));

--
-- Name: tolerancias_fornecedor_v2 Apenas admin pode gerir overrides; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Apenas admin pode gerir overrides" ON imobpesagens.tolerancias_fornecedor_v2 TO authenticated USING (imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role)) WITH CHECK (imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role));

--
-- Name: fornecedores_material Autenticados leem fornecedores de material; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Autenticados leem fornecedores de material" ON imobpesagens.fornecedores_material FOR SELECT TO authenticated USING (( SELECT imobpesagens.usuario_do_app() AS usuario_do_app));

--
-- Name: tolerancias_fornecedor Autenticados leem tolerancias por fornecedor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Autenticados leem tolerancias por fornecedor" ON imobpesagens.tolerancias_fornecedor FOR SELECT TO authenticated USING (( SELECT imobpesagens.usuario_do_app() AS usuario_do_app));

--
-- Name: tolerancias_material Autenticados podem ler tolerâncias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Autenticados podem ler tolerâncias" ON imobpesagens.tolerancias_material FOR SELECT TO authenticated USING (( SELECT imobpesagens.usuario_do_app() AS usuario_do_app));

--
-- Name: evidencias Criar evidencias em obra liberada; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Criar evidencias em obra liberada" ON imobpesagens.evidencias FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM imobpesagens.pesagens p
  WHERE ((p.id = evidencias.pesagem_id) AND imobpesagens.tem_acesso_obra(p.obra_id)))));

--
-- Name: pesagens Criar pesagens em obra liberada; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Criar pesagens em obra liberada" ON imobpesagens.pesagens FOR INSERT TO authenticated WITH CHECK ((imobpesagens.tem_acesso_obra(obra_id) AND (criado_por = auth.uid())));

--
-- Name: pesagens Editar pesagens da obra; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Editar pesagens da obra" ON imobpesagens.pesagens FOR UPDATE TO authenticated USING (imobpesagens.tem_acesso_obra(obra_id)) WITH CHECK (imobpesagens.tem_acesso_obra(obra_id));

--
-- Name: tolerancias_fornecedor_v2 Leitura de overrides para todos autenticados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Leitura de overrides para todos autenticados" ON imobpesagens.tolerancias_fornecedor_v2 FOR SELECT TO authenticated USING (( SELECT imobpesagens.usuario_do_app() AS usuario_do_app));

--
-- Name: fornecedores_material_v2 Leitura para todos autenticados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Leitura para todos autenticados" ON imobpesagens.fornecedores_material_v2 FOR SELECT TO authenticated USING (( SELECT imobpesagens.usuario_do_app() AS usuario_do_app));

--
-- Name: tolerancias_padrao Leitura pública para autenticados; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Leitura pública para autenticados" ON imobpesagens.tolerancias_padrao FOR SELECT TO authenticated USING (( SELECT imobpesagens.usuario_do_app() AS usuario_do_app));

--
-- Name: whatsapp_alertas Perfis autorizados leem alertas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Perfis autorizados leem alertas" ON imobpesagens.whatsapp_alertas FOR SELECT TO authenticated USING ((imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'superadmin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'coordenador'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'operador'::imobpesagens.app_role)));

--
-- Name: fornecedores_concreto Perfis cadastrados leem fornecedores de concreto; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Perfis cadastrados leem fornecedores de concreto" ON imobpesagens.fornecedores_concreto FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM imobpesagens.user_roles ur
  WHERE (ur.user_id = auth.uid()))));

--
-- Name: tracos_concreto Perfis cadastrados leem traços; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Perfis cadastrados leem traços" ON imobpesagens.tracos_concreto FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM imobpesagens.user_roles ur
  WHERE (ur.user_id = auth.uid()))));

--
-- Name: pesagem_logs Registrar logs da obra; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Registrar logs da obra" ON imobpesagens.pesagem_logs FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM imobpesagens.pesagens p
  WHERE ((p.id = pesagem_logs.pesagem_id) AND imobpesagens.tem_acesso_obra(p.obra_id)))));

--
-- Name: user_roles Users see own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users see own roles" ON imobpesagens.user_roles FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role)));

--
-- Name: profiles Usuario cria proprio perfil; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuario cria proprio perfil" ON imobpesagens.profiles FOR INSERT TO authenticated WITH CHECK (((id = auth.uid()) OR imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role)));

--
-- Name: profiles Usuario edita proprio perfil; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuario edita proprio perfil" ON imobpesagens.profiles FOR UPDATE TO authenticated USING (((id = auth.uid()) OR imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role))) WITH CHECK (((id = auth.uid()) OR imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role)));

--
-- Name: profiles Usuario le proprio perfil; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuario le proprio perfil" ON imobpesagens.profiles FOR SELECT TO authenticated USING (((id = auth.uid()) OR imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role)));

--
-- Name: usuario_coligadas Usuario ve proprias coligadas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuario ve proprias coligadas" ON imobpesagens.usuario_coligadas FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'superadmin'::imobpesagens.app_role)));

--
-- Name: perfil_menu_permissoes Usuarios com perfil podem ver permissoes de menu; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuarios com perfil podem ver permissoes de menu" ON imobpesagens.perfil_menu_permissoes FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM imobpesagens.user_roles ur
  WHERE (ur.user_id = auth.uid()))));

--
-- Name: fornecedores_material_v2 Usuários com perfil podem ver fornecedores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários com perfil podem ver fornecedores" ON imobpesagens.fornecedores_material_v2 FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM imobpesagens.user_roles ur
  WHERE (ur.user_id = auth.uid()))));

--
-- Name: tolerancias_fornecedor_v2 Usuários com perfil podem ver overrides; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários com perfil podem ver overrides" ON imobpesagens.tolerancias_fornecedor_v2 FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM imobpesagens.user_roles ur
  WHERE (ur.user_id = auth.uid()))));

--
-- Name: perfil_descricoes Usuários com perfil podem ver perfis; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Usuários com perfil podem ver perfis" ON imobpesagens.perfil_descricoes FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM imobpesagens.user_roles ur
  WHERE (ur.user_id = auth.uid()))));

--
-- Name: obra_acessos Ver acessos das próprias obras; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Ver acessos das próprias obras" ON imobpesagens.obra_acessos FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role)));

--
-- Name: evidencias Ver evidencias da obra; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Ver evidencias da obra" ON imobpesagens.evidencias FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM imobpesagens.pesagens p
  WHERE ((p.id = evidencias.pesagem_id) AND imobpesagens.pode_ler_obra(p.obra_id) AND imobpesagens.pode_ver_obra_coligada(p.obra_id)))));

--
-- Name: pesagem_logs Ver logs da obra; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Ver logs da obra" ON imobpesagens.pesagem_logs FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM imobpesagens.pesagens p
  WHERE ((p.id = pesagem_logs.pesagem_id) AND imobpesagens.pode_ler_obra(p.obra_id) AND imobpesagens.pode_ver_obra_coligada(p.obra_id)))));

--
-- Name: notas_fiscais Ver notas da obra; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Ver notas da obra" ON imobpesagens.notas_fiscais FOR SELECT TO authenticated USING ((((obra_id IS NOT NULL) AND imobpesagens.pode_ler_obra(obra_id) AND imobpesagens.pode_ver_obra_coligada(obra_id)) OR ((obra_id IS NULL) AND imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role))));

--
-- Name: obras Ver obras ativas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Ver obras ativas" ON imobpesagens.obras FOR SELECT TO authenticated USING (((ativo = true) AND imobpesagens.pode_ver_coligada(coligada)));

--
-- Name: pesagens Ver pesagens da obra; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Ver pesagens da obra" ON imobpesagens.pesagens FOR SELECT TO authenticated USING ((imobpesagens.pode_ler_obra(obra_id) AND imobpesagens.pode_ver_obra_coligada(obra_id)));

--
-- Name: sucata_contas_obra contas_obra_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contas_obra_insert ON imobpesagens.sucata_contas_obra FOR INSERT TO authenticated WITH CHECK ((imobpesagens.sucata_pode_escrever() AND imobpesagens.pode_ver_coligada(coligada_origem)));

--
-- Name: sucata_contas_obra contas_obra_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contas_obra_select ON imobpesagens.sucata_contas_obra FOR SELECT TO authenticated USING ((imobpesagens.sucata_pode_ler() AND imobpesagens.pode_ver_coligada(coligada_origem)));

--
-- Name: sucata_contas_obra contas_obra_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contas_obra_update ON imobpesagens.sucata_contas_obra FOR UPDATE TO authenticated USING ((imobpesagens.sucata_pode_escrever() AND imobpesagens.pode_ver_coligada(coligada_origem))) WITH CHECK ((imobpesagens.sucata_pode_escrever() AND imobpesagens.pode_ver_coligada(coligada_origem)));

--
-- Name: densidades_fornecedor; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE imobpesagens.densidades_fornecedor ENABLE ROW LEVEL SECURITY;

--
-- Name: densidades_fornecedor densidades_fornecedor_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY densidades_fornecedor_admin ON imobpesagens.densidades_fornecedor TO authenticated USING ((imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'superadmin'::imobpesagens.app_role))) WITH CHECK ((imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'superadmin'::imobpesagens.app_role)));

--
-- Name: densidades_fornecedor densidades_fornecedor_leitura; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY densidades_fornecedor_leitura ON imobpesagens.densidades_fornecedor FOR SELECT TO authenticated USING ((imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'superadmin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'operador'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'coordenador'::imobpesagens.app_role)));

--
-- Name: densidades_material; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE imobpesagens.densidades_material ENABLE ROW LEVEL SECURITY;

--
-- Name: densidades_material densidades_material_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY densidades_material_admin ON imobpesagens.densidades_material TO authenticated USING ((imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'superadmin'::imobpesagens.app_role))) WITH CHECK ((imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'superadmin'::imobpesagens.app_role)));

--
-- Name: densidades_material densidades_material_leitura; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY densidades_material_leitura ON imobpesagens.densidades_material FOR SELECT TO authenticated USING ((imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'superadmin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'operador'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'coordenador'::imobpesagens.app_role)));

--
-- Name: evidencias; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE imobpesagens.evidencias ENABLE ROW LEVEL SECURITY;

--
-- Name: fornecedores_concreto; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE imobpesagens.fornecedores_concreto ENABLE ROW LEVEL SECURITY;

--
-- Name: fornecedores_material; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE imobpesagens.fornecedores_material ENABLE ROW LEVEL SECURITY;

--
-- Name: fornecedores_material_v2; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE imobpesagens.fornecedores_material_v2 ENABLE ROW LEVEL SECURITY;

--
-- Name: notas_fiscais; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE imobpesagens.notas_fiscais ENABLE ROW LEVEL SECURITY;

--
-- Name: obra_acessos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE imobpesagens.obra_acessos ENABLE ROW LEVEL SECURITY;

--
-- Name: obras; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE imobpesagens.obras ENABLE ROW LEVEL SECURITY;

--
-- Name: perfil_descricoes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE imobpesagens.perfil_descricoes ENABLE ROW LEVEL SECURITY;

--
-- Name: perfil_menu_permissoes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE imobpesagens.perfil_menu_permissoes ENABLE ROW LEVEL SECURITY;

--
-- Name: pesagem_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE imobpesagens.pesagem_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: pesagens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE imobpesagens.pesagens ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE imobpesagens.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: sefaz_certificados; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE imobpesagens.sefaz_certificados ENABLE ROW LEVEL SECURITY;

--
-- Name: sucata_cfop; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE imobpesagens.sucata_cfop ENABLE ROW LEVEL SECURITY;

--
-- Name: sucata_cfop sucata_cfop_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sucata_cfop_insert ON imobpesagens.sucata_cfop FOR INSERT TO authenticated WITH CHECK ((imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'superadmin'::imobpesagens.app_role)));

--
-- Name: sucata_cfop sucata_cfop_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sucata_cfop_select ON imobpesagens.sucata_cfop FOR SELECT TO authenticated USING (imobpesagens.sucata_pode_ler());

--
-- Name: sucata_cfop sucata_cfop_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sucata_cfop_update ON imobpesagens.sucata_cfop FOR UPDATE TO authenticated USING ((imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'superadmin'::imobpesagens.app_role))) WITH CHECK ((imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'superadmin'::imobpesagens.app_role)));

--
-- Name: sucata_contas_obra; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE imobpesagens.sucata_contas_obra ENABLE ROW LEVEL SECURITY;

--
-- Name: sucata_destinatarios_relatorio sucata_dest_rel_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sucata_dest_rel_insert ON imobpesagens.sucata_destinatarios_relatorio FOR INSERT TO authenticated WITH CHECK ((imobpesagens.sucata_pode_escrever() AND imobpesagens.pode_ver_coligada(coligada)));

--
-- Name: sucata_destinatarios_relatorio sucata_dest_rel_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sucata_dest_rel_select ON imobpesagens.sucata_destinatarios_relatorio FOR SELECT TO authenticated USING ((imobpesagens.sucata_pode_ler() AND imobpesagens.pode_ver_coligada(coligada)));

--
-- Name: sucata_destinatarios_relatorio sucata_dest_rel_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sucata_dest_rel_update ON imobpesagens.sucata_destinatarios_relatorio FOR UPDATE TO authenticated USING ((imobpesagens.sucata_pode_escrever() AND imobpesagens.pode_ver_coligada(coligada)));

--
-- Name: sucata_destinatarios_relatorio; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE imobpesagens.sucata_destinatarios_relatorio ENABLE ROW LEVEL SECURITY;

--
-- Name: sucata_sucateiro_documentos sucata_doc_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sucata_doc_insert ON imobpesagens.sucata_sucateiro_documentos FOR INSERT TO authenticated WITH CHECK ((imobpesagens.sucata_pode_escrever() AND (EXISTS ( SELECT 1
   FROM imobpesagens.sucata_sucateiros s
  WHERE ((s.id = sucata_sucateiro_documentos.sucateiro_id) AND imobpesagens.pode_ver_coligada(s.coligada_origem))))));

--
-- Name: sucata_sucateiro_documentos sucata_doc_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sucata_doc_select ON imobpesagens.sucata_sucateiro_documentos FOR SELECT TO authenticated USING ((imobpesagens.sucata_pode_ler() AND (EXISTS ( SELECT 1
   FROM imobpesagens.sucata_sucateiros s
  WHERE ((s.id = sucata_sucateiro_documentos.sucateiro_id) AND imobpesagens.pode_ver_coligada(s.coligada_origem))))));

--
-- Name: sucata_sucateiro_documentos sucata_doc_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sucata_doc_update ON imobpesagens.sucata_sucateiro_documentos FOR UPDATE TO authenticated USING ((imobpesagens.sucata_pode_escrever() AND (EXISTS ( SELECT 1
   FROM imobpesagens.sucata_sucateiros s
  WHERE ((s.id = sucata_sucateiro_documentos.sucateiro_id) AND imobpesagens.pode_ver_coligada(s.coligada_origem)))))) WITH CHECK (imobpesagens.sucata_pode_escrever());

--
-- Name: sucata_eventos sucata_ev_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sucata_ev_insert ON imobpesagens.sucata_eventos FOR INSERT TO authenticated WITH CHECK ((imobpesagens.sucata_pode_escrever() AND (usuario_id = auth.uid())));

--
-- Name: sucata_eventos sucata_ev_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sucata_ev_select ON imobpesagens.sucata_eventos FOR SELECT TO authenticated USING ((imobpesagens.sucata_pode_ler() AND ((coligada_origem IS NULL) OR imobpesagens.pode_ver_coligada(coligada_origem))));

--
-- Name: sucata_eventos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE imobpesagens.sucata_eventos ENABLE ROW LEVEL SECURITY;

--
-- Name: sucata_evidencias; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE imobpesagens.sucata_evidencias ENABLE ROW LEVEL SECURITY;

--
-- Name: sucata_evidencias sucata_evidencias_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sucata_evidencias_insert ON imobpesagens.sucata_evidencias FOR INSERT TO authenticated WITH CHECK ((imobpesagens.sucata_pode_escrever() AND (EXISTS ( SELECT 1
   FROM imobpesagens.sucata_processos p
  WHERE ((p.id = sucata_evidencias.processo_id) AND imobpesagens.pode_ver_coligada(p.coligada_origem))))));

--
-- Name: sucata_evidencias sucata_evidencias_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sucata_evidencias_select ON imobpesagens.sucata_evidencias FOR SELECT TO authenticated USING ((imobpesagens.sucata_pode_ler() AND (EXISTS ( SELECT 1
   FROM imobpesagens.sucata_processos p
  WHERE ((p.id = sucata_evidencias.processo_id) AND imobpesagens.pode_ver_coligada(p.coligada_origem))))));

--
-- Name: sucata_evidencias sucata_evidencias_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sucata_evidencias_update ON imobpesagens.sucata_evidencias FOR UPDATE TO authenticated USING ((imobpesagens.sucata_pode_escrever() AND (EXISTS ( SELECT 1
   FROM imobpesagens.sucata_processos p
  WHERE ((p.id = sucata_evidencias.processo_id) AND imobpesagens.pode_ver_coligada(p.coligada_origem)))))) WITH CHECK ((imobpesagens.sucata_pode_escrever() AND (EXISTS ( SELECT 1
   FROM imobpesagens.sucata_processos p
  WHERE ((p.id = sucata_evidencias.processo_id) AND imobpesagens.pode_ver_coligada(p.coligada_origem))))));

--
-- Name: sucata_notificacoes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE imobpesagens.sucata_notificacoes ENABLE ROW LEVEL SECURITY;

--
-- Name: sucata_notificacoes sucata_notificacoes_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sucata_notificacoes_select ON imobpesagens.sucata_notificacoes FOR SELECT TO authenticated USING ((imobpesagens.sucata_pode_ler() AND (EXISTS ( SELECT 1
   FROM imobpesagens.sucata_processos p
  WHERE ((p.id = sucata_notificacoes.processo_id) AND imobpesagens.pode_ver_coligada(p.coligada_origem))))));

--
-- Name: sucata_numeracao sucata_num_service; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sucata_num_service ON imobpesagens.sucata_numeracao FOR SELECT TO authenticated USING (false);

--
-- Name: sucata_numeracao; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE imobpesagens.sucata_numeracao ENABLE ROW LEVEL SECURITY;

--
-- Name: sucata_parametros; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE imobpesagens.sucata_parametros ENABLE ROW LEVEL SECURITY;

--
-- Name: sucata_parametros sucata_parametros_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sucata_parametros_insert ON imobpesagens.sucata_parametros FOR INSERT TO authenticated WITH CHECK ((imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'superadmin'::imobpesagens.app_role)));

--
-- Name: sucata_parametros sucata_parametros_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sucata_parametros_select ON imobpesagens.sucata_parametros FOR SELECT TO authenticated USING (imobpesagens.sucata_pode_ler());

--
-- Name: sucata_parametros sucata_parametros_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sucata_parametros_update ON imobpesagens.sucata_parametros FOR UPDATE TO authenticated USING ((imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'superadmin'::imobpesagens.app_role))) WITH CHECK ((imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'superadmin'::imobpesagens.app_role)));

--
-- Name: sucata_processos sucata_proc_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sucata_proc_insert ON imobpesagens.sucata_processos FOR INSERT TO authenticated WITH CHECK ((imobpesagens.sucata_pode_escrever() AND imobpesagens.pode_ver_coligada(coligada_origem)));

--
-- Name: sucata_processos sucata_proc_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sucata_proc_select ON imobpesagens.sucata_processos FOR SELECT TO authenticated USING ((imobpesagens.sucata_pode_ler() AND imobpesagens.pode_ver_coligada(coligada_origem) AND ((excluido_em IS NULL) OR imobpesagens.has_role(auth.uid(), 'superadmin'::imobpesagens.app_role))));

--
-- Name: sucata_processos sucata_proc_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sucata_proc_update ON imobpesagens.sucata_processos FOR UPDATE TO authenticated USING ((imobpesagens.sucata_pode_escrever() AND imobpesagens.pode_ver_coligada(coligada_origem) AND ((excluido_em IS NULL) OR imobpesagens.has_role(auth.uid(), 'superadmin'::imobpesagens.app_role)))) WITH CHECK ((imobpesagens.sucata_pode_escrever() AND imobpesagens.pode_ver_coligada(coligada_origem)));

--
-- Name: sucata_processos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE imobpesagens.sucata_processos ENABLE ROW LEVEL SECURITY;

--
-- Name: sucata_relatorios; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE imobpesagens.sucata_relatorios ENABLE ROW LEVEL SECURITY;

--
-- Name: sucata_relatorios sucata_relatorios_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sucata_relatorios_insert ON imobpesagens.sucata_relatorios FOR INSERT TO authenticated WITH CHECK ((imobpesagens.sucata_pode_escrever() AND (EXISTS ( SELECT 1
   FROM imobpesagens.sucata_processos p
  WHERE ((p.id = sucata_relatorios.processo_id) AND imobpesagens.pode_ver_coligada(p.coligada_origem))))));

--
-- Name: sucata_relatorios sucata_relatorios_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sucata_relatorios_select ON imobpesagens.sucata_relatorios FOR SELECT TO authenticated USING ((imobpesagens.sucata_pode_ler() AND (EXISTS ( SELECT 1
   FROM imobpesagens.sucata_processos p
  WHERE ((p.id = sucata_relatorios.processo_id) AND imobpesagens.pode_ver_coligada(p.coligada_origem))))));

--
-- Name: sucata_relatorios sucata_relatorios_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sucata_relatorios_update ON imobpesagens.sucata_relatorios FOR UPDATE TO authenticated USING ((imobpesagens.sucata_pode_escrever() AND (EXISTS ( SELECT 1
   FROM imobpesagens.sucata_processos p
  WHERE ((p.id = sucata_relatorios.processo_id) AND imobpesagens.pode_ver_coligada(p.coligada_origem))))));

--
-- Name: sucata_sucateiro_documentos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE imobpesagens.sucata_sucateiro_documentos ENABLE ROW LEVEL SECURITY;

--
-- Name: sucata_sucateiros; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE imobpesagens.sucata_sucateiros ENABLE ROW LEVEL SECURITY;

--
-- Name: sucata_tipos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE imobpesagens.sucata_tipos ENABLE ROW LEVEL SECURITY;

--
-- Name: sucata_tipos sucata_tipos_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sucata_tipos_insert ON imobpesagens.sucata_tipos FOR INSERT TO authenticated WITH CHECK ((imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'superadmin'::imobpesagens.app_role)));

--
-- Name: sucata_tipos sucata_tipos_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sucata_tipos_select ON imobpesagens.sucata_tipos FOR SELECT TO authenticated USING (imobpesagens.sucata_pode_ler());

--
-- Name: sucata_tipos sucata_tipos_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sucata_tipos_update ON imobpesagens.sucata_tipos FOR UPDATE TO authenticated USING ((imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'superadmin'::imobpesagens.app_role))) WITH CHECK ((imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'superadmin'::imobpesagens.app_role)));

--
-- Name: sucata_veiculos sucata_veic_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sucata_veic_insert ON imobpesagens.sucata_veiculos FOR INSERT TO authenticated WITH CHECK ((imobpesagens.sucata_pode_escrever() AND (EXISTS ( SELECT 1
   FROM imobpesagens.sucata_sucateiros s
  WHERE ((s.id = sucata_veiculos.sucateiro_id) AND imobpesagens.pode_ver_coligada(s.coligada_origem))))));

--
-- Name: sucata_veiculos sucata_veic_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sucata_veic_select ON imobpesagens.sucata_veiculos FOR SELECT TO authenticated USING ((imobpesagens.sucata_pode_ler() AND (EXISTS ( SELECT 1
   FROM imobpesagens.sucata_sucateiros s
  WHERE ((s.id = sucata_veiculos.sucateiro_id) AND imobpesagens.pode_ver_coligada(s.coligada_origem))))));

--
-- Name: sucata_veiculos sucata_veic_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sucata_veic_update ON imobpesagens.sucata_veiculos FOR UPDATE TO authenticated USING ((imobpesagens.sucata_pode_escrever() AND (EXISTS ( SELECT 1
   FROM imobpesagens.sucata_sucateiros s
  WHERE ((s.id = sucata_veiculos.sucateiro_id) AND imobpesagens.pode_ver_coligada(s.coligada_origem)))))) WITH CHECK (imobpesagens.sucata_pode_escrever());

--
-- Name: sucata_veiculos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE imobpesagens.sucata_veiculos ENABLE ROW LEVEL SECURITY;

--
-- Name: sucata_sucateiros sucateiros_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sucateiros_insert ON imobpesagens.sucata_sucateiros FOR INSERT TO authenticated WITH CHECK ((imobpesagens.sucata_pode_escrever() AND imobpesagens.pode_ver_coligada(coligada_origem)));

--
-- Name: sucata_sucateiros sucateiros_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sucateiros_select ON imobpesagens.sucata_sucateiros FOR SELECT TO authenticated USING ((imobpesagens.sucata_pode_ler() AND imobpesagens.pode_ver_coligada(coligada_origem)));

--
-- Name: sucata_sucateiros sucateiros_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sucateiros_update ON imobpesagens.sucata_sucateiros FOR UPDATE TO authenticated USING ((imobpesagens.sucata_pode_escrever() AND imobpesagens.pode_ver_coligada(coligada_origem))) WITH CHECK ((imobpesagens.sucata_pode_escrever() AND imobpesagens.pode_ver_coligada(coligada_origem)));

--
-- Name: tolerancias_fornecedor; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE imobpesagens.tolerancias_fornecedor ENABLE ROW LEVEL SECURITY;

--
-- Name: tolerancias_fornecedor_v2; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE imobpesagens.tolerancias_fornecedor_v2 ENABLE ROW LEVEL SECURITY;

--
-- Name: tolerancias_material; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE imobpesagens.tolerancias_material ENABLE ROW LEVEL SECURITY;

--
-- Name: tolerancias_padrao; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE imobpesagens.tolerancias_padrao ENABLE ROW LEVEL SECURITY;

--
-- Name: tracos_concreto; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE imobpesagens.tracos_concreto ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE imobpesagens.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: usuario_coligadas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE imobpesagens.usuario_coligadas ENABLE ROW LEVEL SECURITY;

--
-- Name: whatsapp_automacao_config wa_auto_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wa_auto_select ON imobpesagens.whatsapp_automacao_config FOR SELECT TO authenticated USING ((imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'superadmin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'coordenador'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'operador'::imobpesagens.app_role)));

--
-- Name: whatsapp_automacao_config wa_auto_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wa_auto_write ON imobpesagens.whatsapp_automacao_config TO authenticated USING ((imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'superadmin'::imobpesagens.app_role))) WITH CHECK ((imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'superadmin'::imobpesagens.app_role)));

--
-- Name: whatsapp_config wa_config_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wa_config_select ON imobpesagens.whatsapp_config FOR SELECT TO authenticated USING ((imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'superadmin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'coordenador'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'operador'::imobpesagens.app_role)));

--
-- Name: whatsapp_config wa_config_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wa_config_write ON imobpesagens.whatsapp_config TO authenticated USING ((imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'superadmin'::imobpesagens.app_role))) WITH CHECK ((imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'superadmin'::imobpesagens.app_role)));

--
-- Name: whatsapp_mensagens wa_msg_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wa_msg_select ON imobpesagens.whatsapp_mensagens FOR SELECT TO authenticated USING ((imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'superadmin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'coordenador'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'operador'::imobpesagens.app_role)));

--
-- Name: whatsapp_mensagens wa_msg_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wa_msg_write ON imobpesagens.whatsapp_mensagens TO authenticated USING ((imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'superadmin'::imobpesagens.app_role))) WITH CHECK ((imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'superadmin'::imobpesagens.app_role)));

--
-- Name: whatsapp_numeros wa_num_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wa_num_select ON imobpesagens.whatsapp_numeros FOR SELECT TO authenticated USING ((imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'superadmin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'coordenador'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'operador'::imobpesagens.app_role)));

--
-- Name: whatsapp_numeros wa_num_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wa_num_write ON imobpesagens.whatsapp_numeros TO authenticated USING ((imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'superadmin'::imobpesagens.app_role))) WITH CHECK ((imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'superadmin'::imobpesagens.app_role)));

--
-- Name: whatsapp_templates wa_tpl_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wa_tpl_select ON imobpesagens.whatsapp_templates FOR SELECT TO authenticated USING ((imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'superadmin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'coordenador'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'operador'::imobpesagens.app_role)));

--
-- Name: whatsapp_templates wa_tpl_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wa_tpl_write ON imobpesagens.whatsapp_templates TO authenticated USING ((imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'superadmin'::imobpesagens.app_role))) WITH CHECK ((imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role) OR imobpesagens.has_role(auth.uid(), 'superadmin'::imobpesagens.app_role)));

--
-- Name: whatsapp_alertas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE imobpesagens.whatsapp_alertas ENABLE ROW LEVEL SECURITY;

--
-- Name: whatsapp_automacao_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE imobpesagens.whatsapp_automacao_config ENABLE ROW LEVEL SECURITY;

--
-- Name: whatsapp_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE imobpesagens.whatsapp_config ENABLE ROW LEVEL SECURITY;

--
-- Name: whatsapp_mensagens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE imobpesagens.whatsapp_mensagens ENABLE ROW LEVEL SECURITY;

--
-- Name: whatsapp_numeros; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE imobpesagens.whatsapp_numeros ENABLE ROW LEVEL SECURITY;

--
-- Name: whatsapp_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE imobpesagens.whatsapp_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

--
-- Name: FUNCTION dashboard_recebimento(_obra_id uuid, _ini timestamp with time zone, _fim timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION imobpesagens.dashboard_recebimento(_obra_id uuid, _ini timestamp with time zone, _fim timestamp with time zone) TO authenticated;
GRANT ALL ON FUNCTION imobpesagens.dashboard_recebimento(_obra_id uuid, _ini timestamp with time zone, _fim timestamp with time zone) TO service_role;

--
-- Name: FUNCTION has_role(_user_id uuid, _role imobpesagens.app_role); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION imobpesagens.has_role(_user_id uuid, _role imobpesagens.app_role) TO service_role;
GRANT ALL ON FUNCTION imobpesagens.has_role(_user_id uuid, _role imobpesagens.app_role) TO authenticated;

--
-- Name: FUNCTION pode_ler_obra(_obra_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION imobpesagens.pode_ler_obra(_obra_id uuid) TO authenticated;
GRANT ALL ON FUNCTION imobpesagens.pode_ler_obra(_obra_id uuid) TO service_role;

--
-- Name: FUNCTION pode_ver_coligada(_cod text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION imobpesagens.pode_ver_coligada(_cod text) TO authenticated;
GRANT ALL ON FUNCTION imobpesagens.pode_ver_coligada(_cod text) TO service_role;

--
-- Name: FUNCTION pode_ver_obra_coligada(_obra_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION imobpesagens.pode_ver_obra_coligada(_obra_id uuid) TO authenticated;
GRANT ALL ON FUNCTION imobpesagens.pode_ver_obra_coligada(_obra_id uuid) TO service_role;

--
-- Name: FUNCTION set_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION imobpesagens.set_updated_at() TO authenticated;
GRANT ALL ON FUNCTION imobpesagens.set_updated_at() TO service_role;

--
-- Name: FUNCTION sucata_encerramento_trg(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION imobpesagens.sucata_encerramento_trg() TO service_role;

--
-- Name: FUNCTION sucata_evidencia_processo_aberto_trg(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION imobpesagens.sucata_evidencia_processo_aberto_trg() TO service_role;

--
-- Name: FUNCTION sucata_nfa_exige_aprovacao_trg(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION imobpesagens.sucata_nfa_exige_aprovacao_trg() TO service_role;

--
-- Name: FUNCTION sucata_pesos_imutaveis_trg(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION imobpesagens.sucata_pesos_imutaveis_trg() TO service_role;

--
-- Name: FUNCTION sucata_pode_escrever(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION imobpesagens.sucata_pode_escrever() TO authenticated;
GRANT ALL ON FUNCTION imobpesagens.sucata_pode_escrever() TO service_role;

--
-- Name: FUNCTION sucata_pode_ler(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION imobpesagens.sucata_pode_ler() TO authenticated;
GRANT ALL ON FUNCTION imobpesagens.sucata_pode_ler() TO service_role;

--
-- Name: FUNCTION sucata_posicao_faltante_bloco_a(_processo_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION imobpesagens.sucata_posicao_faltante_bloco_a(_processo_id uuid) TO service_role;

--
-- Name: FUNCTION sucata_processos_numero_trg(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION imobpesagens.sucata_processos_numero_trg() TO service_role;

--
-- Name: FUNCTION sucata_proteger_exclusao_logica_trg(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION imobpesagens.sucata_proteger_exclusao_logica_trg() TO service_role;

--
-- Name: FUNCTION sucata_proximo_numero(_ano integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION imobpesagens.sucata_proximo_numero(_ano integer) TO service_role;

--
-- Name: FUNCTION sucata_valida_bruto_trg(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION imobpesagens.sucata_valida_bruto_trg() TO service_role;

--
-- Name: FUNCTION sucata_valida_cnpj(_cnpj text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION imobpesagens.sucata_valida_cnpj(_cnpj text) TO authenticated;
GRANT ALL ON FUNCTION imobpesagens.sucata_valida_cnpj(_cnpj text) TO service_role;

--
-- Name: FUNCTION sucata_valida_cpf(_cpf text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION imobpesagens.sucata_valida_cpf(_cpf text) TO authenticated;
GRANT ALL ON FUNCTION imobpesagens.sucata_valida_cpf(_cpf text) TO service_role;

--
-- Name: FUNCTION sucata_valor_somente_portal_trg(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION imobpesagens.sucata_valor_somente_portal_trg() TO service_role;

--
-- Name: FUNCTION tem_acesso_obra(_obra_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION imobpesagens.tem_acesso_obra(_obra_id uuid) TO service_role;
GRANT ALL ON FUNCTION imobpesagens.tem_acesso_obra(_obra_id uuid) TO authenticated;

--
-- Name: FUNCTION update_updated_at_column(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION imobpesagens.update_updated_at_column() TO authenticated;
GRANT ALL ON FUNCTION imobpesagens.update_updated_at_column() TO service_role;

--
-- Name: FUNCTION usuario_do_app(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION imobpesagens.usuario_do_app() TO authenticated;
GRANT ALL ON FUNCTION imobpesagens.usuario_do_app() TO service_role;

--
-- Name: TABLE densidades_fornecedor; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE imobpesagens.densidades_fornecedor TO authenticated;
GRANT ALL ON TABLE imobpesagens.densidades_fornecedor TO service_role;

--
-- Name: TABLE densidades_material; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE imobpesagens.densidades_material TO authenticated;
GRANT ALL ON TABLE imobpesagens.densidades_material TO service_role;

--
-- Name: TABLE evidencias; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE imobpesagens.evidencias TO authenticated;
GRANT ALL ON TABLE imobpesagens.evidencias TO service_role;

--
-- Name: TABLE fornecedores_concreto; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE imobpesagens.fornecedores_concreto TO authenticated;
GRANT ALL ON TABLE imobpesagens.fornecedores_concreto TO service_role;

--
-- Name: TABLE fornecedores_material; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE imobpesagens.fornecedores_material TO authenticated;
GRANT ALL ON TABLE imobpesagens.fornecedores_material TO service_role;

--
-- Name: TABLE fornecedores_material_v2; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE imobpesagens.fornecedores_material_v2 TO authenticated;
GRANT ALL ON TABLE imobpesagens.fornecedores_material_v2 TO service_role;

--
-- Name: TABLE notas_fiscais; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE imobpesagens.notas_fiscais TO authenticated;
GRANT ALL ON TABLE imobpesagens.notas_fiscais TO service_role;

--
-- Name: TABLE obra_acessos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE imobpesagens.obra_acessos TO authenticated;
GRANT ALL ON TABLE imobpesagens.obra_acessos TO service_role;

--
-- Name: TABLE obras; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE imobpesagens.obras TO authenticated;
GRANT ALL ON TABLE imobpesagens.obras TO service_role;

--
-- Name: TABLE perfil_descricoes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE imobpesagens.perfil_descricoes TO authenticated;
GRANT ALL ON TABLE imobpesagens.perfil_descricoes TO service_role;

--
-- Name: TABLE perfil_menu_permissoes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE imobpesagens.perfil_menu_permissoes TO authenticated;
GRANT ALL ON TABLE imobpesagens.perfil_menu_permissoes TO service_role;

--
-- Name: TABLE pesagem_logs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE imobpesagens.pesagem_logs TO authenticated;
GRANT ALL ON TABLE imobpesagens.pesagem_logs TO service_role;

--
-- Name: TABLE pesagens; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE imobpesagens.pesagens TO authenticated;
GRANT ALL ON TABLE imobpesagens.pesagens TO service_role;

--
-- Name: COLUMN pesagens.selecionado_exclusao; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(selecionado_exclusao) ON TABLE imobpesagens.pesagens TO authenticated;

--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE imobpesagens.profiles TO authenticated;
GRANT ALL ON TABLE imobpesagens.profiles TO service_role;

--
-- Name: TABLE sefaz_certificados; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE imobpesagens.sefaz_certificados TO authenticated;
GRANT ALL ON TABLE imobpesagens.sefaz_certificados TO service_role;

--
-- Name: TABLE sucata_cfop; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE imobpesagens.sucata_cfop TO authenticated;
GRANT ALL ON TABLE imobpesagens.sucata_cfop TO service_role;

--
-- Name: TABLE sucata_contas_obra; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE imobpesagens.sucata_contas_obra TO authenticated;
GRANT ALL ON TABLE imobpesagens.sucata_contas_obra TO service_role;

--
-- Name: TABLE sucata_destinatarios_relatorio; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE imobpesagens.sucata_destinatarios_relatorio TO authenticated;
GRANT ALL ON TABLE imobpesagens.sucata_destinatarios_relatorio TO service_role;

--
-- Name: TABLE sucata_eventos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE imobpesagens.sucata_eventos TO authenticated;
GRANT ALL ON TABLE imobpesagens.sucata_eventos TO service_role;

--
-- Name: TABLE sucata_evidencias; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE imobpesagens.sucata_evidencias TO authenticated;
GRANT ALL ON TABLE imobpesagens.sucata_evidencias TO service_role;

--
-- Name: TABLE sucata_notificacoes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE imobpesagens.sucata_notificacoes TO authenticated;
GRANT ALL ON TABLE imobpesagens.sucata_notificacoes TO service_role;

--
-- Name: TABLE sucata_numeracao; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE imobpesagens.sucata_numeracao TO authenticated;
GRANT ALL ON TABLE imobpesagens.sucata_numeracao TO service_role;

--
-- Name: TABLE sucata_parametros; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE imobpesagens.sucata_parametros TO authenticated;
GRANT ALL ON TABLE imobpesagens.sucata_parametros TO service_role;

--
-- Name: TABLE sucata_processos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE imobpesagens.sucata_processos TO authenticated;
GRANT ALL ON TABLE imobpesagens.sucata_processos TO service_role;

--
-- Name: TABLE sucata_relatorios; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE imobpesagens.sucata_relatorios TO authenticated;
GRANT ALL ON TABLE imobpesagens.sucata_relatorios TO service_role;

--
-- Name: TABLE sucata_sucateiro_documentos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE imobpesagens.sucata_sucateiro_documentos TO authenticated;
GRANT ALL ON TABLE imobpesagens.sucata_sucateiro_documentos TO service_role;

--
-- Name: TABLE sucata_sucateiros; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE imobpesagens.sucata_sucateiros TO authenticated;
GRANT ALL ON TABLE imobpesagens.sucata_sucateiros TO service_role;

--
-- Name: TABLE sucata_tipos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE imobpesagens.sucata_tipos TO authenticated;
GRANT ALL ON TABLE imobpesagens.sucata_tipos TO service_role;

--
-- Name: TABLE sucata_veiculos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE imobpesagens.sucata_veiculos TO authenticated;
GRANT ALL ON TABLE imobpesagens.sucata_veiculos TO service_role;

--
-- Name: TABLE tolerancias_fornecedor; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE imobpesagens.tolerancias_fornecedor TO authenticated;
GRANT ALL ON TABLE imobpesagens.tolerancias_fornecedor TO service_role;

--
-- Name: TABLE tolerancias_fornecedor_v2; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE imobpesagens.tolerancias_fornecedor_v2 TO authenticated;
GRANT ALL ON TABLE imobpesagens.tolerancias_fornecedor_v2 TO service_role;

--
-- Name: TABLE tolerancias_material; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE imobpesagens.tolerancias_material TO authenticated;
GRANT ALL ON TABLE imobpesagens.tolerancias_material TO service_role;

--
-- Name: TABLE tolerancias_padrao; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE imobpesagens.tolerancias_padrao TO authenticated;
GRANT ALL ON TABLE imobpesagens.tolerancias_padrao TO service_role;

--
-- Name: TABLE tracos_concreto; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE imobpesagens.tracos_concreto TO authenticated;
GRANT ALL ON TABLE imobpesagens.tracos_concreto TO service_role;

--
-- Name: TABLE user_roles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE imobpesagens.user_roles TO authenticated;
GRANT ALL ON TABLE imobpesagens.user_roles TO service_role;

--
-- Name: TABLE usuario_coligadas; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE imobpesagens.usuario_coligadas TO authenticated;
GRANT ALL ON TABLE imobpesagens.usuario_coligadas TO service_role;

--
-- Name: TABLE whatsapp_alertas; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE imobpesagens.whatsapp_alertas TO authenticated;
GRANT ALL ON TABLE imobpesagens.whatsapp_alertas TO service_role;

--
-- Name: TABLE whatsapp_automacao_config; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE imobpesagens.whatsapp_automacao_config TO authenticated;
GRANT ALL ON TABLE imobpesagens.whatsapp_automacao_config TO service_role;

--
-- Name: TABLE whatsapp_config; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE imobpesagens.whatsapp_config TO authenticated;
GRANT ALL ON TABLE imobpesagens.whatsapp_config TO service_role;

--
-- Name: TABLE whatsapp_mensagens; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE imobpesagens.whatsapp_mensagens TO authenticated;
GRANT ALL ON TABLE imobpesagens.whatsapp_mensagens TO service_role;

--
-- Name: TABLE whatsapp_numeros; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE imobpesagens.whatsapp_numeros TO authenticated;
GRANT ALL ON TABLE imobpesagens.whatsapp_numeros TO service_role;

--
-- Name: TABLE whatsapp_templates; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE imobpesagens.whatsapp_templates TO authenticated;
GRANT ALL ON TABLE imobpesagens.whatsapp_templates TO service_role;

--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

--
-- PostgreSQL database dump complete
--

-- =====================================================================================================
-- Storage: buckets privados com prefixo imobpesagens- e policies com nome próprio
-- =====================================================================================================
insert into storage.buckets (id, name, public)
values ('imobpesagens-evidencias', 'imobpesagens-evidencias', false),
       ('imobpesagens-sucata-documentos', 'imobpesagens-sucata-documentos', false),
       ('imobpesagens-sucata-evidencias', 'imobpesagens-sucata-evidencias', false),
       ('imobpesagens-sucata-relatorios', 'imobpesagens-sucata-relatorios', false)
on conflict (id) do nothing;

drop policy if exists imobpesagens_evidencias_select on storage.objects;
create policy imobpesagens_evidencias_select on storage.objects for select to authenticated
  using (case when bucket_id = 'imobpesagens-evidencias' then imobpesagens.tem_acesso_obra(((storage.foldername(name))[1])::uuid) else false end);

drop policy if exists imobpesagens_evidencias_insert on storage.objects;
create policy imobpesagens_evidencias_insert on storage.objects for insert to authenticated
  with check (case when bucket_id = 'imobpesagens-evidencias' then imobpesagens.tem_acesso_obra(((storage.foldername(name))[1])::uuid) else false end);

drop policy if exists imobpesagens_evidencias_delete on storage.objects;
create policy imobpesagens_evidencias_delete on storage.objects for delete to authenticated
  using (case when bucket_id = 'imobpesagens-evidencias' then imobpesagens.tem_acesso_obra(((storage.foldername(name))[1])::uuid) else false end);

drop policy if exists imobpesagens_sucata_docs_select on storage.objects;
create policy imobpesagens_sucata_docs_select on storage.objects for select to authenticated
  using (bucket_id = 'imobpesagens-sucata-documentos' and (imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role) or imobpesagens.has_role(auth.uid(), 'superadmin'::imobpesagens.app_role) or imobpesagens.has_role(auth.uid(), 'coordenador'::imobpesagens.app_role) or imobpesagens.has_role(auth.uid(), 'operador'::imobpesagens.app_role)));

drop policy if exists imobpesagens_sucata_docs_insert on storage.objects;
create policy imobpesagens_sucata_docs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'imobpesagens-sucata-documentos' and (imobpesagens.has_role(auth.uid(), 'admin'::imobpesagens.app_role) or imobpesagens.has_role(auth.uid(), 'superadmin'::imobpesagens.app_role) or imobpesagens.has_role(auth.uid(), 'operador'::imobpesagens.app_role)));

drop policy if exists imobpesagens_sucata_evid_select on storage.objects;
create policy imobpesagens_sucata_evid_select on storage.objects for select to authenticated
  using (bucket_id = 'imobpesagens-sucata-evidencias' and imobpesagens.sucata_pode_ler());

drop policy if exists imobpesagens_sucata_evid_insert on storage.objects;
create policy imobpesagens_sucata_evid_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'imobpesagens-sucata-evidencias' and imobpesagens.sucata_pode_escrever());

drop policy if exists imobpesagens_sucata_relatorios_select on storage.objects;
create policy imobpesagens_sucata_relatorios_select on storage.objects for select to authenticated
  using (bucket_id = 'imobpesagens-sucata-relatorios' and imobpesagens.sucata_pode_ler());

commit;
