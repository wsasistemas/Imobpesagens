## Detalhes técnicos

**Banco (mudanças aditivas, aplicadas ao aceitar o rascunho)**
- `usuario_coligadas`: coluna `engenheiro_responsavel boolean not null default false` + índice único parcial por `codcoligada` onde verdadeiro.
- `profiles`: coluna `whatsapp_e164 text` (telefone normalizado; `telefone` permanece como está).
- `whatsapp_config`: colunas `meta_phone_number_id`, `meta_waba_id`, `meta_display_name`, `alertas_tolerancia_ativo boolean default false`, `alerta_template_nome`, `alerta_template_idioma default 'pt_BR'`.
- Nova tabela `whatsapp_alertas` (pesagem_id, ocorrencia_ref, obra_id, coligada, destinatario_user_id, destinatario_nome, telefone, template, variaveis jsonb, tipo_alerta text default `alerta_tolerancia_acima`, status text, meta_message_id, erro_detalhe, created_at/updated_at), com `unique (pesagem_id, tipo_alerta)`, RLS habilitada, GRANT `SELECT` para `authenticated` e `ALL` para `service_role`; escrita apenas pelo servidor.

**Backend**
- `src/lib/whatsapp/meta.server.ts`: cliente do Graph API (`/{phone_number_id}/messages`, `type: "template"`), token lido de `process.env` dentro do handler.
- `src/lib/whatsapp/alerta-tolerancia.functions.ts`: `enviarAlertaToleranciaAcima` (`createServerFn` + `requireSupabaseAuth`) recebendo `pesagemId` e o sinal já calculado; revalida no servidor status fechado e chave `acima`, cria/localiza a ocorrência reutilizando a lógica de `ocorrencia-tolerancia.functions.ts`, resolve destinatário, insere o log (`status: pendente`) confiando no `unique` para antiduplicidade, envia o template e atualiza o log. Retorna `{ resultado: "enviado" | "sem_destinatario" | "falha", motivo? }` para as três mensagens de toast.
- `src/routes/api/public/whatsapp/meta-webhook.ts`: `GET` para o desafio `hub.verify_token` e `POST` validando a assinatura `x-hub-signature-256` (HMAC do corpo bruto, comparação timing-safe) e atualizando apenas `status`/`erro_detalhe` por `meta_message_id`. Ignora mensagens recebidas.
- Segredos novos: `META_WHATSAPP_TOKEN`, `META_WEBHOOK_VERIFY_TOKEN`, `META_APP_SECRET` (solicitados na implementação, guardados apenas no backend).
- `src/routes/pesagem.tsx`: nos mesmos pontos onde hoje chama `notificarToleranciaAcima` (fechamento de saída e edição com justificativa), chama também a nova função e exibe o toast conforme o retorno. Nenhuma alteração em `sinal-tolerancia.ts`.

**Permissões**: leitura dos logs conforme permissões de menu já existentes; configuração e teste de envio checando `has_role` admin/superadmin no servidor.
