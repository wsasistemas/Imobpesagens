# Pedido da Nota Fiscal Avulsa para toda a Contabilidade

Hoje o pedido da nota vai para um endereço fixo guardado nos parâmetros do módulo (apenas `marco.aurelio@calper.com.br`). A mudança é passar a enviar para **todos os usuários com perfil Contabilidade** cadastrados no sistema, sem precisar manter e-mail digitado à mão.

Situação verificada agora: o parâmetro tem só esse endereço, e existe 1 usuário com perfil Contabilidade cadastrado (wagner.antunes@calper.com.br).

## Como vai funcionar

- Ao registrar a saída do caminhão (Fase 2) ou reenviar o pedido, o sistema monta a lista de destinatários assim:
  1. e-mails de todos os usuários com perfil Contabilidade;
  2. mais os e-mails do parâmetro do módulo, que continua valendo como lista extra (hoje marco.aurelio@calper.com.br);
  3. tudo em minúsculas, sem repetição.
- Cada destinatário recebe o mesmo e-mail, com os dados da coleta, as fotos e o botão para emitir a nota no sistema.
- O histórico do processo registra a lista de quem recebeu, como já faz hoje.
- Se nenhum usuário com perfil Contabilidade estiver cadastrado e o parâmetro estiver vazio, o pedido fica registrado e aparece o aviso de que não há destinatário da Contabilidade — com o botão "Reenviar pedido à Contabilidade" disponível.
- Mesma regra aplicada nos dois pontos que hoje avisam a Contabilidade: o pedido automático da Fase 2 e a aprovação da conferência.

## Observação

Basta dar o perfil Contabilidade a um usuário para ele passar a receber os pedidos; não é preciso mexer em parâmetro. Se você quiser deixar de mandar para o endereço fixo, apago o valor do parâmetro depois da sua confirmação (a alteração é reversível).

## Detalhes técnicos

- Novo helper server-only `emailsContabilidade(admin)` em `src/lib/sucata/notificacoes.server.ts`: lê `user_roles` (role `contador`) e busca o e-mail em `profiles.email`, com queda para o e-mail de autenticação quando o perfil estiver sem e-mail; une com `sucata_parametros.contabilidade_emails`, normaliza (trim/minúsculas) e deduplica. Colunas explícitas, sem `select *`.
- `src/lib/sucata/coleta.functions.ts` (`enviarPedidoNfa`) e `src/lib/sucata/nfa.functions.ts` (aprovação da conferência) passam a usar o helper em vez de ler só o parâmetro.
- Nenhuma migração: nada muda no banco. Sem alteração de RLS — a leitura acontece no servidor com o cliente privilegiado já usado nessas funções.
- Mensagens de erro e o payload de auditoria (`destinatarios`) seguem o formato atual.

## Checklist de aceite

- [ ] Pedido da Fase 2 chega a todos os usuários com perfil Contabilidade
- [ ] E-mail do parâmetro continua recebendo, sem cópia duplicada
- [ ] Auditoria registra a lista completa de destinatários
- [ ] Sem destinatário, o processo segue com aviso e opção de reenvio
- [ ] Mesma regra na aprovação da conferência
