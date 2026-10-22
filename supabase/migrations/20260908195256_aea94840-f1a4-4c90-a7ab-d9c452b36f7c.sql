-- ============ Funções de validação de CPF/CNPJ ============
CREATE OR REPLACE FUNCTION public.sucata_valida_cnpj(_cnpj text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
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
END; $$;

CREATE OR REPLACE FUNCTION public.sucata_valida_cpf(_cpf text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
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
END; $$;

-- Papéis de escrita do módulo
CREATE OR REPLACE FUNCTION public.sucata_pode_escrever()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(),'admin')
      OR public.has_role(auth.uid(),'superadmin')
      OR public.has_role(auth.uid(),'operador');
$$;

CREATE OR REPLACE FUNCTION public.sucata_pode_ler()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(),'admin')
      OR public.has_role(auth.uid(),'superadmin')
      OR public.has_role(auth.uid(),'operador')
      OR public.has_role(auth.uid(),'coordenador');
$$;

-- ============ Sucateiros ============
CREATE TABLE IF NOT EXISTS public.sucata_sucateiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_pessoa text NOT NULL CHECK (tipo_pessoa IN ('PJ','PF')),
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
  situacao text NOT NULL DEFAULT 'EM_HOMOLOGACAO'
    CHECK (situacao IN ('EM_HOMOLOGACAO','ATIVO','BLOQUEADO')),
  observacoes text,
  coligada_origem text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sucata_sucateiros_pj_chk CHECK (
    tipo_pessoa <> 'PJ' OR (
      razao_social IS NOT NULL AND cnpj IS NOT NULL AND inscricao_estadual IS NOT NULL
      AND nome_completo IS NULL AND cpf IS NULL AND rg IS NULL
    )
  ),
  CONSTRAINT sucata_sucateiros_pf_chk CHECK (
    tipo_pessoa <> 'PF' OR (
      nome_completo IS NOT NULL AND cpf IS NOT NULL AND rg IS NOT NULL
      AND razao_social IS NULL AND cnpj IS NULL AND inscricao_estadual IS NULL
    )
  ),
  CONSTRAINT sucata_sucateiros_cnpj_valido CHECK (public.sucata_valida_cnpj(cnpj)),
  CONSTRAINT sucata_sucateiros_cpf_valido CHECK (public.sucata_valida_cpf(cpf))
);

CREATE UNIQUE INDEX IF NOT EXISTS sucata_sucateiros_cnpj_uidx
  ON public.sucata_sucateiros (cnpj) WHERE cnpj IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS sucata_sucateiros_cpf_uidx
  ON public.sucata_sucateiros (cpf) WHERE cpf IS NOT NULL;
CREATE INDEX IF NOT EXISTS sucata_sucateiros_coligada_idx ON public.sucata_sucateiros (coligada_origem);
CREATE INDEX IF NOT EXISTS sucata_sucateiros_situacao_idx ON public.sucata_sucateiros (situacao);

GRANT SELECT, INSERT, UPDATE ON public.sucata_sucateiros TO authenticated;
GRANT ALL ON public.sucata_sucateiros TO service_role;
ALTER TABLE public.sucata_sucateiros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sucateiros_select" ON public.sucata_sucateiros FOR SELECT TO authenticated
  USING (public.sucata_pode_ler() AND public.pode_ver_coligada(coligada_origem));
CREATE POLICY "sucateiros_insert" ON public.sucata_sucateiros FOR INSERT TO authenticated
  WITH CHECK (public.sucata_pode_escrever() AND public.pode_ver_coligada(coligada_origem));
CREATE POLICY "sucateiros_update" ON public.sucata_sucateiros FOR UPDATE TO authenticated
  USING (public.sucata_pode_escrever() AND public.pode_ver_coligada(coligada_origem))
  WITH CHECK (public.sucata_pode_escrever() AND public.pode_ver_coligada(coligada_origem));

CREATE TRIGGER trg_sucata_sucateiros_updated BEFORE UPDATE ON public.sucata_sucateiros
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ Documentos do sucateiro ============
CREATE TABLE IF NOT EXISTS public.sucata_sucateiro_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sucateiro_id uuid NOT NULL REFERENCES public.sucata_sucateiros(id),
  tipo text NOT NULL CHECK (tipo IN ('CARTAO_CNPJ','CONTRATO_SOCIAL','CPF','RG','COMPROV_RESIDENCIA','LICENCA_AMBIENTAL','OUTRO')),
  storage_path text NOT NULL,
  nome_arquivo text,
  validade date,
  versao integer NOT NULL DEFAULT 1,
  motivo_substituicao text,
  vigente boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sucata_doc_sucateiro_idx ON public.sucata_sucateiro_documentos (sucateiro_id);

GRANT SELECT, INSERT, UPDATE ON public.sucata_sucateiro_documentos TO authenticated;
GRANT ALL ON public.sucata_sucateiro_documentos TO service_role;
ALTER TABLE public.sucata_sucateiro_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sucata_doc_select" ON public.sucata_sucateiro_documentos FOR SELECT TO authenticated
  USING (public.sucata_pode_ler() AND EXISTS (
    SELECT 1 FROM public.sucata_sucateiros s
    WHERE s.id = sucateiro_id AND public.pode_ver_coligada(s.coligada_origem)));
CREATE POLICY "sucata_doc_insert" ON public.sucata_sucateiro_documentos FOR INSERT TO authenticated
  WITH CHECK (public.sucata_pode_escrever() AND EXISTS (
    SELECT 1 FROM public.sucata_sucateiros s
    WHERE s.id = sucateiro_id AND public.pode_ver_coligada(s.coligada_origem)));
CREATE POLICY "sucata_doc_update" ON public.sucata_sucateiro_documentos FOR UPDATE TO authenticated
  USING (public.sucata_pode_escrever() AND EXISTS (
    SELECT 1 FROM public.sucata_sucateiros s
    WHERE s.id = sucateiro_id AND public.pode_ver_coligada(s.coligada_origem)))
  WITH CHECK (public.sucata_pode_escrever());

-- ============ Veículos ============
CREATE TABLE IF NOT EXISTS public.sucata_veiculos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sucateiro_id uuid NOT NULL REFERENCES public.sucata_sucateiros(id),
  placa text NOT NULL,
  tipo_veiculo text,
  capacidade_kg integer,
  motorista_habitual text,
  situacao text NOT NULL DEFAULT 'ATIVO' CHECK (situacao IN ('ATIVO','BLOQUEADO')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sucata_veiculos_placa_ativa_uidx
  ON public.sucata_veiculos (upper(placa)) WHERE situacao = 'ATIVO';
CREATE INDEX IF NOT EXISTS sucata_veiculos_sucateiro_idx ON public.sucata_veiculos (sucateiro_id);
CREATE INDEX IF NOT EXISTS sucata_veiculos_placa_idx ON public.sucata_veiculos (upper(placa));

GRANT SELECT, INSERT, UPDATE ON public.sucata_veiculos TO authenticated;
GRANT ALL ON public.sucata_veiculos TO service_role;
ALTER TABLE public.sucata_veiculos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sucata_veic_select" ON public.sucata_veiculos FOR SELECT TO authenticated
  USING (public.sucata_pode_ler() AND EXISTS (
    SELECT 1 FROM public.sucata_sucateiros s
    WHERE s.id = sucateiro_id AND public.pode_ver_coligada(s.coligada_origem)));
CREATE POLICY "sucata_veic_insert" ON public.sucata_veiculos FOR INSERT TO authenticated
  WITH CHECK (public.sucata_pode_escrever() AND EXISTS (
    SELECT 1 FROM public.sucata_sucateiros s
    WHERE s.id = sucateiro_id AND public.pode_ver_coligada(s.coligada_origem)));
CREATE POLICY "sucata_veic_update" ON public.sucata_veiculos FOR UPDATE TO authenticated
  USING (public.sucata_pode_escrever() AND EXISTS (
    SELECT 1 FROM public.sucata_sucateiros s
    WHERE s.id = sucateiro_id AND public.pode_ver_coligada(s.coligada_origem)))
  WITH CHECK (public.sucata_pode_escrever());

CREATE TRIGGER trg_sucata_veiculos_updated BEFORE UPDATE ON public.sucata_veiculos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ Tipos de sucata ============
CREATE TABLE IF NOT EXISTS public.sucata_tipos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL,
  nome text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sucata_tipos_codigo_uidx ON public.sucata_tipos (upper(codigo));

GRANT SELECT, INSERT, UPDATE ON public.sucata_tipos TO authenticated;
GRANT ALL ON public.sucata_tipos TO service_role;
ALTER TABLE public.sucata_tipos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sucata_tipos_select" ON public.sucata_tipos FOR SELECT TO authenticated
  USING (public.sucata_pode_ler());
CREATE POLICY "sucata_tipos_insert" ON public.sucata_tipos FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'));
CREATE POLICY "sucata_tipos_update" ON public.sucata_tipos FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'));

CREATE TRIGGER trg_sucata_tipos_updated BEFORE UPDATE ON public.sucata_tipos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ Numeração SUC-NNNN/AAAA ============
CREATE TABLE IF NOT EXISTS public.sucata_numeracao (
  ano integer PRIMARY KEY,
  ultimo integer NOT NULL DEFAULT 0
);
GRANT ALL ON public.sucata_numeracao TO service_role;
ALTER TABLE public.sucata_numeracao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sucata_num_service" ON public.sucata_numeracao FOR SELECT TO authenticated USING (false);

CREATE OR REPLACE FUNCTION public.sucata_proximo_numero(_ano integer)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  INSERT INTO public.sucata_numeracao (ano, ultimo) VALUES (_ano, 1)
  ON CONFLICT (ano) DO UPDATE SET ultimo = public.sucata_numeracao.ultimo + 1
  RETURNING ultimo INTO n;
  RETURN 'SUC-' || lpad(n::text, 4, '0') || '/' || _ano::text;
END; $$;

-- ============ Processos ============
CREATE TABLE IF NOT EXISTS public.sucata_processos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  ano integer NOT NULL,
  obra_id uuid NOT NULL REFERENCES public.obras(id),
  coligada_origem text NOT NULL,
  sucateiro_id uuid NOT NULL REFERENCES public.sucata_sucateiros(id),
  veiculo_id uuid REFERENCES public.sucata_veiculos(id),
  placa text NOT NULL,
  motorista text,
  documento_motorista text,
  snapshot_fiscal jsonb NOT NULL DEFAULT '{}'::jsonb,
  tara_kg numeric NOT NULL,
  bruto_kg numeric,
  peso_aferido_kg numeric GENERATED ALWAYS AS (bruto_kg - tara_kg) STORED,
  tipo_sucata_id uuid REFERENCES public.sucata_tipos(id),
  fase text NOT NULL DEFAULT 'F01' CHECK (fase IN ('F01','F02','F03','F04')),
  situacao text NOT NULL DEFAULT 'PENDENTE' CHECK (situacao IN ('PENDENTE','CONCLUIDO','BLOQUEADO')),
  entrada_em timestamptz NOT NULL DEFAULT now(),
  saida_em timestamptz,
  created_by uuid,
  saida_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sucata_proc_coligada_idx ON public.sucata_processos (coligada_origem);
CREATE INDEX IF NOT EXISTS sucata_proc_placa_idx ON public.sucata_processos (upper(placa));
CREATE INDEX IF NOT EXISTS sucata_proc_situacao_idx ON public.sucata_processos (situacao);
CREATE INDEX IF NOT EXISTS sucata_proc_obra_idx ON public.sucata_processos (obra_id);
CREATE INDEX IF NOT EXISTS sucata_proc_sucateiro_idx ON public.sucata_processos (sucateiro_id);
CREATE INDEX IF NOT EXISTS sucata_proc_veiculo_idx ON public.sucata_processos (veiculo_id);
CREATE INDEX IF NOT EXISTS sucata_proc_tipo_idx ON public.sucata_processos (tipo_sucata_id);
CREATE INDEX IF NOT EXISTS sucata_proc_created_idx ON public.sucata_processos (created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.sucata_processos TO authenticated;
GRANT ALL ON public.sucata_processos TO service_role;
ALTER TABLE public.sucata_processos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sucata_proc_select" ON public.sucata_processos FOR SELECT TO authenticated
  USING (public.sucata_pode_ler() AND public.pode_ver_coligada(coligada_origem));
CREATE POLICY "sucata_proc_insert" ON public.sucata_processos FOR INSERT TO authenticated
  WITH CHECK (public.sucata_pode_escrever() AND public.pode_ver_coligada(coligada_origem));
CREATE POLICY "sucata_proc_update" ON public.sucata_processos FOR UPDATE TO authenticated
  USING (public.sucata_pode_escrever() AND public.pode_ver_coligada(coligada_origem))
  WITH CHECK (public.sucata_pode_escrever() AND public.pode_ver_coligada(coligada_origem));

CREATE TRIGGER trg_sucata_processos_updated BEFORE UPDATE ON public.sucata_processos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Número gerado no banco quando não informado
CREATE OR REPLACE FUNCTION public.sucata_processos_numero_trg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.ano IS NULL THEN
    NEW.ano := EXTRACT(YEAR FROM (now() AT TIME ZONE 'America/Sao_Paulo'))::int;
  END IF;
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := public.sucata_proximo_numero(NEW.ano);
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_sucata_processos_numero BEFORE INSERT ON public.sucata_processos
  FOR EACH ROW EXECUTE FUNCTION public.sucata_processos_numero_trg();

-- ============ Eventos (auditoria) ============
CREATE TABLE IF NOT EXISTS public.sucata_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid REFERENCES public.sucata_processos(id),
  entidade text NOT NULL,
  entidade_id uuid,
  fase text,
  acao text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  coligada_origem text,
  usuario_id uuid,
  usuario_nome text,
  usuario_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sucata_ev_processo_idx ON public.sucata_eventos (processo_id);
CREATE INDEX IF NOT EXISTS sucata_ev_entidade_idx ON public.sucata_eventos (entidade, entidade_id);
CREATE INDEX IF NOT EXISTS sucata_ev_created_idx ON public.sucata_eventos (created_at DESC);

GRANT SELECT, INSERT ON public.sucata_eventos TO authenticated;
GRANT ALL ON public.sucata_eventos TO service_role;
ALTER TABLE public.sucata_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sucata_ev_select" ON public.sucata_eventos FOR SELECT TO authenticated
  USING (public.sucata_pode_ler() AND (coligada_origem IS NULL OR public.pode_ver_coligada(coligada_origem)));
CREATE POLICY "sucata_ev_insert" ON public.sucata_eventos FOR INSERT TO authenticated
  WITH CHECK (public.sucata_pode_escrever() AND usuario_id = auth.uid());

-- ============ Tipos de sucata iniciais ============
INSERT INTO public.sucata_tipos (codigo, nome, ordem)
VALUES ('FERRO_MISTO','Ferro misto',1),
       ('ESTAMPARIA','Estamparia',2),
       ('CAVACO','Cavaco',3),
       ('PERFIL','Perfil / estrutural',4),
       ('ARAME','Arame e retalho',5)
ON CONFLICT DO NOTHING;