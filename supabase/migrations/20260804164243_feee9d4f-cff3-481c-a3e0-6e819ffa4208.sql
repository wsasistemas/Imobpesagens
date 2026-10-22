
-- SUPERMIX
with supermix as (
  insert into public.fornecedores_concreto (nome, cnpj, emissor_keywords, tolerancia_padrao)
  values ('SUPERMIX', null, ARRAY['SUPERMIX','SUPERMIX CONCRETO'], 4)
  returning id
)
insert into public.tracos_concreto (fornecedor_id, codigo, fck, aplicacao, slump_nominal, slump_unidade, slump_tolerancia, densidade_teorica, match_keywords)
select id, 'SL1035', 35, 'Bombeável', 10, 'cm', 2, 2350.32, ARRAY['TC.35','D.10+-2'] from supermix
union all
select id, 'SL1235', 35, 'Bombeável', 12, 'cm', 2, 2342.92, ARRAY['TC.35','D.12+-2'] from supermix
union all
select id, 'SL1435', 35, 'Bombeável', 14, 'cm', 2, 2336.71, ARRAY['TC.35','D.14+-2'] from supermix;

-- CONCREVIT
with concrevit as (
  insert into public.fornecedores_concreto (nome, cnpj, emissor_keywords, tolerancia_padrao, teor_ar)
  values ('CONCREVIT', null, ARRAY['CONCREVIT'], 4, 2)
  returning id
)
insert into public.tracos_concreto (fornecedor_id, codigo, fck, aplicacao, slump_nominal, slump_unidade, slump_tolerancia, densidade_teorica, densidade_pratica)
select id, '12309', 40, 'Fundação', 100, 'mm', 20, 2391, 2439 from concrevit
union all
select id, '12348', 35, 'Teto', 100, 'mm', 20, 2336, 2382 from concrevit
union all
select id, '12354', 35, 'Estrutura', 140, 'mm', 20, 2349, 2396 from concrevit
union all
select id, '12349', 35, 'Teto', 120, 'mm', 20, 2338, 2385 from concrevit
union all
select id, '12355', 35, 'Piso', 100, 'mm', 20, 2339, 2386 from concrevit
union all
select id, '12346', 10, 'Magro', 100, 'mm', 20, 2354, 2401 from concrevit
union all
select id, '12347', 20, 'Magro', 100, 'mm', 20, 2354, 2401 from concrevit;

-- ENGEMIX
with engemix as (
  insert into public.fornecedores_concreto (nome, cnpj, emissor_keywords, tolerancia_padrao)
  values ('ENGEMIX', null, ARRAY['ENGEMIX'], 4)
  returning id
)
insert into public.tracos_concreto (fornecedor_id, codigo, fck, aplicacao, slump_nominal, slump_unidade, slump_tolerancia, densidade_teorica, match_keywords)
select id, '6221995', 35, 'ESP AC<0,55', 10, 'cm', 2, 2302.18, ARRAY['C35','SL10'] from engemix;
