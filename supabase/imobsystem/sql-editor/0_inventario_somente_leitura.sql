-- Rodar no SQL Editor do projeto ikvjaowvpvxojvcfwnct (ImobSystem). SÓ LEITURA: não cria nem altera nada.
-- Fase 1 do plano docs/plano-supabase-imobpesagens.md: conferir o que já existe no banco compartilhado
-- antes de criar o schema imobpesagens. Devolve uma linha por item (secao | item | detalhe).
-- Não lê segredos (nem o Vault, que pode não estar ativo neste projeto).

with
schemas as (
  select 'schemas' as secao, nspname::text as item,
         (select count(*) from pg_class c where c.relnamespace = n.oid and c.relkind in ('r','p'))::text || ' tabelas' as detalhe
  from pg_namespace n
  where nspname not like 'pg\_%' and nspname not in ('information_schema')
),
alvo as (
  select 'schema_imobpesagens' as secao, 'existe?' as item,
         case when exists (select 1 from pg_namespace where nspname = 'imobpesagens') then 'SIM — parar e avisar' else 'não (ok)' end as detalhe
),
api as (
  select 'api_schemas_expostos' as secao, 'authenticator' as item,
         coalesce((select string_agg(c, ' ; ') from pg_roles r, unnest(r.rolconfig) c
                   where r.rolname = 'authenticator' and c like 'pgrst.%'),
                  'sem lista gravada no banco: vale a do painel (Integrations › Data API)') as detalhe
),
buckets as (
  select 'storage_buckets' as secao, id::text as item,
         case when public then 'público' else 'privado' end
         || case when id like 'imobpesagens-%' then ' — JÁ EXISTE com o prefixo novo' else '' end as detalhe
  from storage.buckets
),
policies_storage as (
  select 'storage_policies' as secao, policyname::text as item, cmd::text || ' ' || coalesce(left(qual, 120), '') as detalhe
  from pg_policies where schemaname = 'storage' and tablename = 'objects'
),
gatilhos_auth as (
  select 'gatilhos_auth_users' as secao, t.tgname::text as item,
         p.pronamespace::regnamespace::text || '.' || p.proname as detalhe
  from pg_trigger t join pg_proc p on p.oid = t.tgfoid
  where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal
),
acessos as (
  select 'funcoes_acessos' as secao, p.proname::text as item,
         pg_get_function_identity_arguments(p.oid) as detalhe
  from pg_proc p where p.pronamespace::regnamespace::text = 'acessos'
),
usuarios as (
  select 'auth_users' as secao, 'total' as item, count(*)::text as detalhe from auth.users
  union all
  select 'auth_users', 'wsasistemas.ia@gmail.com',
         case when exists (select 1 from auth.users where lower(email) = 'wsasistemas.ia@gmail.com') then 'existe' else 'NÃO existe' end
),
extensoes as (
  select 'extensoes' as secao, extname::text as item, extversion as detalhe
  from pg_extension where extname in ('pg_cron','pg_net','supabase_vault','pgcrypto','pg_graphql')
)
select * from alvo
union all select * from api
union all select * from schemas
union all select * from buckets
union all select * from policies_storage
union all select * from gatilhos_auth
union all select * from acessos
union all select * from usuarios
union all select * from extensoes
order by 1, 2;
