DROP POLICY IF EXISTS "Autenticados podem ver fornecedores" ON public.fornecedores_material_v2;
CREATE POLICY "Usuários com perfil podem ver fornecedores"
ON public.fornecedores_material_v2
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()));

DROP POLICY IF EXISTS "Autenticados podem ver overrides" ON public.tolerancias_fornecedor_v2;
CREATE POLICY "Usuários com perfil podem ver overrides"
ON public.tolerancias_fornecedor_v2
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()));

DROP POLICY IF EXISTS "Autenticados podem ver perfis" ON public.perfil_descricoes;
CREATE POLICY "Usuários com perfil podem ver perfis"
ON public.perfil_descricoes
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()));