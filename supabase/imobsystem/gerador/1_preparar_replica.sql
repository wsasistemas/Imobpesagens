-- Ajustes feitos na CÓPIA reproduzida das migrations do Lovable (container descartável), antes de extrair o DDL
-- do schema imobpesagens. Nunca rodar no Supabase de verdade. Roda como supabase_admin.
-- Plano: docs/plano-supabase-imobpesagens.md (Fase 2).

-- 1) Sem gatilho em auth.users: no ImobSystem o auth é compartilhado e o gatilho dispararia (e poderia travar)
--    o cadastro de todos os sistemas. O perfil passa a ser criado pelo admin do Portal de Pesagem (D2).
drop trigger if exists on_auth_user_created_profile on auth.users;
drop function if exists public.handle_new_user_profile();

-- 2) Sem a marca Calper no banco.
alter table public.pesagens rename column is_calper_fallback to is_padrao_fallback;
update public.fornecedores_concreto set nome = 'PADRÃO', emissor_keywords = array['PADRAO']
where nome = 'CALPER PADRAO';
update public.sucata_parametros set valor = 'wsasistemas.ia@gmail.com' where chave = 'contabilidade_emails';

-- 3) Sem histórico: as obras de exemplo das migrations saem (os dados de demonstração vêm num script próprio).
delete from public.obras;

-- 4) Leitura das tabelas de referência só para quem tem papel no Portal de Pesagem (antes: qualquer usuário logado,
--    o que no ImobSystem incluiria usuários de outros sistemas).
create or replace function public.usuario_do_app()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.user_roles ur where ur.user_id = auth.uid());
$$;
revoke all on function public.usuario_do_app() from public, anon;
grant execute on function public.usuario_do_app() to authenticated, service_role;

alter policy "Autenticados podem ler tolerâncias" on public.tolerancias_material using ((select public.usuario_do_app()));
alter policy "Autenticados leem fornecedores de material" on public.fornecedores_material using ((select public.usuario_do_app()));
alter policy "Autenticados leem tolerancias por fornecedor" on public.tolerancias_fornecedor using ((select public.usuario_do_app()));
alter policy "Leitura pública para autenticados" on public.tolerancias_padrao using ((select public.usuario_do_app()));
alter policy "Leitura para todos autenticados" on public.fornecedores_material_v2 using ((select public.usuario_do_app()));
alter policy "Leitura de overrides para todos autenticados" on public.tolerancias_fornecedor_v2 using ((select public.usuario_do_app()));

-- 5) Função de gatilho sem search_path fixo.
alter function public.update_updated_at_column() set search_path = public;

-- 6) Nada para o anon.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;
