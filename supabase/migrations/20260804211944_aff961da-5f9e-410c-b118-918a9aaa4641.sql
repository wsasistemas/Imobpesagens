alter table public.pesagens
  add column if not exists traco_confirmado_manual boolean default false,
  add column if not exists fornecedor_confirmado_manual boolean default false;
