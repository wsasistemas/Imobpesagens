-- Rodar no SQL Editor do projeto ikvjaowvpvxojvcfwnct (ImobSystem), depois do 1 ao 4. Pode rodar de novo.
-- Dá ao login wsasistemas.ia@gmail.com (que já existe no ImobSystem: login único) acesso de Super Admin
-- ao Portal de Pesagem. Não cria nem altera o login: só o cadastro dentro do schema imobpesagens.
-- Papéis: superadmin + admin (várias policies da origem checam só 'admin').
begin;

do $$
declare
  v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = 'wsasistemas.ia@gmail.com';
  if v_id is null then
    raise exception 'Login wsasistemas.ia@gmail.com não existe no auth.users deste projeto.';
  end if;

  insert into imobpesagens.profiles (id, nome, email, cargo)
  values (v_id, 'WSA Sistemas', 'wsasistemas.ia@gmail.com', 'Super Admin')
  on conflict (id) do update set nome = excluded.nome, email = excluded.email, cargo = excluded.cargo;

  insert into imobpesagens.user_roles (user_id, role)
  values (v_id, 'superadmin'), (v_id, 'admin')
  on conflict (user_id, role) do nothing;
end $$;

-- Conferência: deve listar admin e superadmin.
select u.email, string_agg(r.role::text, ', ' order by r.role::text) as papeis, p.nome
from auth.users u
join imobpesagens.user_roles r on r.user_id = u.id
left join imobpesagens.profiles p on p.id = u.id
where lower(u.email) = 'wsasistemas.ia@gmail.com'
group by u.email, p.nome;

commit;
