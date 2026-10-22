CREATE TABLE public.perfil_menu_permissoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role text NOT NULL,
  menu_key text NOT NULL,
  permitido boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, menu_key)
);

GRANT SELECT ON public.perfil_menu_permissoes TO authenticated;
GRANT ALL ON public.perfil_menu_permissoes TO service_role;
ALTER TABLE public.perfil_menu_permissoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ver permissoes de menu"
ON public.perfil_menu_permissoes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins gerenciam permissoes de menu"
ON public.perfil_menu_permissoes FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'));

CREATE TRIGGER trg_perfil_menu_permissoes_updated
BEFORE UPDATE ON public.perfil_menu_permissoes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.perfil_descricoes (
  role text NOT NULL PRIMARY KEY,
  nome text NOT NULL,
  descricao text,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.perfil_descricoes TO authenticated;
GRANT ALL ON public.perfil_descricoes TO service_role;
ALTER TABLE public.perfil_descricoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ver perfis"
ON public.perfil_descricoes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins gerenciam perfis"
ON public.perfil_descricoes FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'));

CREATE TRIGGER trg_perfil_descricoes_updated
BEFORE UPDATE ON public.perfil_descricoes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.perfil_descricoes (role, nome, descricao, ordem) VALUES
  ('superadmin','SuperAdmin','Acesso total ao sistema, incluindo permissões e exclusões definitivas.',1),
  ('admin','Administradores','Gestão completa da operação, dashboards e configurações.',2),
  ('coordenador','Coordenadores','Visão gerencial: dashboards e relatórios, sem configurações.',3),
  ('operador','Operadores','Rotina de pesagem (entrada e saída de veículos).',4);

INSERT INTO public.perfil_menu_permissoes (role, menu_key, permitido) VALUES
  ('superadmin','pesagem',true),
  ('superadmin','dashboard',true),
  ('superadmin','relatorios_ocorrencias',true),
  ('superadmin','configuracoes',true),
  ('superadmin','conectar_assistente',true),
  ('superadmin','documentacao',true),
  ('superadmin','treinamento',true),
  ('admin','pesagem',true),
  ('admin','dashboard',true),
  ('admin','relatorios_ocorrencias',true),
  ('admin','configuracoes',true),
  ('admin','conectar_assistente',true),
  ('admin','documentacao',true),
  ('admin','treinamento',true),
  ('coordenador','pesagem',false),
  ('coordenador','dashboard',true),
  ('coordenador','relatorios_ocorrencias',true),
  ('coordenador','configuracoes',false),
  ('coordenador','conectar_assistente',true),
  ('coordenador','documentacao',false),
  ('coordenador','treinamento',true),
  ('operador','pesagem',true),
  ('operador','dashboard',false),
  ('operador','relatorios_ocorrencias',true),
  ('operador','configuracoes',false),
  ('operador','conectar_assistente',true),
  ('operador','documentacao',false),
  ('operador','treinamento',true);