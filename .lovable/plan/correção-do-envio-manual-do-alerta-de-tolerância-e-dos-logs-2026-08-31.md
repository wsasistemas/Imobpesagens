# Correção do envio manual do alerta de tolerância e dos Logs

## O que os dados mostram (verificado)

Consultei os registros do alerta manual da placa **PPD6813** (NF da CONCREVIT, coligada 126):

- O reenvio manual **gerou 9 registros** com status **enviado** e ID de mensagem do provedor — ou seja, o disparo saiu (4 engenheiros marcados para todas as coligadas + 5 responsáveis da coligada 126), conforme a regra vigente.
- **Nenhum destinatário tem nome preenchido** no cadastro de perfis, então a coluna *Engenheiro* do grid de Logs aparece sempre como "—".
- As variáveis gravadas no log são apenas `[placa, data]`, mesmo quando o template envia também `empreendimento` e `fornecedor`. **O conteúdo da mensagem não é gravado em lugar nenhum** — por isso não é possível ver no Log o que foi disparado.
- A coluna *Template* grava o **nome** configurado ("Teste Calper"), não o template realmente usado no provedor (na Zenvia o envio usa o **ID** do template), o que torna o log ambíguo.
- Somente o webhook da Meta atualiza status; com provedor Zenvia o status **fica parado em "enviado"** e nunca evolui para entregue/lido.

Conclusão: o envio manual funciona no nível do provedor, mas o registro é cego (sem conteúdo, sem destinatário, sem template real) e não há confirmação de entrega — o que na prática parece "não enviou".

## Correções

1. **Gravar o conteúdo real da mensagem**
   - Passar a registrar, em cada linha de log, os **campos exatos enviados ao provedor** (nome da variável → valor) e o **texto final da mensagem** montado a partir do template.
   - Gravar o **template realmente utilizado** (ID + nome retornado pelo provedor) em vez do nome configurado localmente.

2. **Identificar o destinatário corretamente**
   - Quando o perfil não tem nome, o log passa a usar o **e-mail do usuário** (e, se houver, o cargo) como identificação, em vez de "—".

3. **Mostrar isso no grid de Logs de Alertas de Tolerância**
   - Nova coluna **Mensagem** com o texto enviado (truncado) e botão para abrir um diálogo **Detalhe do alerta**: destinatário, telefone, template/ID, variáveis enviadas (uma linha por variável), status, ID da mensagem, motivo do erro, usuário e hora do disparo, e marcação de **reenvio manual**.
   - Filtro extra por **tipo de disparo** (automático × reenvio manual).

4. **Reenvio manual mais claro e à prova de dúvida**
   - Antes de enviar, o sistema valida a configuração (provedor ativo, template resolvido, telefone válido) e, se algo bloquear, grava log **falhou** com o motivo em vez de sair silencioso.
   - O toast passa a informar o **resumo do disparo**: quantos enviados, quantos sem telefone, quantos falharam e o motivo do primeiro erro.
   - Ao final, os Logs são atualizados automaticamente para o registro já aparecer na aba.

5. **Confirmação de entrega**
   - Passar a tratar também os callbacks de status do provedor Zenvia, atualizando `entregue` / `lido` / `falhou` nos logs, como já ocorre com a Meta.

## Detalhes técnicos

- `whatsapp_alertas`: colunas aditivas `mensagem_texto text`, `campos_enviados jsonb`, `template_id text`, `template_nome_real text`, `reenvio_manual boolean default false`, `destinatario_email text` (migração aditiva, sem alterar as existentes; GRANTs mantidos).
- `src/lib/whatsapp/alerta-envio.server.ts`: `enviarAlertaTemplateAuto` passa a retornar `{ ok, erro, messageId, campos, templateId, templateNome, texto }` — `texto` montado a partir do corpo do template (Zenvia: `listarTemplates`; Meta: `resolverTemplatePorId`) com as variáveis substituídas.
- `src/lib/whatsapp/alerta-tolerancia.functions.ts`: gravar os novos campos no log (`campos_enviados`, `mensagem_texto`, `template_id`, `template_nome_real`, `reenvio_manual: forcar`); resolver `destinatario_nome`/`destinatario_email` via `supabaseAdmin.auth.admin` quando `profiles.nome` for nulo; retornar `{ enviados, semTelefone, falhas, motivo }` no `ResultadoAlerta`.
- `src/routes/pesagem.tsx`: `dispararAlertaTolerancia` exibe o resumo no toast e invalida `["whatsapp-alertas"]`.
- `src/components/whatsapp/logs-alertas-tolerancia.tsx`: coluna Mensagem, filtro de tipo de disparo e diálogo de detalhe (shadcn `Dialog`), padrão visual Calper.
- `src/routes/api/public/whatsapp.webhook.ts`: mapear eventos de status da Zenvia para `whatsapp_alertas` por `meta_message_id`.
- Regras de destinatário, template e variáveis do fluxo aprovado permanecem inalteradas.
