# Fase 4 — Conferência da obra e Nota Fiscal Avulsa

Objetivo: o administrativo da obra confere o recibo do sucateiro e o comprovante de pagamento e aprova. Só depois da aprovação a Contabilidade recebe a solicitação e emite a Nota Fiscal Avulsa, anexando o arquivo original ao processo.

## Decisões confirmadas

- Contas bancárias da obra: nova tabela **com tela de cadastro** dentro de Sucata > Cadastros.
- Comprovante de pagamento: **leitura automática primeiro**, com conferência e correção pelo administrativo, mais **checagem de duplicidade** (mesmo comprovante já usado em outro processo).
- Perfis: conferência para coordenador e admin; Nota Fiscal Avulsa para admin e superadmin.
- E-mail da Contabilidade: **parâmetro configurável** do módulo (aceita mais de um endereço).

## Banco (tudo aditivo)

1. Nova tabela `sucata_contas_obra`: obra, coligada, banco, agência, conta, tipo, titular, documento do titular, chave PIX opcional, situação (ativa/inativa), auditoria. Acesso por coligada, leitura para quem já vê a obra, manutenção para coordenador/admin. Sem exclusão física.
2. Novas colunas em `sucata_processos`: aprovação (data, autor, observação), devolução (data, autor, motivo, fase de origem), pagamento (conta da obra, valor, data, marca de conta divergente, justificativa, identificador do comprovante para duplicidade) e Nota Fiscal Avulsa (número, data de emissão, arquivo, data de envio, motivo de impedimento).
3. Novos parâmetros do módulo: e-mails da Contabilidade e texto do aviso fiscal para pessoa física.
4. Regras aplicadas no próprio banco (não só na tela):
   - não é possível marcar solicitação/emissão da nota sem aprovação registrada;
   - não é possível aprovar com conta fora do cadastro sem justificativa;
   - valor da nota sempre igual ao valor informado pelo sucateiro — qualquer tentativa de alterar é recusada;
   - fases F09 a F14 já previstas continuam válidas.

## Telas

**T8 · Conferência e aprovação — `/sucata/:id/conferencia`** (coordenador/admin)
- Card do recibo do sucateiro (foto 010): imagem, valor lido no recibo e valor informado no aceite, com selo "confere" ou "divergente" com texto ao lado.
- Card do comprovante (foto 011): imagem, conta creditada, valor pago e data. O sistema tenta ler esses dados do comprovante automaticamente; o administrativo confirma ou corrige. Confronta com as contas cadastradas da obra e com o valor total, e avisa se o mesmo comprovante já foi usado em outro processo.
- Conta fora do cadastro: marca divergência e exige justificativa para aprovar.
- Card de parecer: "Aprovar e solicitar NFA à Contabilidade" e "Devolver ao responsável" (motivo obrigatório, volta o processo à fase de origem da pendência: recibo ou comprovante).
- Aprovar registra a aprovação, dispara o e-mail à Contabilidade e avança para F12.

**T9 · Nota Fiscal Avulsa — `/sucata/:id/nfa`** (admin/superadmin)
- Card esquerdo: todos os dados de emissão em somente leitura, no layout dos campos da nota, com botão "Copiar dados para o emissor". Sucateiro pessoa física exibe o aviso de tratamento fiscal diferenciado com texto vindo do parâmetro.
- Card direito: número, data de emissão e envio do arquivo original (PDF ou foto) para o depósito privado; "Anexar nota ao processo" grava a evidência na posição 012 e avança para F13.
- "Registrar impedimento": grava o motivo, devolve o processo para F11 e avisa a obra.
- Card opcional de envio da nota ao sucateiro por e-mail, que não bloqueia o andamento (F14).

## E-mails

- Solicitação à Contabilidade: obra, número do processo, destinatário (razão social ou nome completo, documento, endereço), natureza "Venda de sucata", produto, quantidade em quilos, valor total, data da coleta e placa, com links temporários do recibo, do comprovante de pagamento e do comprovante de pesagem. Registrado em notificações e auditoria.
- Envio da nota ao sucateiro: e-mail com a nota anexada por link temporário, também registrado.

## Detalhes técnicos

- Migração aditiva única: `CREATE TABLE public.sucata_contas_obra` + GRANT + RLS por coligada (reutilizando `pode_ver_coligada` / `sucata_pode_ler` / `sucata_pode_escrever`), `ALTER TABLE sucata_processos ADD COLUMN IF NOT EXISTS ...` (todas anuláveis), inserção dos parâmetros novos, e triggers `sucata_nfa_exige_aprovacao_trg` (bloqueia `nfa_*`/`nfa_enviada_em` sem `aprovado_em`), `sucata_aprovacao_exige_justificativa_trg` e reforço da imutabilidade de `valor_total`. Nenhum DROP/RENAME.
- Server functions autenticadas em `src/lib/sucata/nfa.functions.ts`: `aprovarConferencia`, `devolverConferencia`, `solicitarNfa` (revalida `aprovado_em` no banco), `anexarNfa`, `registrarImpedimentoNfa`, `enviarNfaSucateiro`. Helper server-only `src/lib/sucata/nfa.server.ts` para montagem dos e-mails e signed URLs, reutilizando `notificacoes.server.ts`.
- Leitura automática do comprovante: nova server function `lerComprovantePagamento` (mesmo gateway de IA já usado na leitura de notas), retornando banco/agência/conta/valor/data + hash do arquivo para a checagem de duplicidade. Sem OCR novo no client.
- Nova aba de contas em `src/components/sucata/cadastro-contas-obra.tsx`, consultas em `sucata-queries.ts` (colunas explícitas, sem `select *`), rotas `src/routes/sucata.$id.conferencia.tsx` e `src/routes/sucata.$id.nfa.tsx`, atualização da timeline e do card de status em `sucata.$id.index.tsx`.
- Fora desta fase: relatório fotográfico e encerramento (F15).

## Checklist de aceite

- [ ] Confere recibo e comprovante com imagens e valores confrontados
- [ ] Divergência entre valor do aceite e valor pago sinalizada com texto
- [ ] Conta fora do cadastro exige justificativa para aprovar
- [ ] Comprovante repetido em outro processo é avisado
- [ ] Aprovar envia o e-mail à Contabilidade e avança para F12
- [ ] Solicitar nota sem aprovação é recusado pelo banco
- [ ] Devolver exige motivo e volta à fase de origem
- [ ] Tela da Contabilidade em somente leitura, sem permitir alterar o valor
- [ ] Anexar a nota grava a evidência 012 e avança para F13
- [ ] Impedimento devolve para F11 com motivo e avisa a obra
- [ ] Envio da nota ao sucateiro é opcional e não bloqueia
- [ ] Pessoa física exibe o aviso fiscal do parâmetro
