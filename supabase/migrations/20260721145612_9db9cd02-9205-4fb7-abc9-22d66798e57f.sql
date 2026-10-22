
CREATE INDEX IF NOT EXISTS ix_pesagens_dash
  ON public.pesagens (obra_id, status, COALESCE(saiu_em, created_at));
CREATE INDEX IF NOT EXISTS ix_pesagens_obra_created
  ON public.pesagens (obra_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_notas_chave
  ON public.notas_fiscais (chave);
CREATE INDEX IF NOT EXISTS ix_user_roles_uid_role
  ON public.user_roles (user_id, role);
CREATE INDEX IF NOT EXISTS ix_obra_acessos_uid
  ON public.obra_acessos (user_id);
