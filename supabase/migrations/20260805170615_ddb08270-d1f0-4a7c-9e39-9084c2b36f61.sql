-- 1. Índices para otimizar filtros de emissor e contratante (Dashboard e Histórico)
CREATE INDEX IF NOT EXISTS ix_pesagens_emissor ON public.pesagens (emissor);
CREATE INDEX IF NOT EXISTS ix_pesagens_contratante ON public.pesagens (contratante);
CREATE INDEX IF NOT EXISTS ix_pesagens_chave_nfe ON public.pesagens (chave_nfe);

-- 2. Ajuste de RLS nas Notas Fiscais (Fase 1 - Auditoria)
-- Atualmente, notas sem obra podem ser visíveis por todos.
-- Vamos restringir: Notas sem obra_id só podem ser vistas por Admins.

DROP POLICY IF EXISTS "Ver notas da obra" ON public.notas_fiscais;

CREATE POLICY "Ver notas da obra" ON public.notas_fiscais 
FOR SELECT TO authenticated 
USING (
  (obra_id IS NOT NULL AND public.tem_acesso_obra(obra_id)) OR 
  (obra_id IS NULL AND public.has_role(auth.uid(), 'admin'))
);
