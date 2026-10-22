# Engenheiro responsável por TODAS as coligadas (Admin / SuperAdmin)

Hoje, no bloco **Engenheiro responsável** do cadastro de usuários, só é possível escolher **uma** coligada, e cada coligada aceita **um único** responsável. A ideia é liberar, apenas para os perfis **Administrador** e **SuperAdmin**, a marcação "responsável por todas as coligadas", somando-se (sem substituir) aos engenheiros já marcados por coligada.

## Comportamento

- No bloco **Engenheiro responsável** (telas **Editar usuário** e **Novo usuário**), quando o usuário tiver perfil Administrador ou SuperAdmin aparece uma chave:
  **"Engenheiro responsável por todas as coligadas"** — com a explicação de que passará a receber os alertas de tolerância de qualquer obra/coligada.
- Com a chave ligada, o seletor de coligada específica fica desabilitado (com aviso "abrange todas as coligadas") — a abrangência total já cobre qualquer coligada.
- Para perfis Operador e Coordenador, a chave não aparece: continua só o seletor de uma coligada, como hoje.
- **Convivência:** o alerta de tolerância passa a ser enviado ao engenheiro responsável da coligada da obra **e também** a todos os admins marcados como "todas as coligadas". Números repetidos são deduplicados (um envio por telefone).
- O WhatsApp (E.164) continua obrigatório para quem recebe alertas; se o admin marcado como "todas" não tiver número válido, o log registra o motivo e os demais destinatários seguem recebendo normalmente.
- Na lista de usuários, o selo de engenheiro passa a exibir **"Todas as coligadas"** quando for o caso.
- O log de alertas (Configurações > WhatsApp > Alertas de tolerância) passa a mostrar **uma linha por destinatário** do mesmo registro de pesagem.

## Fluxo oficial dos Alertas de Tolerância (seguido à risca)

O fluxo anexado é a regra do processo. A implementação mantém as etapas exatamente como descritas, alterando somente a identificação do destinatário para contemplar o responsável por todas as coligadas:

1. **Pesagem realizada** — registro gravado com placa, data/hora, material, coligada (obra) e fornecedor. (já existente)
2. **Apuração do desvio** — comparação do desvio apurado com o percentual de tolerância parametrizado para o material (carta de traço ou tabela padrão). (já existente)
3. **Decisão automática** — "o desvio está acima da tolerância permitida?", sem depender de ação do operador.
4. **NÃO → Status "OK"**: fluxo normal de fechamento, **nenhuma notificação é enviada**, fim do fluxo.
   **SIM → Status "Acima da Tolerância"**: o fluxo de notificação é acionado automaticamente.
5. **Registro de ocorrência / evidência** — ocorrência criada automaticamente vinculada à pesagem, com as evidências disponíveis (carta traço, nota fiscal, tíquete). (já existente)
6. **Leitura dos dados do registro** — as variáveis da mensagem saem do próprio registro: `empreendimento`, `placa do veículo`, `data da ocorrência`, `fornecedor`. Nada é digitado no disparo automático.
7. **Identificação do destinatário** — pela coligada do lançamento, o sistema localiza o **engenheiro responsável da coligada** e seu WhatsApp cadastrado; **além dele**, entram os Administradores/SuperAdmins marcados como responsáveis por **todas as coligadas**. Lista deduplicada por telefone; quem não tiver WhatsApp válido fica registrado como pendente no log, sem bloquear os demais.
8. **Montagem e envio** — texto montado a partir do **template oficial homologado na META** e enviado pela WhatsApp Business Platform; canal **exclusivo de envio** (não recebe respostas nem permite conversa). O webhook segue servindo apenas para status de entrega.
9. **Registro do log de envio** — data/hora do disparo, destinatário e status de entrega gravados e visíveis no próprio registro de pesagem (uma linha por destinatário), para rastreabilidade e auditoria.
10. **Parecer do engenheiro** — a análise e o registro do parecer seguem sendo feitos **no Portal**, na ocorrência da pesagem (fora do canal WhatsApp), como já ocorre hoje.

Nenhuma regra de tolerância, status ou criação de ocorrência é alterada por este plano — a mudança se restringe à identificação e ao registro dos destinatários.

## Detalhes técnicos

1. **Migração**
   - `profiles`: nova coluna `engenheiro_todas_coligadas boolean not null default false` (marcação global, independente dos vínculos de coligada, que continuam servindo para visibilidade de registros).
   - Remover o índice único `usuario_coligadas_eng_resp_unico` e recriá-lo como índice **não único** (`codcoligada` where `engenheiro_responsavel`), já que agora podem existir múltiplos destinatários para a mesma coligada.
   - Substituir o índice único `whatsapp_alertas_unico (pesagem_id, tipo_alerta)` por `(pesagem_id, tipo_alerta, destinatario_user_id)`, permitindo um log por destinatário e mantendo a proteção contra disparo duplicado para o mesmo destinatário.

2. **`src/lib/admin.functions.ts`**
   - `listarUsuarios`: incluir `engenheiro_todas_coligadas` (join em `profiles`) no retorno (`engenheiroTodas: boolean`).
   - `definirColigadasUsuario`: aceitar `engenheiroTodas?: boolean`; validar no servidor que só é gravado quando o usuário-alvo tem `admin` ou `superadmin` em `user_roles`; gravar em `profiles`. Remover o `update` que desmarcava outros responsáveis da coligada (agora podem coexistir).

3. **`src/lib/whatsapp/alerta-tolerancia.functions.ts`**
   - Trocar a resolução de destinatário único por uma lista: engenheiro da coligada + perfis com `engenheiro_todas_coligadas = true`, deduplicando por `user_id` e por telefone normalizado.
   - Inserir um log em `whatsapp_alertas` por destinatário e enviar o template a cada um; o retorno agrega o resultado (`enviado` se pelo menos um saiu; `sem_destinatario` se nenhum tiver telefone; `falha` caso todos falhem) mantendo as mensagens de toast atuais.

4. **`src/routes/configuracoes.tsx`**
   - No `EditarUsuarioDialog` e no diálogo de criação: novo estado `engenheiroTodas`, a chave condicionada a `roles` admin/superadmin, o seletor desabilitado quando ligada, e envio do campo em `definirColigadasUsuario`. Ajuste do selo na listagem.
