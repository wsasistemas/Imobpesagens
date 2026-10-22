DROP POLICY IF EXISTS "Autenticados podem gerenciar fornecedores" ON public.fornecedores_concreto;
DROP POLICY IF EXISTS "Autenticados podem gerenciar traços" ON public.tracos_concreto;

CREATE POLICY "Perfis cadastrados leem fornecedores de concreto"
ON public.fornecedores_concreto FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()));

CREATE POLICY "Admins gerenciam fornecedores de concreto"
ON public.fornecedores_concreto FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Perfis cadastrados leem traços"
ON public.tracos_concreto FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()));

CREATE POLICY "Admins gerenciam traços"
ON public.tracos_concreto FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));