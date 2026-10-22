-- Rodar no SQL Editor do projeto ikvjaowvpvxojvcfwnct (ImobSystem), depois do 1, 2, 3, 5 e 8. Pode rodar de novo.
-- Dados FICTÍCIOS para demonstração do Portal de Pesagem (pedido do Wagner, 22/10/2026: sem histórico real).
-- Um bloco só (tudo ou nada). Datas relativas a now(): a demonstração sempre parece recente.
--
-- Todos os registros usam ids na faixa 00000000-0000-4000-d0XX-…, para o 7_limpar_demonstracao.sql apagar
-- só eles. CNPJs/CPFs são fictícios, mas com dígitos verificadores válidos. Não há fotos/arquivos no storage.
--   d001 obras · d002 fornecedores · d003 pesagens · d004 notas fiscais · d005 logs · d006 WhatsApp
--   d007 sucateiros · d008 veículos · d009 contas da obra · d010 processos de sucata · d011 eventos da sucata

do $demo$
declare
  v_admin uuid;
  v_ano int := extract(year from now())::int;
  v_obras uuid[] := array[
    '00000000-0000-4000-d001-000000000001'::uuid,
    '00000000-0000-4000-d001-000000000002'::uuid,
    '00000000-0000-4000-d001-000000000003'::uuid];
  v_cnpj text[] := '{}';
  v_cpf text;
  v_base text;
  v_dv int;
  i int;
  -- material, fornecedor (emissor), densidade de referência para descrição
  v_mat text[] := array['Areia média lavada', 'Brita 1', 'Aço CA-50 10 mm', 'Concreto usinado FCK 30',
                        'Cimento CP II-E 50 kg', 'Bloco de concreto 14x19x39'];
  v_forn text[] := array['Areal Vale Verde Ltda', 'Pedreira Serra Azul Ltda', 'Aço Forte Distribuidora Ltda',
                         'Concreteira Horizonte Ltda', 'Cimentos do Norte S.A.', 'Blocos Rio Artefatos Ltda'];
  v_transp text[] := array['TransLog Cargas', 'Rodo Rápido Transportes', 'Via Norte Logística'];
  v_mot text[] := array['João Pereira', 'Marcos Silva', 'Ana Souza', 'Carlos Lima', 'Paulo Santos'];
  v_m int; v_obra uuid; v_tara numeric; v_liq numeric; v_nf numeric; v_dif numeric; v_pct numeric;
  v_status text; v_af text; v_ent timestamptz; v_placa text; v_chave text; v_pid uuid;
  v_tipos uuid[];
  v_fases text[] := array['F01','F04','F05','F07','F08','F11','F13','F15'];
  v_acoes text[] := array['entrada_registrada','evidencia_bloco_a_completo','liberado_para_balanca','saida_registrada',
                          'aferido_calculado','peso_deposito_registrado','peso_aceito','valor_informado','recibo_anexado',
                          'comprovante_anexado','fechamento_aprovado','nfa_solicitada','nfa_anexada','nfa_enviada',
                          'processo_encerrado'];
  v_fase_n int; v_bruto numeric; v_valor numeric;
begin
  select id into v_admin from auth.users where lower(email) = 'wsasistemas.ia@gmail.com';
  if v_admin is null or not exists (select 1 from imobpesagens.user_roles where user_id = v_admin) then
    raise exception 'Rode antes o 5_super_admin.sql (wsasistemas.ia@gmail.com precisa ser Super Admin do app).';
  end if;

  -- CNPJs fictícios válidos: base de 12 dígitos + DV encontrado pela própria função do app.
  foreach v_base in array array['112223330001', '457231740001', '603180520001', '718294360001', '845612970001', '932145680001'] loop
    for v_dv in 0..99 loop
      if imobpesagens.sucata_valida_cnpj(v_base || lpad(v_dv::text, 2, '0')) then
        v_cnpj := v_cnpj || (v_base || lpad(v_dv::text, 2, '0'));
        exit;
      end if;
    end loop;
  end loop;
  for v_dv in 0..99 loop
    if imobpesagens.sucata_valida_cpf('529982247' || lpad(v_dv::text, 2, '0')) then
      v_cpf := '529982247' || lpad(v_dv::text, 2, '0');
      exit;
    end if;
  end loop;

  -- ------------------------------------------------------------- obras
  insert into imobpesagens.obras (id, nome, coligada, cnpj, endereco, engenheiro_nome, engenheiro_email) values
    (v_obras[1], 'Residencial Parque das Águas', '1', v_cnpj[1], 'Av. das Américas, 5000 — Barra da Tijuca, Rio de Janeiro/RJ', 'Eng. Rafael Costa', 'wsasistemas.ia@gmail.com'),
    (v_obras[2], 'Edifício Mirante do Vale', '1', v_cnpj[1], 'Rua das Laranjeiras, 320 — Laranjeiras, Rio de Janeiro/RJ', 'Eng. Juliana Prado', 'wsasistemas.ia@gmail.com'),
    (v_obras[3], 'Centro Logístico Norte', '2', v_cnpj[2], 'Rod. Washington Luiz, km 112 — Duque de Caxias/RJ', 'Eng. Bruno Alves', 'wsasistemas.ia@gmail.com')
  on conflict (id) do nothing;

  -- ------------------------------------------------------------- fornecedores de material
  insert into imobpesagens.fornecedores_material_v2 (id, razao_social, cnpj, created_by, created_by_nome, origem)
  select ('00000000-0000-4000-d002-' || lpad(n::text, 12, '0'))::uuid, v_forn[n], v_cnpj[least(n, 6)], v_admin, 'WSA Sistemas', 'manual'
  from generate_series(1, 6) n
  on conflict (id) do nothing;

  -- ------------------------------------------------------------- pesagens (120 nos últimos 60 dias)
  for i in 1..120 loop
    v_m := ((i - 1) % 6) + 1;
    v_obra := v_obras[((i - 1) % 3) + 1];
    v_pid := ('00000000-0000-4000-d003-' || lpad(i::text, 12, '0'))::uuid;
    v_ent := date_trunc('hour', now()) - make_interval(hours => i * 12) + make_interval(mins => (i * 17) % 50);
    v_tara := 14000 + ((i * 137) % 3000);
    v_liq := 5000 + ((i * 731) % 15000);
    -- peso da nota: quase sempre dentro de ±1,5%; a cada 9 pesagens, fora da tolerância (3%).
    v_nf := case
      when i % 9 = 0 then round(v_liq * 0.94)
      when i % 13 = 0 then round(v_liq * 1.05)
      else round(v_liq * (1 + (((i * 7) % 30) - 15) / 1000.0)) end;
    v_dif := v_liq - v_nf;
    v_pct := round(v_dif / v_nf * 100, 2);
    v_af := case when v_pct > 3 then 'acima' when v_pct < -3 then 'abaixo' else 'conforme' end;
    v_status := case
      when i <= 3 then 'aguardando_saida'
      when i % 15 = 0 then 'recusado'
      when v_af <> 'conforme' then 'fechada_com_ocorrencia'
      else 'concluida' end;
    v_placa := chr(65 + (i % 26)) || chr(65 + ((i * 7) % 26)) || chr(65 + ((i * 11) % 26)) || (i % 10)::text
               || chr(65 + ((i * 3) % 26)) || lpad(((i * 37) % 100)::text, 2, '0');
    v_chave := '33' || to_char(v_ent, 'YYMM') || v_cnpj[((v_m - 1) % 6) + 1] || '55' || '001'
               || lpad((100000 + i)::text, 9, '0') || '1' || lpad((i * 97)::text, 8, '0') || (i % 10)::text;

    insert into imobpesagens.pesagens (
      id, obra_id, chave_nfe, numero_nota, emissao, emissor, transportadora, placa, uf, motorista, descricao,
      peso_nf, fonte_nota, peso_entrada, peso_saida, fonte_peso_entrada, fonte_peso_saida, entrou_em, saiu_em, status,
      criado_por, saida_por, created_at, contratante, modelo, marca, valor_total_nf, qtd_total, modo_pesagem,
      peso_esperado, diferenca_kg, diferenca_pct, tolerancia_aplicada, status_afericao, base_calculo,
      ocorrencia_tipo, ocorrencia_relato, ocorrencia_em, ocorrencia_por, justificativa)
    values (
      v_pid, v_obra, v_chave, lpad((100000 + i)::text, 9, '0'), v_ent - interval '6 hours', v_forn[v_m],
      v_transp[((i - 1) % 3) + 1], v_placa, 'RJ', v_mot[((i - 1) % 5) + 1], v_mat[v_m],
      v_nf, 'sefaz', v_tara + v_liq,
      case when v_status = 'aguardando_saida' then null else v_tara end,
      'balanca', case when v_status = 'aguardando_saida' then null else 'balanca'::imobpesagens.fonte_peso end,
      v_ent, case when v_status = 'aguardando_saida' then null else v_ent + interval '35 minutes' end,
      v_status::imobpesagens.status_pesagem,
      v_admin, case when v_status = 'aguardando_saida' then null else v_admin end, v_ent,
      v_forn[v_m], case when i % 2 = 0 then 'Atego 2430' else 'Constellation 24.280' end,
      case when i % 2 = 0 then 'Mercedes-Benz' else 'Volkswagen' end,
      round(v_nf * (0.18 + v_m * 0.11), 2), round(v_nf / 1000, 3), 'dupla',
      v_nf, v_dif, v_pct, 3, v_af, 'soma_itens_densidade_generica',
      case when v_status = 'fechada_com_ocorrencia' then 'divergencia_peso'
           when v_status = 'recusado' then 'material_fora_especificacao' end,
      case when v_status = 'fechada_com_ocorrencia' then format('[DEMO] Peso aferido %s%% em relação à nota fiscal.', v_pct)
           when v_status = 'recusado' then '[DEMO] Carga recusada: material fora da especificação do pedido.' end,
      case when v_status in ('fechada_com_ocorrencia', 'recusado') then v_ent + interval '30 minutes' end,
      case when v_status in ('fechada_com_ocorrencia', 'recusado') then v_admin end,
      case when v_status = 'recusado' then '[DEMO] Recusa registrada pelo operador.' end)
    on conflict (id) do nothing;

    insert into imobpesagens.notas_fiscais (id, obra_id, chave, numero, emissao, emissor, emissor_cnpj,
      destinatario_cnpj, transportadora, placa, uf, peso, descricao, fonte)
    values (('00000000-0000-4000-d004-' || lpad(i::text, 12, '0'))::uuid, v_obra, v_chave,
      lpad((100000 + i)::text, 9, '0'), v_ent - interval '6 hours', v_forn[v_m], v_cnpj[((v_m - 1) % 6) + 1],
      case when v_obra = v_obras[3] then v_cnpj[2] else v_cnpj[1] end, v_transp[((i - 1) % 3) + 1], v_placa, 'RJ',
      v_nf, v_mat[v_m], 'sefaz')
    on conflict (id) do nothing;

    insert into imobpesagens.pesagem_logs (id, pesagem_id, evento, justificativa, usuario_id, usuario_nome, usuario_email, created_at)
    values (('00000000-0000-4000-d005-' || lpad(i::text, 12, '0'))::uuid, v_pid, 'entrada_registrada',
      '[DEMO] Entrada registrada na balança.', v_admin, 'WSA Sistemas', 'wsasistemas.ia@gmail.com', v_ent)
    on conflict (id) do nothing;

    -- alerta de WhatsApp para as pesagens acima da tolerância
    if v_af = 'acima' and v_status <> 'aguardando_saida' then
      insert into imobpesagens.whatsapp_alertas (id, pesagem_id, tipo_alerta, obra_id, coligada, placa, ocorrencia_ref,
        destinatario_user_id, destinatario_nome, telefone, template, template_idioma, status, mensagem_texto, created_by, created_at)
      values (('00000000-0000-4000-d006-' || lpad((1000 + i)::text, 12, '0'))::uuid, v_pid, 'alerta_tolerancia_acima',
        v_obra, case when v_obra = v_obras[3] then '2' else '1' end, v_placa, 'OC-' || lpad(i::text, 5, '0'),
        v_admin, 'Eng. responsável (demo)', '+5521999990000', 'alerta_pesagem_acima_tolerancia', 'pt_BR',
        case when i % 2 = 0 then 'entregue' else 'enviado' end,
        format('[DEMO] Pesagem %s acima da tolerância: %s%% (placa %s).', lpad((100000 + i)::text, 9, '0'), v_pct, v_placa),
        v_admin, v_ent + interval '40 minutes')
      on conflict (id) do nothing;
    end if;
  end loop;

  -- ------------------------------------------------------------- WhatsApp (sem credenciais reais)
  insert into imobpesagens.whatsapp_templates (id, funcao_key, funcao_label, descricao, template_id, variaveis, ativo)
  values ('00000000-0000-4000-d006-000000000001', 'demo_alerta_tolerancia', '[DEMO] Alerta de tolerância',
          'Modelo de demonstração: avisa o engenheiro quando a pesagem passa da tolerância.', 'demo-template',
          array['obra', 'placa', 'percentual'], true)
  on conflict (id) do nothing;
  insert into imobpesagens.whatsapp_mensagens (id, contato_whatsapp, contato_nome, contato_email, obra_id, mensagem, direcao, tipo, status, created_by, created_at)
  select ('00000000-0000-4000-d006-' || lpad((100 + n)::text, 12, '0'))::uuid, '+5521999990000', 'Eng. responsável (demo)',
         'wsasistemas.ia@gmail.com', v_obras[((n - 1) % 3) + 1],
         (array['[DEMO] Bom dia! A carga de areia da placa RAB1C23 chegou com 2% acima da nota.',
                '[DEMO] Recebido, vou conferir com o fornecedor.',
                '[DEMO] Caminhão de brita liberado na portaria.',
                '[DEMO] Obrigado pelo aviso.',
                '[DEMO] Concreto FCK 30 dentro da tolerância.',
                '[DEMO] Perfeito, pode seguir com a concretagem.'])[n],
         case when n % 2 = 1 then 'enviada' else 'recebida' end, 'texto', 'entregue', v_admin,
         now() - make_interval(hours => 6 * (7 - n))
  from generate_series(1, 6) n
  on conflict (id) do nothing;

  -- ------------------------------------------------------------- sucata: sucateiros, veículos, contas da obra
  insert into imobpesagens.sucata_sucateiros (id, tipo_pessoa, razao_social, nome_fantasia, cnpj, inscricao_estadual,
    cep, logradouro, numero, bairro, municipio, uf, email_coleta, email_financeiro, telefone, contato_responsavel,
    banco, agencia, conta, tipo_conta, titularidade, chave_pix, situacao, observacoes, coligada_origem, created_by, valor_por_kg)
  values
    ('00000000-0000-4000-d007-000000000001', 'PJ', 'Metais Recicla Rio Ltda', 'Recicla Rio', v_cnpj[3], '12345678',
     '20040-002', 'Rua Primeiro de Março', '100', 'Centro', 'Rio de Janeiro', 'RJ', 'wsasistemas.ia@gmail.com',
     'wsasistemas.ia@gmail.com', '(21) 3333-1000', 'Fernanda Rocha', '341', '1234', '56789-0', 'Corrente', 'Própria',
     'wsasistemas.ia@gmail.com', 'ATIVO', '[DEMO] Sucateiro de demonstração.', '1', v_admin, 1.2500),
    ('00000000-0000-4000-d007-000000000002', 'PJ', 'Ferro Velho Baixada Comércio Ltda', 'Ferro Velho Baixada', v_cnpj[4], '87654321',
     '25010-000', 'Av. Brigadeiro Lima e Silva', '1500', 'Centro', 'Duque de Caxias', 'RJ', 'wsasistemas.ia@gmail.com',
     null, '(21) 3333-2000', 'Roberto Nunes', '237', '4321', '12345-6', 'Corrente', 'Própria', null,
     'ATIVO', '[DEMO] Sucateiro de demonstração.', '2', v_admin, 1.1000)
  on conflict (id) do nothing;
  insert into imobpesagens.sucata_sucateiros (id, tipo_pessoa, nome_completo, cpf, rg, orgao_emissor,
    cep, logradouro, numero, bairro, municipio, uf, email_coleta, telefone, banco, agencia, conta, tipo_conta,
    titularidade, chave_pix, situacao, observacoes, coligada_origem, created_by, valor_por_kg)
  values ('00000000-0000-4000-d007-000000000003', 'PF', 'José Carlos da Silva', v_cpf, '123456789', 'DETRAN/RJ',
     '21040-360', 'Rua Uranos', '45', 'Ramos', 'Rio de Janeiro', 'RJ', 'wsasistemas.ia@gmail.com', '(21) 98888-3000',
     '104', '0987', '00012345-1', 'Poupança', 'Própria', null, 'EM_HOMOLOGACAO', '[DEMO] Sucateiro pessoa física.',
     '1', v_admin, 1.0500)
  on conflict (id) do nothing;

  insert into imobpesagens.sucata_veiculos (id, sucateiro_id, placa, tipo_veiculo, capacidade_kg, motorista_habitual, created_by) values
    ('00000000-0000-4000-d008-000000000001', '00000000-0000-4000-d007-000000000001', 'RIO2A26', 'Caminhão toco', 8000, 'Sérgio Mendes', v_admin),
    ('00000000-0000-4000-d008-000000000002', '00000000-0000-4000-d007-000000000002', 'BXD4C58', 'Caminhão truck', 14000, 'Luiz Ferreira', v_admin),
    ('00000000-0000-4000-d008-000000000003', '00000000-0000-4000-d007-000000000003', 'JCS7E91', 'Caminhonete', 1500, 'José Carlos da Silva', v_admin)
  on conflict (id) do nothing;

  insert into imobpesagens.sucata_contas_obra (id, obra_id, coligada_origem, banco, agencia, conta, titular, titular_documento, chave_pix, observacoes, created_by)
  select ('00000000-0000-4000-d009-' || lpad(n::text, 12, '0'))::uuid, v_obras[n], case when n = 3 then '2' else '1' end,
         '001', '3300', '1000' || n || '-0', 'Construtora Exemplo Ltda', case when n = 3 then v_cnpj[2] else v_cnpj[1] end,
         'financeiro.demo@imobsystems.com.br', '[DEMO] Conta de recebimento da obra.', v_admin
  from generate_series(1, 3) n
  on conflict (id) do nothing;

  -- ------------------------------------------------------------- sucata: 8 processos em fases diferentes
  -- Inseridos já no estado final: os gatilhos de regra (pesos imutáveis, valor só pelo portal, NFA exige aprovação,
  -- encerramento com 6 fotos) são de UPDATE e não disparam. O processo concluído é demonstração sem fotos.
  select array_agg(id order by ordem, codigo) into v_tipos from imobpesagens.sucata_tipos;
  for i in 1..8 loop
    v_fase_n := substr(v_fases[i], 2)::int;
    v_pid := ('00000000-0000-4000-d010-' || lpad(i::text, 12, '0'))::uuid;
    v_ent := now() - make_interval(days => (9 - i) * 3, hours => 9);
    v_tara := 7000 + i * 350;
    v_bruto := case when v_fase_n >= 4 then v_tara + 1800 + i * 420 end;
    v_valor := case when v_fase_n >= 8 then round((v_bruto - v_tara) * 1.20, 2) end;
    insert into imobpesagens.sucata_processos (
      id, numero, ano, obra_id, coligada_origem, sucateiro_id, veiculo_id, placa, motorista, snapshot_fiscal,
      tara_kg, bruto_kg, tipo_sucata_id, fase, situacao, entrada_em, saida_em, created_by, saida_por,
      notificado_em, aceite_em, aceite_email, valor_total, recibo_modo, valor_unitario_kg,
      aprovado_em, aprovado_por, conta_obra_id, pagamento_valor, pagamento_data,
      nfa_solicitada_em, nfa_numero, nfa_emissao, concluido_em, concluido_por, descricao_carga, created_at)
    values (
      v_pid, 'DEMO-' || lpad(i::text, 4, '0') || '/' || v_ano, v_ano, v_obras[((i - 1) % 3) + 1],
      case when ((i - 1) % 3) + 1 = 3 then '2' else '1' end,
      ('00000000-0000-4000-d007-' || lpad((((i - 1) % 3) + 1)::text, 12, '0'))::uuid,
      ('00000000-0000-4000-d008-' || lpad((((i - 1) % 3) + 1)::text, 12, '0'))::uuid,
      (array['RIO2A26', 'BXD4C58', 'JCS7E91'])[((i - 1) % 3) + 1], 'Motorista demo ' || i, '{}'::jsonb,
      v_tara, v_bruto, case when v_fase_n >= 4 then v_tipos[((i - 1) % greatest(array_length(v_tipos, 1), 1)) + 1] end,
      v_fases[i], case when v_fase_n = 15 then 'CONCLUIDO' else 'PENDENTE' end,
      v_ent, case when v_fase_n >= 4 then v_ent + interval '2 hours' end, v_admin,
      case when v_fase_n >= 4 then v_admin end,
      case when v_fase_n >= 5 then v_ent + interval '3 hours' end,
      case when v_fase_n >= 8 then v_ent + interval '1 day' end,
      case when v_fase_n >= 8 then 'wsasistemas.ia@gmail.com' end,
      v_valor, case when v_fase_n >= 8 then 'SISTEMA' end, case when v_fase_n >= 8 then 1.2000 end,
      case when v_fase_n >= 11 then v_ent + interval '2 days' end, case when v_fase_n >= 11 then v_admin end,
      case when v_fase_n >= 11 then ('00000000-0000-4000-d009-' || lpad((((i - 1) % 3) + 1)::text, 12, '0'))::uuid end,
      case when v_fase_n >= 11 then v_valor end, case when v_fase_n >= 11 then (v_ent + interval '2 days')::date end,
      case when v_fase_n >= 12 then v_ent + interval '2 days 1 hour' end,
      case when v_fase_n >= 13 then '0000' || (4500 + i) end,
      case when v_fase_n >= 13 then (v_ent + interval '3 days')::date end,
      case when v_fase_n = 15 then v_ent + interval '4 days' end, case when v_fase_n = 15 then v_admin end,
      '[DEMO] Sucata de vergalhão e chapas', v_ent)
    on conflict (id) do nothing;

    -- linha do tempo: um evento por fase concluída até a fase atual
    insert into imobpesagens.sucata_eventos (id, processo_id, entidade, entidade_id, fase, acao, payload, coligada_origem,
      usuario_id, usuario_nome, usuario_email, created_at)
    select ('00000000-0000-4000-d011-' || lpad((i * 100 + f)::text, 12, '0'))::uuid, v_pid, 'processo', v_pid,
           'F' || lpad(f::text, 2, '0'), v_acoes[f], jsonb_build_object('demo', true),
           case when ((i - 1) % 3) + 1 = 3 then '2' else '1' end, v_admin, 'WSA Sistemas', 'wsasistemas.ia@gmail.com',
           v_ent + make_interval(hours => f * 2)
    from generate_series(1, v_fase_n) f
    on conflict (id) do nothing;
  end loop;

  -- ------------------------------------------------------------- conferência (se faltar algo, nada é gravado)
  if (select count(*) from imobpesagens.obras where id::text like '00000000-0000-4000-d001-%') <> 3
     or (select count(*) from imobpesagens.pesagens where id::text like '00000000-0000-4000-d003-%') <> 120
     or (select count(*) from imobpesagens.notas_fiscais where id::text like '00000000-0000-4000-d004-%') <> 120
     or (select count(*) from imobpesagens.sucata_processos where id::text like '00000000-0000-4000-d010-%') <> 8
     or (select count(*) from imobpesagens.sucata_sucateiros where id::text like '00000000-0000-4000-d007-%') <> 3 then
    raise exception 'Conferência dos dados de demonstração falhou: contagens diferentes do esperado.';
  end if;
end
$demo$;

-- Resumo do que existe de demonstração.
select 'obras' as tabela, count(*) as qtd from imobpesagens.obras where id::text like '00000000-0000-4000-d001-%'
union all select 'fornecedores', count(*) from imobpesagens.fornecedores_material_v2 where id::text like '00000000-0000-4000-d002-%'
union all select 'pesagens', count(*) from imobpesagens.pesagens where id::text like '00000000-0000-4000-d003-%'
union all select 'notas fiscais', count(*) from imobpesagens.notas_fiscais where id::text like '00000000-0000-4000-d004-%'
union all select 'alertas WhatsApp', count(*) from imobpesagens.whatsapp_alertas where id::text like '00000000-0000-4000-d006-%'
union all select 'mensagens WhatsApp', count(*) from imobpesagens.whatsapp_mensagens where id::text like '00000000-0000-4000-d006-%'
union all select 'sucateiros', count(*) from imobpesagens.sucata_sucateiros where id::text like '00000000-0000-4000-d007-%'
union all select 'processos de sucata', count(*) from imobpesagens.sucata_processos where id::text like '00000000-0000-4000-d010-%'
union all select 'eventos de sucata', count(*) from imobpesagens.sucata_eventos where id::text like '00000000-0000-4000-d011-%';
