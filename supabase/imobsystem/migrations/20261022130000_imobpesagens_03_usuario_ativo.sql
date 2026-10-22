-- =====================================================================================================
-- Portal de Pesagem (imobpesagens) — usuário ativo/inativo SÓ no app (login único do ImobSystem)
-- Decisão do Wagner (22/10/2026): o login é único entre os sistemas Imob. "Bloquear" na tela de Operadores
-- não pode banir o login (isso tiraria a pessoa de todos os sistemas): passa a inativar só no Portal de Pesagem.
--
-- profiles.ativo = false → has_role() e usuario_do_app() respondem false para a pessoa, e todas as policies e
-- funções do schema (que passam por elas) deixam de liberar acesso. O app mostra "Aguardando ativação".
-- Aditiva e idempotente: pode rodar de novo.
-- =====================================================================================================

alter table imobpesagens.profiles add column if not exists ativo boolean not null default true;
comment on column imobpesagens.profiles.ativo is
  'Acesso ao Portal de Pesagem. false = inativo só neste app; o login (auth.users) continua valendo nos outros sistemas.';

create or replace function imobpesagens.has_role(_user_id uuid, _role imobpesagens.app_role)
returns boolean
language sql
stable
security definer
set search_path to 'imobpesagens'
as $$
  select exists (select 1 from imobpesagens.user_roles where user_id = _user_id and role = _role)
     and not exists (select 1 from imobpesagens.profiles p where p.id = _user_id and p.ativo = false);
$$;

create or replace function imobpesagens.usuario_do_app()
returns boolean
language sql
stable
security definer
set search_path to 'imobpesagens'
as $$
  select exists (select 1 from imobpesagens.user_roles ur where ur.user_id = auth.uid())
     and not exists (select 1 from imobpesagens.profiles p where p.id = auth.uid() and p.ativo = false);
$$;

notify pgrst, 'reload schema';
