-- Rodar no SQL Editor do projeto ikvjaowvpvxojvcfwnct (ImobSystem) quando quiser tirar os dados de demonstração.
-- Apaga SÓ o que o 6_dados_demonstracao.sql criou (ids 00000000-0000-4000-d0XX-…). Não toca na configuração
-- inicial, no Super Admin nem em nada cadastrado de verdade. Um bloco só (tudo ou nada). Pode rodar de novo.
-- Atenção: registros reais criados DEPOIS e ligados a uma obra de demonstração (ex.: uma pesagem nova numa obra demo)
-- impedem apagar essa obra; o bloco para com erro e nada é apagado.

do $limpar$
declare
  v_faixa constant text := '00000000-0000-4000-d0%';
begin
  delete from imobpesagens.whatsapp_alertas   where id::text like v_faixa;
  delete from imobpesagens.whatsapp_mensagens where id::text like v_faixa;
  delete from imobpesagens.whatsapp_templates where id::text like v_faixa;
  delete from imobpesagens.pesagem_logs       where id::text like v_faixa;
  delete from imobpesagens.pesagens           where id::text like v_faixa;
  delete from imobpesagens.notas_fiscais      where id::text like v_faixa;
  delete from imobpesagens.sucata_eventos     where id::text like v_faixa;
  delete from imobpesagens.sucata_processos   where id::text like v_faixa;
  delete from imobpesagens.sucata_contas_obra where id::text like v_faixa;
  delete from imobpesagens.sucata_veiculos    where id::text like v_faixa;
  delete from imobpesagens.sucata_sucateiros  where id::text like v_faixa;
  delete from imobpesagens.fornecedores_material_v2 where id::text like v_faixa;
  delete from imobpesagens.obras              where id::text like v_faixa;
end
$limpar$;

-- Conferência: tudo deve dar 0.
select 'obras' as tabela, count(*) as qtd from imobpesagens.obras where id::text like '00000000-0000-4000-d0%'
union all select 'pesagens', count(*) from imobpesagens.pesagens where id::text like '00000000-0000-4000-d0%'
union all select 'notas fiscais', count(*) from imobpesagens.notas_fiscais where id::text like '00000000-0000-4000-d0%'
union all select 'processos de sucata', count(*) from imobpesagens.sucata_processos where id::text like '00000000-0000-4000-d0%'
union all select 'sucateiros', count(*) from imobpesagens.sucata_sucateiros where id::text like '00000000-0000-4000-d0%'
union all select 'WhatsApp', (select count(*) from imobpesagens.whatsapp_mensagens where id::text like '00000000-0000-4000-d0%')
                           + (select count(*) from imobpesagens.whatsapp_alertas where id::text like '00000000-0000-4000-d0%');
