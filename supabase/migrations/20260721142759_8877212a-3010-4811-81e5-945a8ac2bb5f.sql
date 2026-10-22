
-- =========================================================
-- Portal de Pesagem — Schema base (Fase 3)
-- =========================================================

-- Enums
CREATE TYPE public.app_role AS ENUM ('admin','operador');
CREATE TYPE public.fonte_nota AS ENUM ('sefaz','ocr','ocr_pendente','manual');
CREATE TYPE public.fonte_peso AS ENUM ('balanca','manual');
CREATE TYPE public.status_pesagem AS ENUM ('aguardando_saida','concluida','recusado');
CREATE TYPE public.tipo_evidencia AS ENUM ('placa','carga','lateral','nota','outro');

-- ---------- updated_at helper ----------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- =========================================================
-- OBRAS
-- =========================================================
CREATE TABLE public.obras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  coligada text NOT NULL,
  cnpj text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.obras TO authenticated;
GRANT ALL ON public.obras TO service_role;
ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_obras_updated BEFORE UPDATE ON public.obras
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- ROLES
-- =========================================================
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "Users see own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- ACESSO POR OBRA
-- =========================================================
CREATE TABLE public.obra_acessos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(obra_id, user_id)
);
GRANT SELECT ON public.obra_acessos TO authenticated;
GRANT ALL ON public.obra_acessos TO service_role;
ALTER TABLE public.obra_acessos ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.tem_acesso_obra(_obra_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(),'admin')
      OR EXISTS (SELECT 1 FROM public.obra_acessos WHERE obra_id=_obra_id AND user_id=auth.uid());
$$;

CREATE POLICY "Ver acessos das próprias obras" ON public.obra_acessos FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin gerencia acessos" ON public.obra_acessos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Obras policies (depende de has_role)
CREATE POLICY "Ver obras liberadas" ON public.obras FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin')
      OR EXISTS (SELECT 1 FROM public.obra_acessos WHERE obra_id = obras.id AND user_id = auth.uid()));
CREATE POLICY "Admin gerencia obras" ON public.obras FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =========================================================
-- HANDLE NEW USER — só @calper.com.br verificado ganha 'operador'
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_calper_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL
     AND lower(split_part(NEW.email,'@',2)) = 'calper.com.br' THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id,'operador')
      ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created_calper
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_calper_user();

CREATE TRIGGER on_auth_user_confirmed_calper
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.handle_calper_user();

-- =========================================================
-- PESAGENS
-- =========================================================
CREATE TABLE public.pesagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.obras(id),
  chave_nfe text,
  numero_nota text,
  emissao timestamptz,
  emissor text,
  transportadora text,
  placa text,
  uf text,
  motorista text,
  descricao text,
  peso_nf numeric,
  fonte_nota public.fonte_nota NOT NULL DEFAULT 'manual',
  peso_entrada numeric,
  peso_saida numeric,
  fonte_peso_entrada public.fonte_peso,
  fonte_peso_saida public.fonte_peso,
  entrou_em timestamptz,
  saiu_em timestamptz,
  status public.status_pesagem NOT NULL DEFAULT 'aguardando_saida',
  justificativa text,
  peso_liquido numeric GENERATED ALWAYS AS (
    CASE WHEN peso_entrada IS NOT NULL AND peso_saida IS NOT NULL
         THEN abs(peso_entrada - peso_saida) END
  ) STORED,
  criado_por uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pesagens TO authenticated;
GRANT ALL ON public.pesagens TO service_role;
ALTER TABLE public.pesagens ENABLE ROW LEVEL SECURITY;
CREATE INDEX ix_pesagens_obra_status ON public.pesagens(obra_id, status);
CREATE INDEX ix_pesagens_obra_saiu ON public.pesagens(obra_id, saiu_em);
CREATE TRIGGER trg_pesagens_updated BEFORE UPDATE ON public.pesagens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Ver pesagens da obra" ON public.pesagens FOR SELECT TO authenticated
  USING (public.tem_acesso_obra(obra_id));
CREATE POLICY "Criar pesagens em obra liberada" ON public.pesagens FOR INSERT TO authenticated
  WITH CHECK (public.tem_acesso_obra(obra_id) AND criado_por = auth.uid());
CREATE POLICY "Editar pesagens da obra" ON public.pesagens FOR UPDATE TO authenticated
  USING (public.tem_acesso_obra(obra_id)) WITH CHECK (public.tem_acesso_obra(obra_id));
CREATE POLICY "Admin apaga pesagens" ON public.pesagens FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- =========================================================
-- EVIDÊNCIAS (metadados; binários no Storage)
-- =========================================================
CREATE TABLE public.evidencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pesagem_id uuid NOT NULL REFERENCES public.pesagens(id) ON DELETE CASCADE,
  tipo public.tipo_evidencia NOT NULL,
  storage_path text NOT NULL,
  nome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.evidencias TO authenticated;
GRANT ALL ON public.evidencias TO service_role;
ALTER TABLE public.evidencias ENABLE ROW LEVEL SECURITY;
CREATE INDEX ix_evidencias_pesagem ON public.evidencias(pesagem_id);

CREATE POLICY "Ver evidencias da obra" ON public.evidencias FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pesagens p WHERE p.id = pesagem_id AND public.tem_acesso_obra(p.obra_id)));
CREATE POLICY "Criar evidencias em obra liberada" ON public.evidencias FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.pesagens p WHERE p.id = pesagem_id AND public.tem_acesso_obra(p.obra_id)));
CREATE POLICY "Apagar evidencias da obra" ON public.evidencias FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pesagens p WHERE p.id = pesagem_id AND public.tem_acesso_obra(p.obra_id)));

-- =========================================================
-- NOTAS FISCAIS (cache SEFAZ)
-- =========================================================
CREATE TABLE public.notas_fiscais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid REFERENCES public.obras(id),
  chave text UNIQUE NOT NULL,
  numero text,
  emissao timestamptz,
  emissor text,
  emissor_cnpj text,
  destinatario_cnpj text,
  transportadora text,
  placa text,
  uf text,
  peso numeric,
  descricao text,
  xml text,
  fonte public.fonte_nota NOT NULL DEFAULT 'sefaz',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.notas_fiscais TO authenticated;
GRANT ALL ON public.notas_fiscais TO service_role;
ALTER TABLE public.notas_fiscais ENABLE ROW LEVEL SECURITY;
CREATE INDEX ix_notas_obra ON public.notas_fiscais(obra_id);
CREATE TRIGGER trg_notas_updated BEFORE UPDATE ON public.notas_fiscais
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Escrita apenas via service_role (edge/server-fn confiável)
CREATE POLICY "Ver notas da obra" ON public.notas_fiscais FOR SELECT TO authenticated
  USING (obra_id IS NULL OR public.tem_acesso_obra(obra_id));

-- =========================================================
-- CERTIFICADOS SEFAZ (metadados; .pfx no Vault via secret)
-- =========================================================
CREATE TABLE public.sefaz_certificados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  cnpj text NOT NULL,
  ambiente text NOT NULL DEFAULT 'producao' CHECK (ambiente IN ('producao','homologacao')),
  certificado_nome text,
  vault_secret_name text,
  ultimo_nsu text,
  notas_cache_count integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sefaz_certificados TO authenticated;
GRANT ALL ON public.sefaz_certificados TO service_role;
ALTER TABLE public.sefaz_certificados ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_sefaz_updated BEFORE UPDATE ON public.sefaz_certificados
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Admin ve certificados" ON public.sefaz_certificados FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin gerencia certificados" ON public.sefaz_certificados FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =========================================================
-- RPC do dashboard
-- =========================================================
CREATE OR REPLACE FUNCTION public.dashboard_recebimento(_obra_id uuid, _ini timestamptz, _fim timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.tem_acesso_obra(_obra_id) THEN
    RAISE EXCEPTION 'Sem acesso à obra';
  END IF;

  WITH base AS (
    SELECT * FROM public.pesagens
    WHERE obra_id = _obra_id AND status = 'concluida'
      AND COALESCE(saiu_em, created_at) >= _ini
      AND COALESCE(saiu_em, created_at) <  _fim
  ),
  kpis AS (
    SELECT
      COALESCE(SUM(peso_liquido),0) AS total_kg,
      COUNT(*) AS total_receb,
      COUNT(DISTINCT emissor) FILTER (WHERE emissor IS NOT NULL) AS total_forn,
      COALESCE(SUM(ABS(peso_liquido - peso_nf)) FILTER (WHERE peso_nf IS NOT NULL AND peso_nf > 0),0) AS diverg,
      COALESCE(SUM(peso_nf) FILTER (WHERE peso_nf IS NOT NULL AND peso_nf > 0),0) AS peso_nf_tot
    FROM base
  ),
  top_merc AS (
    SELECT COALESCE(NULLIF(trim(descricao),''),'Sem descrição') AS nome,
           SUM(peso_liquido) AS peso,
           COUNT(*) AS qtd,
           (SELECT emissor FROM base b2
             WHERE COALESCE(NULLIF(trim(b2.descricao),''),'Sem descrição') = COALESCE(NULLIF(trim(base.descricao),''),'Sem descrição')
             GROUP BY emissor ORDER BY SUM(peso_liquido) DESC NULLS LAST LIMIT 1) AS principal
    FROM base GROUP BY 1 ORDER BY peso DESC NULLS LAST LIMIT 10
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

GRANT EXECUTE ON FUNCTION public.dashboard_recebimento(uuid, timestamptz, timestamptz) TO authenticated;

-- =========================================================
-- SEED — obras iniciais da Calper
-- =========================================================
INSERT INTO public.obras (nome, coligada, cnpj) VALUES
  ('Calper — Obra Centro','Calper 01','12.345.678/0001-90'),
  ('Calper — Obra Norte','Calper 02','12.345.678/0002-71'),
  ('Calper — Obra Sul','Calper 03','12.345.678/0003-52');
