CREATE TABLE public.densidades_material (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material text NOT NULL,
  palavras_chave text[] NOT NULL DEFAULT '{}',
  unidade_base text NOT NULL DEFAULT 'M3',
  densidade numeric NOT NULL,
  ordem integer NOT NULL DEFAULT 100,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.densidades_fornecedor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  densidade_material_id uuid NOT NULL REFERENCES public.densidades_material(id) ON DELETE CASCADE,
  fornecedor_nome text NOT NULL,
  densidade numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (densidade_material_id, fornecedor_nome)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.densidades_material TO authenticated;
GRANT ALL ON public.densidades_material TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.densidades_fornecedor TO authenticated;
GRANT ALL ON public.densidades_fornecedor TO service_role;

ALTER TABLE public.densidades_material ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.densidades_fornecedor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "densidades_material_leitura" ON public.densidades_material
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin')
    OR public.has_role(auth.uid(),'operador') OR public.has_role(auth.uid(),'coordenador')
  );

CREATE POLICY "densidades_material_admin" ON public.densidades_material
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'));

CREATE POLICY "densidades_fornecedor_leitura" ON public.densidades_fornecedor
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin')
    OR public.has_role(auth.uid(),'operador') OR public.has_role(auth.uid(),'coordenador')
  );

CREATE POLICY "densidades_fornecedor_admin" ON public.densidades_fornecedor
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'));

CREATE TRIGGER trg_densidades_material_updated BEFORE UPDATE ON public.densidades_material
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_densidades_fornecedor_updated BEFORE UPDATE ON public.densidades_fornecedor
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.densidades_material (material, palavras_chave, unidade_base, densidade, ordem) VALUES
  ('Concreto magro', ARRAY['CONCRETO','MAGRO'], 'M3', 2300, 10),
  ('Concreto para lastro', ARRAY['CONCRETO','LASTRO'], 'M3', 2300, 20),
  ('Concreto leve', ARRAY['CONCRETO','LEVE'], 'M3', 1800, 30),
  ('Concreto', ARRAY['CONCRETO'], 'M3', 2400, 40),
  ('Argamassa', ARRAY['ARGAMASSA'], 'M3', 2100, 50),
  ('Areia', ARRAY['AREIA'], 'M3', 1500, 60),
  ('Brita', ARRAY['BRITA'], 'M3', 1450, 70),
  ('Pedra', ARRAY['PEDRA'], 'M3', 1450, 80),
  ('Seixo', ARRAY['SEIXO'], 'M3', 1500, 90),
  ('Rachão', ARRAY['RACHAO'], 'M3', 1500, 100),
  ('Cimento', ARRAY['CIMENTO'], 'M3', 1400, 110),
  ('Água', ARRAY['AGUA'], 'L', 1, 120),
  ('Aditivo', ARRAY['ADITIVO'], 'L', 1.15, 130),
  ('Cimento (saco)', ARRAY['CIMENTO'], 'SC', 50, 140),
  ('Argamassa (saco)', ARRAY['ARGAMASSA'], 'SC', 20, 150),
  ('Cal (saco)', ARRAY['CAL'], 'SC', 20, 160);