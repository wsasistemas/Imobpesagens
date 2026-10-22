-- Rodar no SQL Editor do projeto ikvjaowvpvxojvcfwnct (ImobSystem), depois do 1_aplicar_estrutura.sql. Pode rodar de novo.
-- Expõe o schema imobpesagens na Data API. Só ACRESCENTA o schema: não tira nenhum dos outros sistemas
-- (o Imobenviomassa ficou fora do ar em 19/10/2026 quando a lista foi regravada sem ele).
-- Cerebro: supabase-pgrst-db-schemas-no-banco-anula-painel.

-- 1) Diagnóstico: o que está gravado hoje no papel authenticator (se houver, é essa lista que vale, não a do painel).
select c as configuracao_atual
from pg_roles r, unnest(r.rolconfig) c
where r.rolname = 'authenticator' and c like 'pgrst.%';

-- 2) Acrescenta imobpesagens à lista gravada, mantendo todos os que já estão lá.
do $$
declare
  v_atual text;
begin
  select split_part(c, '=', 2) into v_atual
  from pg_roles r, unnest(r.rolconfig) c
  where r.rolname = 'authenticator' and c like 'pgrst.db_schemas=%';

  if v_atual is null then
    raise notice 'Não há pgrst.db_schemas gravado no banco: a lista vem do painel. Marque imobpesagens em Integrations › Data API › Exposed schemas.';
  elsif 'imobpesagens' = any (string_to_array(replace(v_atual, ' ', ''), ',')) then
    raise notice 'imobpesagens já está na lista: %', v_atual;
  else
    execute format('alter role authenticator set pgrst.db_schemas = %L', v_atual || ', imobpesagens');
    raise notice 'Lista nova: %', v_atual || ', imobpesagens';
  end if;
end $$;

-- 3) Recarrega a configuração e o cache de tabelas da API.
notify pgrst, 'reload config';
notify pgrst, 'reload schema';
