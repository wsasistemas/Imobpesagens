-- fornecedores_material_v2
DROP POLICY IF EXISTS "Usuários autenticados podem gerir fornecedores" ON public.fornecedores_material_v2;
CREATE POLICY "Autenticados podem ver fornecedores" ON public.fornecedores_material_v2
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins podem gerir fornecedores" ON public.fornecedores_material_v2
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

-- tolerancias_fornecedor_v2
DROP POLICY IF EXISTS "Usuários autenticados podem gerir overrides" ON public.tolerancias_fornecedor_v2;
CREATE POLICY "Autenticados podem ver overrides" ON public.tolerancias_fornecedor_v2
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins podem gerir overrides" ON public.tolerancias_fornecedor_v2
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

-- perfil_menu_permissoes
DROP POLICY IF EXISTS "Autenticados podem ver permissoes de menu" ON public.perfil_menu_permissoes;
CREATE POLICY "Usuarios com perfil podem ver permissoes de menu" ON public.perfil_menu_permissoes
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()));