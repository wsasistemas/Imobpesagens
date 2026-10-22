# Módulo Sucata — Portal de Pesagem CALPER

Controla a venda de sucata ferrosa retirada das obras, da entrada do caminhão ao encerramento com relatório fotográfico.

## Fases (F01–F15)

| Fase | O que acontece | Responsável |
| --- | --- | --- |
| F01 | Entrada do caminhão vazio, tara registrada | Operador de balança |
| F02–F03 | Carregamento e fotos 001–004 na obra | Encarregado da obra |
| F04 | Saída com peso bruto; aferido calculado pelo banco | Operador de balança |
| F05–F07 | Fotos do depósito (005–008) e comprovante do sucateiro (009) | Funcionário CALPER |
| F08–F10 | Envio do peso ao sucateiro, aceite, valor e recibo (010) | Sucateiro, por link sem login |
| F11–F12 | Conferência do recibo e do comprovante bancário (011), aprovação | Administrativo da obra |
| F13–F14 | Solicitação e emissão da Nota Fiscal Avulsa (012) | Contabilidade |
| F15 | Relatório fotográfico enviado; processo concluído | Operação / coordenação |

## Tabelas (`sucata_`)

sucateiros, sucateiro_documentos, veiculos, tipos, processos, numeracao, eventos, evidencias, notificacoes, parametros, contas_obra, relatorios, destinatarios_relatorio.

Todas com RLS por coligada (`pode_ver_coligada`), sem DELETE físico, e com auditoria em `sucata_eventos`.

## Evidências

12 posições fixas, catálogo em `src/lib/sucata/posicoes-evidencia.ts`. Blocos A (001–004, obra), B (005–008, depósito) e C (009–012, documentos). Substituição gera nova versão com motivo; nada é apagado.

## Armazenamento privado

- `sucata-evidencias` — fotos do processo
- `sucata-documentos` — documentos do sucateiro, recibo, comprovante, NFA
- `sucata-relatorios` — PDFs do relatório fotográfico, um por versão

## Relatório fotográfico e encerramento (dentro da Fase 4)

- Ao anexar a Nota Fiscal Avulsa e o e-mail ao sucateiro sair com sucesso, o próprio navegador da Contabilidade monta o relatório (2 páginas A4, 5 fotos, nota em PDF vira preview da 1ª página via `pdfjs-dist`), gera o PDF (`src/lib/sucata/relatorio-pdf.ts`) e chama `encerrarComRelatorio`.
- `encerrarComRelatorio` (`src/lib/sucata/relatorio.functions.ts`) exige as 5 fotos, nota anexada e enviada; guarda o PDF versionado, envia aos destinatários ativos da coligada e encerra o processo mesmo sem destinatários ou com falha no e-mail do relatório.
- Se o e-mail da nota ao sucateiro falhar, o processo fica aberto com botão "Reenviar nota ao sucateiro e encerrar"; se só o relatório falhar, aparece "Gerar relatório e encerrar".
- Tela `/sucata/$id/relatorio`: pré-visualização, impressão, versões anteriores e reenvio manual (em processo concluído gera nova versão sem reabrir).
- Histórico do processo mostra as 4 fases com marcos (entrada, saída, valor, pedido, nota anexada, nota enviada, relatório, encerramento). Os códigos F01–F15 seguem apenas no banco, por compatibilidade.
- Processo concluído fica somente leitura; reabertura apenas pela TI (`superadmin`), sempre com motivo, barrada também por trigger.

## Pendências conhecidas

- `sucata_notificacoes.tipo` ainda não aceita `RELATORIO_FOTOGRAFICO`; o envio funciona e fica registrado em `sucata_relatorios` e `sucata_eventos`, mas o registro na fila de notificações depende de liberar esse valor.
- Consulta de CEP (BrasilAPI com alternativa ViaCEP) usa cache em memória do servidor com validade de 24 h; o padrão do workspace pede Redis.
- Rate limiting das rotas públicas usa contador em memória; o padrão do workspace pede Redis.
- Agendamento diário de varredura pendente (`pg_cron` indisponível).

## Processo remodelado em 4 fases (setembro/2026)

| Fase | Responsável | O que é registrado |
| --- | --- | --- |
| 1 — Entrada do caminhão | Operador de balança | Sucateiro, placa, caminhão/motorista, foto 001 (caminhão vazio) e peso da tara |
| 2 — Saída do caminhão | Operador de balança | Peso bruto, foto 004 (caçamba cheia), descrição da carga; o sistema apura o peso aferido, calcula o valor a pagar (valor por quilo do sucateiro × peso aferido) e envia automaticamente o pedido da Nota Fiscal Avulsa à Contabilidade |
| 3 — Nota Fiscal Avulsa | Contabilidade | Tela pré-preenchida, número e data da nota, foto 012 (nota emitida), envio ao sucateiro por e-mail ou exportação em PDF; ao concluir, avisa engenheiro responsável e administrativo da obra por e-mail e WhatsApp |
| 4 — Recibo do sucateiro | Administrativo da obra | Foto 010 (recibo) e foto 011 (comprovante de pagamento), geração do relatório fotográfico e encerramento |

- Sequência fotográfica obrigatória: 001, 004, 010, 011 e 012 (cinco fotos).
- Valor por quilo fica no cadastro do sucateiro (`sucata_sucateiros.valor_por_kg`), obrigatório para sucateiro ATIVO e válido apenas para coletas futuras.
- Ajuste do valor calculado só por administrador ou TI, sempre com justificativa gravada em auditoria (`valor_ajustado_em`, `valor_ajuste_justificativa`).
- Cada fase guarda quem abriu e quem concluiu, com data e hora, em `sucata_processos.fases_registro` (jsonb).
- Perfil `contador` (Contabilidade) só enxerga o módulo Sucata, emite e anexa a nota.
- E-mail da Contabilidade: enviado somente aos usuários com perfil `contador`, no e-mail do cadastro do usuário (sem endereço fixo em parâmetros).
- Toda a operação das fases 1 a 4 acontece na tela do processo (`/sucata/:id`), em passo a passo.
- Os códigos F01–F15 seguem no banco apenas por compatibilidade.
