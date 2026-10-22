CREATE OR REPLACE FUNCTION public.tem_acesso_obra(_obra_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.has_role(auth.uid(),'admin')
      OR public.has_role(auth.uid(),'operador');
$$;

DROP POLICY IF EXISTS "Ver obras liberadas" ON public.obras;
CREATE POLICY "Ver obras ativas"
ON public.obras
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'operador')
);