
CREATE TABLE public.tolerancias_material (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria text NOT NULL,
  condicao text NOT NULL CHECK (condicao IN ('seco','umido','na')),
  palavras_chave text NOT NULL DEFAULT '',
  tolerancia_pct numeric NOT NULL DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX tolerancias_material_cat_cond_idx
  ON public.tolerancias_material (lower(categoria), condicao);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tolerancias_material TO authenticated;
GRANT ALL ON public.tolerancias_material TO service_role;

ALTER TABLE public.tolerancias_material ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ler tolerâncias"
  ON public.tolerancias_material FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admin insere tolerâncias"
  ON public.tolerancias_material FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admin atualiza tolerâncias"
  ON public.tolerancias_material FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admin remove tolerâncias"
  ON public.tolerancias_material FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_tolerancias_material_updated
  BEFORE UPDATE ON public.tolerancias_material
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.tolerancias_material (categoria, condicao, palavras_chave, tolerancia_pct) VALUES
  ('Cimento','na','cimento, cp-, cp ii, cp iv, cp v',1),
  ('Concreto','na','concreto, usinado, fck',3),
  ('Areia fina','seco','areia fina, areia natural fina',2),
  ('Areia fina','umido','areia fina umida, areia fina úmida',8),
  ('Areia média','seco','areia media, areia média, areia natural media',2),
  ('Areia média','umido','areia media umida, areia média úmida',6),
  ('Pó de pedra','seco','po de pedra, pó de pedra, po pedra',3),
  ('Pó de pedra','umido','po de pedra umido, pó de pedra úmido',7),
  ('Brita 0','seco','brita 0, brita zero, pedrisco',2),
  ('Brita 0','umido','brita 0 umido, brita 0 úmido',4),
  ('Brita 1','seco','brita 1, brita um',2),
  ('Brita 1','umido','brita 1 umido, brita 1 úmido',3),
  ('Brita 2','seco','brita 2, brita dois',2),
  ('Brita 2','umido','brita 2 umido, brita 2 úmido',3),
  ('BGS','seco','bgs, brita graduada',3),
  ('BGS','umido','bgs umido, bgs úmido',6),
  ('Bica corrida','seco','bica corrida, bica',3),
  ('Bica corrida','umido','bica corrida umida, bica corrida úmida',7),
  ('Outros','na','',3)
ON CONFLICT DO NOTHING;
