
-- Tabelas de configuração de concreto
create table if not exists public.fornecedores_concreto (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cnpj text,
  emissor_keywords text[] default '{}',
  tolerancia_padrao numeric not null default 4,
  teor_ar numeric,
  ativo boolean not null default true,
  observacoes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.tracos_concreto (
  id uuid primary key default gen_random_uuid(),
  fornecedor_id uuid not null references public.fornecedores_concreto(id) on delete cascade,
  codigo text,
  fck numeric,
  aplicacao text,
  slump_nominal numeric,
  slump_unidade text default 'cm' check (slump_unidade in ('cm','mm')),
  slump_tolerancia numeric,
  densidade_teorica numeric,
  densidade_pratica numeric,
  tolerancia_peso numeric,
  match_keywords text[] default '{}',
  carta_arquivo_url text,
  ativo boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists tracos_concreto_fornecedor_id_idx on public.tracos_concreto (fornecedor_id);

-- Grants
grant select, insert, update, delete on public.fornecedores_concreto to authenticated;
grant all on public.fornecedores_concreto to service_role;
grant select, insert, update, delete on public.tracos_concreto to authenticated;
grant all on public.tracos_concreto to service_role;

-- RLS
alter table public.fornecedores_concreto enable row level security;
alter table public.tracos_concreto enable row level security;

create policy "Autenticados podem gerenciar fornecedores" on public.fornecedores_concreto
  for all to authenticated using (true);
create policy "Autenticados podem gerenciar traços" on public.tracos_concreto
  for all to authenticated using (true);

-- Atualização da tabela de pesagens
alter table public.pesagens
  add column if not exists modo_pesagem text default 'dupla' check (modo_pesagem in ('dupla','unica_excecao')),
  add column if not exists tara_informada numeric,
  add column if not exists volume_residuo numeric,
  add column if not exists requer_conferencia_eng boolean default false,
  add column if not exists traco_id uuid references public.tracos_concreto(id),
  add column if not exists resultado_afericao jsonb;
