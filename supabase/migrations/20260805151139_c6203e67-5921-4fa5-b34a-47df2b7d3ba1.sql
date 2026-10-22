ALTER TABLE public.fornecedores_material_v2 
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'lista' CHECK (origem IN ('lista', 'manual')),
  ADD COLUMN IF NOT EXISTS vinculado boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_fornecedores_material_v2_updated_at ON public.fornecedores_material_v2;
CREATE TRIGGER update_fornecedores_material_v2_updated_at
    BEFORE UPDATE ON public.fornecedores_material_v2
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
