DROP POLICY IF EXISTS "Admin pode editar padrão" ON public.tolerancias_padrao;
CREATE POLICY "Admin pode editar padrão" ON public.tolerancias_padrao
FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'));

CREATE OR REPLACE FUNCTION public.tem_acesso_obra(_obra_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.has_role(auth.uid(),'admin')
      OR public.has_role(auth.uid(),'superadmin')
      OR (
        public.has_role(auth.uid(),'operador')
        AND (
          EXISTS (
            SELECT 1 FROM public.obra_acessos oa
            WHERE oa.user_id = auth.uid() AND oa.obra_id = _obra_id
          )
          OR public.pode_ver_obra_coligada(_obra_id)
        )
      );
$$;