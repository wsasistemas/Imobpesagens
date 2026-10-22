-- Rodar no SQL Editor do projeto ikvjaowvpvxojvcfwnct (ImobSystem). Pode rodar de novo.
-- Apaga restos da 1ª versão do teste de estrutura (o SQL Editor executa os comandos separados, então o rollback do fim
-- não desfez o que veio antes do erro). Só mexe nos registros de teste: e-mails @imobpesagens.invalid,
-- obras "Obra Teste A/B" e o bucket zz-teste-outro-sistema.
-- Um bloco só (tudo ou nada). O resultado aparece na consulta do fim: tudo deve dar 0.

do $limpeza$
declare v_col text;
begin
  -- 1) Arquivos de teste. O Supabase bloqueia DELETE direto em storage.objects (storage.protect_delete); a liberação
  --    vale só nesta transação. Se não houver arquivo de teste, não há o que apagar.
  if exists (select 1 from storage.objects
             where bucket_id = 'zz-teste-outro-sistema'
                or (bucket_id = 'imobpesagens-evidencias' and name = '00000000-0000-4000-b000-000000000001/foto.jpg')) then
    perform set_config('storage.allow_delete_query', 'true', true);
    delete from storage.objects
    where bucket_id = 'zz-teste-outro-sistema'
       or (bucket_id = 'imobpesagens-evidencias' and name = '00000000-0000-4000-b000-000000000001/foto.jpg');
  end if;
  if exists (select 1 from storage.buckets where id = 'zz-teste-outro-sistema') then
    perform set_config('storage.allow_delete_query', 'true', true);
    delete from storage.buckets where id = 'zz-teste-outro-sistema';
  end if;

  -- 2) Dados de teste no schema do app.
  delete from imobpesagens.pesagens
  where obra_id in ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-b000-000000000002');
  delete from imobpesagens.obras
  where id in ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-b000-000000000002');

  -- 3) O gatilho de outro sistema em auth.users (public.handle_new_auth_user) pode ter criado linha em public.usuarios
  --    para os usuários de teste: apaga essa linha antes, pela coluna que existir.
  if to_regclass('public.usuarios') is not null then
    select column_name into v_col from information_schema.columns
    where table_schema = 'public' and table_name = 'usuarios' and column_name in ('user_id', 'auth_user_id', 'id')
    order by case column_name when 'user_id' then 1 when 'auth_user_id' then 2 else 3 end limit 1;
    if v_col is not null then
      execute format('delete from public.usuarios where %I in (select id from auth.users where email like %L)',
                     v_col, '%@imobpesagens.invalid');
    end if;
  end if;

  -- 4) Usuários de teste (user_roles, obra_acessos e usuario_coligadas saem junto: on delete cascade).
  delete from auth.users where email like '%@imobpesagens.invalid';
end
$limpeza$;

-- Conferência: tudo deve dar 0.
select 'auth.users (teste)' as onde, count(*) as qtd from auth.users where email like '%@imobpesagens.invalid'
union all select 'imobpesagens.obras (teste)', count(*) from imobpesagens.obras
  where id in ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-b000-000000000002')
union all select 'storage.objects (teste)', count(*) from storage.objects
  where bucket_id = 'zz-teste-outro-sistema'
     or (bucket_id = 'imobpesagens-evidencias' and name = '00000000-0000-4000-b000-000000000001/foto.jpg')
union all select 'storage.buckets (teste)', count(*) from storage.buckets where id = 'zz-teste-outro-sistema';
