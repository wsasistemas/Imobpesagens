-- Rodar no SQL Editor do projeto ikvjaowvpvxojvcfwnct (ImobSystem). Pode rodar de novo.
-- Conteúdo igual a migrations/20261022140000_imobpesagens_04_redefinir_senha.sql.

-- =====================================================================================================
-- Portal de Pesagem (imobpesagens) — 04: "Esqueceu a senha?" com link do próprio app (22/10/2026)
-- Mesmo padrão do Imobenviomassa no ikvj (Cerebro: esqueci-a-senha-com-token-proprio-no-app): o link é gerado e
-- enviado pelo app (Resend), e não pelo e-mail de recuperação do Supabase — no ikvj compartilhado o link padrão
-- cai no Site URL de outro sistema quando o endereço não está na allowlist.
-- Aditiva e idempotente. Tabela e função acessadas só pelo servidor (service_role). Guarda o hash, nunca o token.
-- =====================================================================================================
create table if not exists imobpesagens.senha_redefinicao (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,  -- nulo quando o e-mail não tem conta (só conta no limite)
  email       text not null,
  token_hash  text unique,                                        -- sha-256 do token enviado por e-mail
  ip          text,
  criado_em   timestamptz not null default now(),
  expira_em   timestamptz,
  usado_em    timestamptz
);
create index if not exists senha_redefinicao_email_idx on imobpesagens.senha_redefinicao (email, criado_em desc);
create index if not exists senha_redefinicao_ip_idx on imobpesagens.senha_redefinicao (ip, criado_em desc);

alter table imobpesagens.senha_redefinicao enable row level security;
revoke all on imobpesagens.senha_redefinicao from public, anon, authenticated;
grant all on imobpesagens.senha_redefinicao to service_role;

-- Id do login (auth.users) pelo e-mail, sem listar todos os usuários do projeto compartilhado.
create or replace function imobpesagens.auth_id_por_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path to 'imobpesagens'
as $$
  select id from auth.users where lower(email) = lower(btrim(p_email)) limit 1;
$$;
revoke all on function imobpesagens.auth_id_por_email(text) from public, anon, authenticated;
grant execute on function imobpesagens.auth_id_por_email(text) to service_role;

notify pgrst, 'reload schema';
