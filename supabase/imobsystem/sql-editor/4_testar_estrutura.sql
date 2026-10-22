-- Rodar no SQL Editor do projeto ikvjaowvpvxojvcfwnct (ImobSystem), depois do 1, 2 e 3. NÃO GRAVA NADA.
-- Um bloco só: cria usuários e obras de teste, confere papel por papel o que cada um lê e grava no schema
-- imobpesagens e, no fim, PARA COM UM ERRO DE PROPÓSITO trazendo o relatório. O erro desfaz tudo o que o teste criou
-- (o SQL Editor executa os comandos separados, então não dá para confiar num rollback no fim do arquivo).
--
-- Só olha os registros que o próprio teste cria: pode rodar com dados de demonstração no banco.
-- Leitura do resultado: a mensagem em vermelho começa com "RESULTADO DO TESTE: 21 de 21 OK" quando está tudo certo.
-- Cada linha seguinte é um caso: OK ou FALHOU (esperado × obtido).

do $teste$
declare
  v_linhas text[] := '{}';
  v_ok int := 0;
  v_total int := 0;
  v_obtido text;

  -- ids fixos, só dentro deste bloco
  u_admin    constant uuid := '00000000-0000-4000-a000-0000000000a1';
  u_operador constant uuid := '00000000-0000-4000-a000-0000000000a2';
  u_outro    constant uuid := '00000000-0000-4000-a000-0000000000a3';
  u_contador constant uuid := '00000000-0000-4000-a000-0000000000a4';
  o_a        constant uuid := '00000000-0000-4000-b000-000000000001';
  o_b        constant uuid := '00000000-0000-4000-b000-000000000002';
begin
  -- ------------------------------------------------------------- preparação (como postgres)
  insert into auth.users (id, email, aud, role) values
    (u_admin,    'teste.admin@imobpesagens.invalid',        'authenticated', 'authenticated'),
    (u_operador, 'teste.operador@imobpesagens.invalid',     'authenticated', 'authenticated'),
    (u_outro,    'teste.outro.sistema@imobpesagens.invalid', 'authenticated', 'authenticated'),
    (u_contador, 'teste.contador@imobpesagens.invalid',     'authenticated', 'authenticated');

  insert into imobpesagens.user_roles (user_id, role) values
    (u_admin, 'admin'), (u_operador, 'operador'), (u_contador, 'contador');
  insert into imobpesagens.obras (id, nome, coligada, cnpj) values
    (o_a, 'Obra Teste A', '1', '00000000000191'),
    (o_b, 'Obra Teste B', '2', '00000000000272');
  insert into imobpesagens.obra_acessos (user_id, obra_id) values (u_operador, o_a);
  insert into imobpesagens.usuario_coligadas (user_id, codcoligada) values (u_operador, '1');

  -- Arquivo de OUTRO sistema, com pasta que não é uuid: as policies do imobpesagens não podem dar erro de cast.
  insert into storage.buckets (id, name, public) values ('zz-teste-outro-sistema', 'zz-teste-outro-sistema', false)
  on conflict (id) do nothing;
  insert into storage.objects (bucket_id, name) values ('zz-teste-outro-sistema', 'pasta-nao-uuid/arquivo.pdf');
  insert into storage.objects (bucket_id, name) values ('imobpesagens-evidencias', o_a || '/foto.jpg');

  -- ------------------------------------------------------------- admin
  perform set_config('request.jwt.claims', json_build_object('sub', u_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_admin::text, true);
  set local role authenticated;

  select count(*)::text into v_obtido from imobpesagens.obras where id in (o_a, o_b);
  v_total := v_total + 1; if v_obtido = '2' then v_ok := v_ok + 1; end if;
  v_linhas := v_linhas || format('%s admin vê as 2 obras: esperado 2, obtido %s', case when v_obtido = '2' then 'OK    ' else 'FALHOU' end, v_obtido);

  select case when count(*) > 0 then 'sim' else 'não' end into v_obtido from imobpesagens.tolerancias_padrao;
  v_total := v_total + 1; if v_obtido = 'sim' then v_ok := v_ok + 1; end if;
  v_linhas := v_linhas || format('%s admin lê tolerâncias padrão: esperado sim, obtido %s', case when v_obtido = 'sim' then 'OK    ' else 'FALHOU' end, v_obtido);

  select case when count(*) > 0 then 'sim' else 'não' end into v_obtido from imobpesagens.perfil_menu_permissoes;
  v_total := v_total + 1; if v_obtido = 'sim' then v_ok := v_ok + 1; end if;
  v_linhas := v_linhas || format('%s admin lê perfis/menus: esperado sim, obtido %s', case when v_obtido = 'sim' then 'OK    ' else 'FALHOU' end, v_obtido);
  reset role;

  -- ------------------------------------------------------------- operador (obra A, coligada 1)
  perform set_config('request.jwt.claims', json_build_object('sub', u_operador, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_operador::text, true);
  set local role authenticated;

  select coalesce(string_agg(nome, ','), '') into v_obtido from imobpesagens.obras where id in (o_a, o_b);
  v_total := v_total + 1; if v_obtido = 'Obra Teste A' then v_ok := v_ok + 1; end if;
  v_linhas := v_linhas || format('%s operador vê só a obra da coligada 1: esperado Obra Teste A, obtido %s', case when v_obtido = 'Obra Teste A' then 'OK    ' else 'FALHOU' end, v_obtido);

  select coalesce(string_agg(role::text, ','), '') into v_obtido from imobpesagens.user_roles;
  v_total := v_total + 1; if v_obtido = 'operador' then v_ok := v_ok + 1; end if;
  v_linhas := v_linhas || format('%s operador vê só o próprio papel: esperado operador, obtido %s', case when v_obtido = 'operador' then 'OK    ' else 'FALHOU' end, v_obtido);

  begin
    insert into imobpesagens.pesagens (obra_id, criado_por) values (o_a, u_operador);
    v_obtido := 'permitido';
  exception when others then v_obtido := 'negado (' || sqlerrm || ')';
  end;
  v_total := v_total + 1; if v_obtido = 'permitido' then v_ok := v_ok + 1; end if;
  v_linhas := v_linhas || format('%s operador cria pesagem na obra A: esperado permitido, obtido %s', case when v_obtido = 'permitido' then 'OK    ' else 'FALHOU' end, v_obtido);

  begin
    insert into imobpesagens.pesagens (obra_id, criado_por) values (o_b, u_operador);
    v_obtido := 'permitido';
  exception when others then v_obtido := 'negado';
  end;
  v_total := v_total + 1; if v_obtido = 'negado' then v_ok := v_ok + 1; end if;
  v_linhas := v_linhas || format('%s operador cria pesagem na obra B: esperado negado, obtido %s', case when v_obtido = 'negado' then 'OK    ' else 'FALHOU' end, v_obtido);

  begin
    insert into imobpesagens.user_roles (user_id, role) values (u_operador, 'admin');
    v_obtido := 'permitido';
  exception when others then v_obtido := 'negado';
  end;
  v_total := v_total + 1; if v_obtido = 'negado' then v_ok := v_ok + 1; end if;
  v_linhas := v_linhas || format('%s operador se promove a admin: esperado negado, obtido %s', case when v_obtido = 'negado' then 'OK    ' else 'FALHOU' end, v_obtido);

  select count(*)::text into v_obtido from storage.objects where bucket_id = 'imobpesagens-evidencias' and name = o_a || '/foto.jpg';
  v_total := v_total + 1; if v_obtido = '1' then v_ok := v_ok + 1; end if;
  v_linhas := v_linhas || format('%s operador vê a foto da obra A no storage: esperado 1, obtido %s', case when v_obtido = '1' then 'OK    ' else 'FALHOU' end, v_obtido);

  begin
    perform count(*) from storage.objects;
    v_obtido := 'sem erro';
  exception when others then v_obtido := 'erro: ' || sqlerrm;
  end;
  v_total := v_total + 1; if v_obtido = 'sem erro' then v_ok := v_ok + 1; end if;
  v_linhas := v_linhas || format('%s arquivo de outro sistema não quebra as policies: esperado sem erro, obtido %s', case when v_obtido = 'sem erro' then 'OK    ' else 'FALHOU' end, v_obtido);
  reset role;

  -- ------------------------------------------------------------- contador (sem coligada)
  perform set_config('request.jwt.claims', json_build_object('sub', u_contador, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_contador::text, true);
  set local role authenticated;

  select count(*)::text into v_obtido from imobpesagens.obras;
  v_total := v_total + 1; if v_obtido = '0' then v_ok := v_ok + 1; end if;
  v_linhas := v_linhas || format('%s contador não vê obras sem coligada liberada: esperado 0, obtido %s', case when v_obtido = '0' then 'OK    ' else 'FALHOU' end, v_obtido);

  select case when count(*) > 0 then 'sim' else 'não' end into v_obtido from imobpesagens.tolerancias_padrao;
  v_total := v_total + 1; if v_obtido = 'sim' then v_ok := v_ok + 1; end if;
  v_linhas := v_linhas || format('%s contador lê tolerâncias (tem papel no app): esperado sim, obtido %s', case when v_obtido = 'sim' then 'OK    ' else 'FALHOU' end, v_obtido);
  reset role;

  -- ------------------------------------------------------------- usuário de outro sistema Imob (sem papel)
  perform set_config('request.jwt.claims', json_build_object('sub', u_outro, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u_outro::text, true);
  set local role authenticated;

  select count(*)::text into v_obtido from imobpesagens.obras;
  v_total := v_total + 1; if v_obtido = '0' then v_ok := v_ok + 1; end if;
  v_linhas := v_linhas || format('%s outro sistema: obras: esperado 0, obtido %s', case when v_obtido = '0' then 'OK    ' else 'FALHOU' end, v_obtido);

  select count(*)::text into v_obtido from imobpesagens.pesagens;
  v_total := v_total + 1; if v_obtido = '0' then v_ok := v_ok + 1; end if;
  v_linhas := v_linhas || format('%s outro sistema: pesagens: esperado 0, obtido %s', case when v_obtido = '0' then 'OK    ' else 'FALHOU' end, v_obtido);

  select count(*)::text into v_obtido from imobpesagens.tolerancias_padrao;
  v_total := v_total + 1; if v_obtido = '0' then v_ok := v_ok + 1; end if;
  v_linhas := v_linhas || format('%s outro sistema: tolerâncias padrão: esperado 0, obtido %s', case when v_obtido = '0' then 'OK    ' else 'FALHOU' end, v_obtido);

  select count(*)::text into v_obtido from imobpesagens.fornecedores_material_v2;
  v_total := v_total + 1; if v_obtido = '0' then v_ok := v_ok + 1; end if;
  v_linhas := v_linhas || format('%s outro sistema: fornecedores v2: esperado 0, obtido %s', case when v_obtido = '0' then 'OK    ' else 'FALHOU' end, v_obtido);

  select count(*)::text into v_obtido from storage.objects where bucket_id like 'imobpesagens-%';
  v_total := v_total + 1; if v_obtido = '0' then v_ok := v_ok + 1; end if;
  v_linhas := v_linhas || format('%s outro sistema: fotos no storage: esperado 0, obtido %s', case when v_obtido = '0' then 'OK    ' else 'FALHOU' end, v_obtido);

  begin
    insert into imobpesagens.obras (nome, coligada, cnpj) values ('Invasora', '9', '1');
    v_obtido := 'permitido';
  exception when others then v_obtido := 'negado';
  end;
  v_total := v_total + 1; if v_obtido = 'negado' then v_ok := v_ok + 1; end if;
  v_linhas := v_linhas || format('%s outro sistema cria obra: esperado negado, obtido %s', case when v_obtido = 'negado' then 'OK    ' else 'FALHOU' end, v_obtido);
  reset role;

  -- ------------------------------------------------------------- anon (sem login)
  set local role anon;
  begin
    perform 1 from imobpesagens.obras limit 1;
    v_obtido := 'permitido';
  exception when others then v_obtido := 'negado';
  end;
  reset role;
  v_total := v_total + 1; if v_obtido = 'negado' then v_ok := v_ok + 1; end if;
  v_linhas := v_linhas || format('%s anon lê obras: esperado negado, obtido %s', case when v_obtido = 'negado' then 'OK    ' else 'FALHOU' end, v_obtido);

  -- ------------------------------------------------------------- estrutura
  select coalesce(string_agg(t.tgname, ','), 'nenhum') into v_obtido
  from pg_trigger t join pg_proc p on p.oid = t.tgfoid
  where t.tgrelid = 'auth.users'::regclass and p.pronamespace = 'imobpesagens'::regnamespace;
  v_total := v_total + 1; if v_obtido = 'nenhum' then v_ok := v_ok + 1; end if;
  v_linhas := v_linhas || format('%s gatilho do imobpesagens em auth.users: esperado nenhum, obtido %s', case when v_obtido = 'nenhum' then 'OK    ' else 'FALHOU' end, v_obtido);

  select count(*)::text into v_obtido
  from information_schema.role_table_grants where table_schema = 'imobpesagens' and grantee = 'anon';
  v_total := v_total + 1; if v_obtido = '0' then v_ok := v_ok + 1; end if;
  v_linhas := v_linhas || format('%s permissões para anon no schema: esperado 0, obtido %s', case when v_obtido = '0' then 'OK    ' else 'FALHOU' end, v_obtido);

  -- ------------------------------------------------------------- relatório (o erro desfaz tudo o que o teste criou)
  raise exception using
    message = format('RESULTADO DO TESTE: %s de %s OK (nada foi gravado)', v_ok, v_total),
    detail = array_to_string(v_linhas, E'\n');
end
$teste$;
