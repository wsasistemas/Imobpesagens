# FASE 3 — Aceite do peso, valor e recibo pelo sucateiro

O sucateiro recebe o peso aferido por e-mail, aceita ou contesta, informa o valor e gera o recibo — por link, sem login, sem nenhum acesso direto às tabelas.

## Banco (migrações aditivas)

`sucata_processos` — colunas novas, todas nulas:
- `aceite_token_hash`, `aceite_token_expira_em`, `aceite_em`, `aceite_ip` (inet), `aceite_email`
- `contestacao_em`, `contestacao_motivo`
- `valor_total` numeric(12,2)
- `valor_por_tonelada` numeric(12,2) GENERATED: `round(valor_total / (peso_aferido_kg/1000), 2)` quando o aferido for maior que zero — sempre calculado pelo banco
- `recibo_modo` com valores permitidos `SISTEMA` ou `PROPRIO`
- `reenvio_em`, `alerta_admin_em` (controle do reenvio automático)
- índice único parcial em `aceite_token_hash`

`sucata_tipos` — colunas novas nulas: `valor_ton_min`, `valor_ton_max` (faixa de referência por tipo, editável no cadastro).

`sucata_notificacoes` (nova): processo, tipo (`ACEITE_PESO`, `REENVIO_ACEITE`, `SOLICITACAO_NFA`, `ENVIO_NFA`), destinatário, assunto, status (`ENFILEIRADA`, `ENVIADA`, `FALHA`), id da mensagem no provedor, erro, data de envio.

`sucata_parametros` (nova, chave/valor): prazos `reenvio_horas` = 48 e `alerta_admin_dias` = 5, e `token_validade_dias` = 7. Nada de prazo fixo no código.

Regras no banco:
- RLS ativa em tudo, por coligada, com os mesmos auxiliares já usados no módulo; nenhuma permissão para o papel anônimo.
- Trava de imutabilidade: depois do aceite, qualquer alteração de tara, bruto ou aferido é recusada; a exceção é o perfil **superadmin**, e a reabertura grava evento próprio (`REABERTURA_PESO`) com motivo.
- Trava de valor: `valor_total` e `recibo_modo` só podem ser gravados pelo caminho do portal externo (chave de serviço). Nenhuma tela interna grava esse valor.

## Backend (padrão atual do Portal, sem funções Deno)

- `enviarAceiteSucateiro` — função de servidor autenticada: gera token aleatório de 32 bytes, grava só o hash SHA-256 e a validade, monta o e-mail, envia pelo Resend já configurado, grava em `sucata_notificacoes`, avança para F05 e registra evento. O token em claro só existe no link do e-mail.
- `/api/public/coleta` — rota pública única do portal externo, com chave de serviço no servidor. Ações: `consultar`, `aceitar`, `contestar`, `informar_valor`. Valida hash e validade do token, aplica limite de tentativas por token e por IP, e nunca devolve nem lista outro processo. Token expirado ou já aceito responde em modo leitura, com mensagem clara.
- Tarefa agendada diária (manhã): reenvia o aceite após as 48 h e alerta o administrativo da obra após 5 dias, com os prazos lidos da tabela de parâmetros. O reenvio usa o e-mail atual do cadastro e não invalida o link anterior. Verificação 1x por dia mantém o custo baixo; o reenvio pode sair até 24 h depois do prazo cheio.

## Telas

**T5 · /sucata/$id/notificar (interna)** — pré-visualização do e-mail exatamente como o sucateiro recebe, corpo não editável, ao lado do destinatário do cadastro, lista das variáveis, regras do link e política de reenvio. Botão "Enviar e-mail de aceite".

**T6 · /coleta/aceite/$token (pública)** — página mínima, celular primeiro, marca CALPER, número do processo, tabela da coleta e o peso aferido em destaque no visual do mostrador da balança. Duas ações: aceitar ou não concordar (com motivo). Sem menu e sem link para o resto do sistema.

**T7 · /coleta/aceite/$token/valor (pública)** — campo único de valor total com máscara em reais, conferência ao lado mostrando o valor por tonelada calculado, aviso discreto (sem bloquear) quando fica fora da faixa do tipo, e registro do fato no evento. Duas saídas: "Gerar e imprimir recibo" e "Apenas validar o valor · emito recibo próprio".

**Recibo** — página própria para impressão (CSS de impressão), uma via, números em fonte monoespaçada, com processo, obra, data, placa, tipo, peso aferido, comprador, CNPJ/CPF, valor total em destaque e linha de assinatura.

O e-mail é HTML responsivo com identidade CALPER: assunto "Coleta de sucata — {obra} — placa {placa} — aceite do peso aferido", tabela com obra, data, placa, tipo, tara, bruto e aferido em destaque, e os dois botões (aceitar em verde, contestar em contorno). Todas as variáveis vêm do processo.

## Arquivos

- Novos: `src/lib/sucata/aceite.functions.ts`, `src/lib/sucata/aceite.server.ts` (token, e-mail, portal), `src/lib/sucata/email-aceite.ts` (template), `src/lib/sucata/parametros.ts`, `src/routes/api/public/coleta.ts`, `src/routes/sucata.$id.notificar.tsx`, `src/routes/coleta.aceite.$token.index.tsx`, `src/routes/coleta.aceite.$token.valor.tsx`, `src/routes/coleta.aceite.$token.recibo.tsx`, componentes do portal e do recibo em `src/components/sucata/`.
- Alterados: `src/lib/sucata/sucata-queries.ts` e `tipos.ts` (colunas novas), `src/components/sucata/cadastro-tipos-sucata.tsx` (faixa por tonelada), `src/routes/sucata.$id.index.tsx` (ação de notificar, aceite/valor na timeline), `src/lib/sucata/fases.ts` (ações novas de evento).

## Fora desta fase

Conferência da obra, NFA e relatório fotográfico.

## Checklist de aceite

Ao final, respondo item por item marcando OK ou PENDENTE, incluindo: e-mail com variáveis preenchidas, corpo não editável, link sem login mostrando só aquele processo, token só como hash, token expirado em modo leitura, aceite gravando data/hora/IP/e-mail e F07, contestação com motivo e alerta ao administrativo, valor apenas pelo sucateiro, valor por tonelada calculado no banco, aviso de faixa sem bloqueio, recibo pronto para impressão, validação sem recibo, imutabilidade dos pesos com reabertura registrada só para superadmin, nenhuma política para o papel anônimo, e reenvio de 48 h e alerta de 5 dias vindos de parâmetro.
