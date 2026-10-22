-- 1. Campos de auditoria (Supabase)
alter table public.pesagens
  add column if not exists aud_peso_esperado_anterior numeric,
  add column if not exists aud_diferenca_kg_anterior numeric,
  add column if not exists aud_diferenca_pct_anterior numeric,
  add column if not exists aud_tolerancia_anterior numeric,
  add column if not exists aud_status_anterior text,
  add column if not exists aud_base_calculo_anterior text,
  add column if not exists recalculado_em timestamptz,
  add column if not exists recalculo_versao text,
  add column if not exists peso_esperado numeric,
  add column if not exists diferenca_kg numeric,
  add column if not exists diferenca_pct numeric,
  add column if not exists tolerancia_aplicada numeric,
  add column if not exists status_afericao text,
  add column if not exists base_calculo text,
  add column if not exists volume_m3 numeric,
  add column if not exists traco_id uuid references tracos_concreto(id);

-- Garantir que o authenticated tenha acesso aos novos campos
GRANT SELECT, UPDATE ON public.pesagens TO authenticated;
