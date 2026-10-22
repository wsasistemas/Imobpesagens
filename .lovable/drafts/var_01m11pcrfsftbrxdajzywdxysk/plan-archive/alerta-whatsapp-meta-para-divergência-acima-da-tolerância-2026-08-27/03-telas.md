## Telas

**Configurações > WhatsApp > nova seção "Alertas de Tolerância"** (edição só Admin/SuperAdmin):
- Liga/desliga dos alertas.
- Status da conexão com a Meta (número verificado, nome exibido) com botão "Testar conexão".
- Nome/ID do template, idioma e número remetente (Phone Number ID).
- Botão "Enviar teste" para um número informado pelo próprio Admin/SuperAdmin.

**WhatsApp > nova aba "Logs de Alertas de Tolerância"** (leitura para perfis autorizados):
- Grid com data/hora, obra, coligada, placa, engenheiro, telefone, template e status colorido.
- Filtros por período, obra, placa e status, no mesmo padrão de cabeçalho com ordenação/filtro por coluna já usado nos outros grids.
- Sem reenvio automático; reenvio manual fica como ação futura auditada (não entra nesta entrega).

**Cadastro de usuários (Configurações)**: marcação "Engenheiro responsável" por coligada e telefone WhatsApp do usuário, com validação de formato.

**Ações > Ocorrências (histórico de pesagem)**: bloco "Alerta WhatsApp" mostrando destinatário, data/hora, status e motivo em caso de pendência/falha.

## Mensagens ao operador após o fechamento

| Situação | Mensagem |
| --- | --- |
| Enviado | Ocorrência registrada e alerta WhatsApp enviado ao engenheiro responsável. |
| Sem cadastro | Ocorrência registrada. Alerta não enviado: responsável/telefone não configurado. |
| Falha no envio | Ocorrência registrada. O envio do alerta falhou e está registrado para acompanhamento. |
