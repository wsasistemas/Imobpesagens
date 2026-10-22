CREATE OR REPLACE FUNCTION public.sucata_pode_ler()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.has_role(auth.uid(),'admin')
      OR public.has_role(auth.uid(),'superadmin')
      OR public.has_role(auth.uid(),'operador')
      OR public.has_role(auth.uid(),'coordenador')
      OR public.has_role(auth.uid(),'contador')
      OR public.has_role(auth.uid(),'administrativo_obra');
$function$;

REVOKE ALL ON FUNCTION public.sucata_pode_ler() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sucata_pode_ler() TO authenticated, service_role;