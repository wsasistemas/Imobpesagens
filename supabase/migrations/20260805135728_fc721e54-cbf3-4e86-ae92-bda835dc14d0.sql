ALTER TABLE public.tolerancias_material DROP COLUMN IF EXISTS fornecedor;

CREATE TABLE IF NOT EXISTS public.fornecedores_material (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cnpj text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fornecedores_material TO authenticated;
GRANT ALL ON public.fornecedores_material TO service_role;
ALTER TABLE public.fornecedores_material ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem fornecedores de material"
  ON public.fornecedores_material FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin insere fornecedores de material"
  ON public.fornecedores_material FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin atualiza fornecedores de material"
  ON public.fornecedores_material FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin remove fornecedores de material"
  ON public.fornecedores_material FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_fornecedores_material_updated BEFORE UPDATE ON public.fornecedores_material
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.tolerancias_fornecedor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id uuid NOT NULL REFERENCES public.fornecedores_material(id) ON DELETE CASCADE,
  tolerancia_material_id uuid NOT NULL REFERENCES public.tolerancias_material(id) ON DELETE CASCADE,
  tolerancia numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fornecedor_id, tolerancia_material_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tolerancias_fornecedor TO authenticated;
GRANT ALL ON public.tolerancias_fornecedor TO service_role;
ALTER TABLE public.tolerancias_fornecedor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem tolerancias por fornecedor"
  ON public.tolerancias_fornecedor FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin insere tolerancias por fornecedor"
  ON public.tolerancias_fornecedor FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin atualiza tolerancias por fornecedor"
  ON public.tolerancias_fornecedor FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin remove tolerancias por fornecedor"
  ON public.tolerancias_fornecedor FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_tolerancias_fornecedor_updated BEFORE UPDATE ON public.tolerancias_fornecedor
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();