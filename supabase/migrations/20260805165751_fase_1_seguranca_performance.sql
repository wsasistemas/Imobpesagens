-- Fase 1: Segurança e RLS Crítica
-- 1. Remover Grants DML excessivos de usuários autenticados em tabelas sensíveis
REVOKE INSERT, UPDATE, DELETE ON public.tolerancias_padrao FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.fornecedores_material_v2 FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.tolerancias_fornecedor_v2 FROM authenticated;

-- Garantir que service_role mantenha acesso total
GRANT ALL ON public.tolerancias_padrao TO service_role;
GRANT ALL ON public.fornecedores_material_v2 TO service_role;
GRANT ALL ON public.tolerancias_fornecedor_v2 TO service_role;

-- 2. Corrigir políticas de RLS para exigir role 'admin' para escrita
-- Fornecedores V2
DROP POLICY IF EXISTS "Usuários autenticados podem gerir fornecedores" ON public.fornecedores_material_v2;
CREATE POLICY "Leitura para todos autenticados" ON public.fornecedores_material_v2 FOR SELECT TO authenticated USING (true);
CREATE POLICY "Apenas admin pode gerir fornecedores" ON public.fornecedores_material_v2 FOR ALL TO authenticated 
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Overrides V2
DROP POLICY IF EXISTS "Usuários autenticados podem gerir overrides" ON public.tolerancias_fornecedor_v2;
CREATE POLICY "Leitura de overrides para todos autenticados" ON public.tolerancias_fornecedor_v2 FOR SELECT TO authenticated USING (true);
CREATE POLICY "Apenas admin pode gerir overrides" ON public.tolerancias_fornecedor_v2 FOR ALL TO authenticated 
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. Índices de Performance (Quick Win)
CREATE INDEX IF NOT EXISTS idx_pesagens_emissor ON public.pesagens (emissor);
CREATE INDEX IF NOT EXISTS idx_pesagens_contratante ON public.pesagens (contratante);
CREATE INDEX IF NOT EXISTS idx_pesagens_chave_nfe ON public.pesagens (chave_nfe);
CREATE INDEX IF NOT EXISTS idx_pesagens_obra_id ON public.pesagens (obra_id);
CREATE INDEX IF NOT EXISTS idx_pesagens_created_at ON public.pesagens (created_at DESC);
