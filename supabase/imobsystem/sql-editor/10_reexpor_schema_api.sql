-- Rodar no SQL Editor do projeto ikvjaowvpvxojvcfwnct (ImobSystem). Pode rodar de novo.
-- Correção (24/10/2026): o Portal de Pesagem na Vercel mostrava "Aguardando ativação" para o Super Admin.
-- Causa: a API respondia 406 PGRST106 "Invalid schema: imobpesagens" (lista regravada sem o schema), então
-- has_role() falhava e o app entendia "sem papel".
-- UNE a lista atual do authenticator + todos os sistemas do ikvj. Nunca remove nada; só entra schema que existe.
-- Depois de rodar: marque a MESMA lista no painel (Data API > Exposed schemas) e NÃO clique em "Reset override".
-- Cerebro: supabase-pgrst-db-schemas-no-banco-anula-painel.

do $$
declare
  v_atual text;
  v_nova  text;
begin
  select split_part(c, '=', 2) into v_atual
    from pg_roles r, unnest(r.rolconfig) c
   where r.rolname = 'authenticator' and c like 'pgrst.db_schemas=%';

  with candidatos as (
    select btrim(x) as s
      from unnest(string_to_array(coalesce(v_atual, ''), ',')) x
    union select unnest(array[
      'public', 'graphql_public', 'imobdesk',
      'imobdoces', 'imobdoces_modelo', 'imobenviomassa', 'suprimentos', 'imobeducacional',
      'imobpesagens'])
  )
  select string_agg(c.s, ', ' order by c.s <> 'public', c.s) into v_nova
    from candidatos c
   where c.s <> '' and exists (select 1 from pg_namespace n where n.nspname = c.s);

  execute format('alter role authenticator set pgrst.db_schemas = %L', v_nova);
end $$;

notify pgrst, 'reload config';
notify pgrst, 'reload schema';

-- Conferência: deve listar imobpesagens junto com os outros sistemas (copie esta lista para o painel).
select split_part(c, '=', 2) as schemas_expostos
  from pg_roles r, unnest(r.rolconfig) c
 where r.rolname = 'authenticator' and c like 'pgrst.db_schemas=%';
