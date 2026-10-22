CREATE TABLE IF NOT EXISTS public.sucata_cfop (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  descricao text NOT NULL,
  escopo text NOT NULL DEFAULT 'INTERNO',
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sucata_cfop TO authenticated;
GRANT ALL ON public.sucata_cfop TO service_role;

ALTER TABLE public.sucata_cfop ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sucata_cfop_select" ON public.sucata_cfop;
CREATE POLICY "sucata_cfop_select" ON public.sucata_cfop
  FOR SELECT TO authenticated USING (public.sucata_pode_ler());

DROP POLICY IF EXISTS "sucata_cfop_insert" ON public.sucata_cfop;
CREATE POLICY "sucata_cfop_insert" ON public.sucata_cfop
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'));

DROP POLICY IF EXISTS "sucata_cfop_update" ON public.sucata_cfop;
CREATE POLICY "sucata_cfop_update" ON public.sucata_cfop
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'));

DROP TRIGGER IF EXISTS trg_sucata_cfop_updated ON public.sucata_cfop;
CREATE TRIGGER trg_sucata_cfop_updated BEFORE UPDATE ON public.sucata_cfop
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.sucata_cfop (codigo, descricao, escopo, ordem) VALUES
  ('5.102', 'Venda de mercadoria adquirida ou recebida de terceiros', 'INTERNO', 1),
  ('5.101', 'Venda de produção do estabelecimento', 'INTERNO', 2),
  ('5.949', 'Outra saída de mercadoria ou prestação de serviço não especificado', 'INTERNO', 3),
  ('6.102', 'Venda de mercadoria adquirida ou recebida de terceiros', 'INTERESTADUAL', 4),
  ('6.101', 'Venda de produção do estabelecimento', 'INTERESTADUAL', 5),
  ('6.949', 'Outra saída de mercadoria ou prestação de serviço não especificado', 'INTERESTADUAL', 6)
ON CONFLICT (codigo) DO NOTHING;

ALTER TABLE public.sucata_processos ADD COLUMN IF NOT EXISTS nfa_natureza_operacao text;
ALTER TABLE public.sucata_processos ADD COLUMN IF NOT EXISTS nfa_cfop text;
ALTER TABLE public.sucata_processos ADD COLUMN IF NOT EXISTS nfa_formulario jsonb NOT NULL DEFAULT '{}'::jsonb;