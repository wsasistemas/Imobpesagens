-- 1. Tabela Padrão (Modelo Base)
CREATE TABLE IF NOT EXISTS public.tolerancias_padrao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria text NOT NULL,
  condicao text NOT NULL DEFAULT 'Seco' CHECK (condicao IN ('Seco', 'Úmido')),
  palavras_chave text,
  tolerancia numeric NOT NULL DEFAULT 2,
  ordem int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

GRANT SELECT ON public.tolerancias_padrao TO authenticated;
GRANT ALL ON public.tolerancias_padrao TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.tolerancias_padrao TO authenticated;

-- 2. Tabela de Fornecedores de Material
CREATE TABLE IF NOT EXISTS public.fornecedores_material_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social text NOT NULL,
  cnpj text, -- 14 dígitos
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  created_by_nome text,
  ativo boolean NOT NULL DEFAULT true
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fornecedores_material_v2 TO authenticated;
GRANT ALL ON public.fornecedores_material_v2 TO service_role;

-- 3. Tabela de Overrides (Herança)
CREATE TABLE IF NOT EXISTS public.tolerancias_fornecedor_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id uuid NOT NULL REFERENCES public.fornecedores_material_v2(id) ON DELETE CASCADE,
  tolerancia_padrao_id uuid NOT NULL REFERENCES public.tolerancias_padrao(id) ON DELETE CASCADE,
  tolerancia numeric NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (fornecedor_id, tolerancia_padrao_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tolerancias_fornecedor_v2 TO authenticated;
GRANT ALL ON public.tolerancias_fornecedor_v2 TO service_role;

-- RLS
ALTER TABLE public.tolerancias_padrao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fornecedores_material_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tolerancias_fornecedor_v2 ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Leitura pública para autenticados" ON public.tolerancias_padrao FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin pode editar padrão" ON public.tolerancias_padrao FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Usuários autenticados podem gerir fornecedores" ON public.fornecedores_material_v2 FOR ALL TO authenticated USING (true);
CREATE POLICY "Usuários autenticados podem gerir overrides" ON public.tolerancias_fornecedor_v2 FOR ALL TO authenticated USING (true);

-- Migração de dados iniciais para tolerancias_padrao
INSERT INTO public.tolerancias_padrao (categoria, condicao, palavras_chave, tolerancia, ordem)
SELECT categoria, 
       CASE WHEN condicao = 'umido' THEN 'Úmido' ELSE 'Seco' END, 
       palavras_chave, 
       tolerancia_pct,
       0
FROM public.tolerancias_material
ON CONFLICT DO NOTHING;
