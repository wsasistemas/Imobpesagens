# Solicitação manual da Nota Fiscal na Fase 2

## Objetivo

A pesagem de saída continuará calculando automaticamente o peso aferido, o valor por quilo e o valor total, mas **não enviará e-mail à Contabilidade**.

O envio ocorrerá somente depois que um usuário autorizado revisar os dados e clicar em **SOLICITAR NOTA FISCAL**.

## Fluxo visual proposto

```text
FASE 2 — SAÍDA DO CAMINHÃO

Saída: 15/09/2026 18:10       Placa: ABC1D23
Sucateiro: Razão social cadastrada
Descrição: Retirada de ferro misto

Banco: Banco cadastrado          Conta: ••••••-0
(somente leitura)

Tara                         Peso bruto
12.300 kg                    31.720 kg

Peso aferido                 Valor por quilo
19.420 kg                    R$ 0,32/kg

VALOR TOTAL A PAGAR
R$ 6.214,40

Foto 004 — Caçamba cheia
[ miniatura da evidência ]

Observação para a Contabilidade (opcional)
[____________________________________________]

[ SOLICITAR NOTA FISCAL ]
```

Ao clicar:

```text
CONFIRMAR SOLICITAÇÃO

Revise os dados acima antes de continuar.
Após a confirmação, a Contabilidade receberá o pedido
com os dados atuais deste processo.

[ VOLTAR E REVISAR ]  [ CONFIRMAR E ENVIAR ]
```

Após sucesso:

```text
Solicitação enviada à Contabilidade
15/09/2026 às 18:18 por Nome do usuário

[ REENVIAR SOLICITAÇÃO ]
```

## Alterações

1. **Separar cálculo e envio**
   - Ao salvar a saída, calcular e gravar peso aferido, valor por quilo e valor total.
   - Remover desse momento qualquer envio de e-mail, abertura automática da Fase 3 ou registro de `nfa_solicitada`.
   - Exibir uma confirmação de que a saída foi registrada e os valores estão prontos para revisão.

2. **Criar o quadro de revisão na Fase 2**
   - Mostrar sucateiro, placa, descrição da carga, tara, peso bruto, peso aferido, valor por quilo, valor total, banco, número da conta e foto da caçamba cheia.
   - Permitir corrigir os dados da saída e selecionar/corrigir o sucateiro antes da solicitação.
   - Manter **peso aferido, banco e número da conta somente para leitura** nesse quadro.
   - Quando sucateiro, tara ou peso bruto forem alterados, recalcular no servidor o peso aferido e os valores derivados; o usuário nunca digitará o peso aferido.
   - Banco e número da conta virão do cadastro do sucateiro. Qualquer correção bancária deverá ser feita no cadastro por um perfil que já possua essa permissão.
   - Manter a observação opcional destinada à Contabilidade.
   - Destacar o valor total sem permitir edição direta nesse quadro.

3. **Adicionar a ação manual**
   - Exibir o botão **SOLICITAR NOTA FISCAL** somente quando saída, foto, descrição, sucateiro, dados bancários e valores estiverem válidos.
   - Permitir a ação apenas para **Administrativo de Obra**, Administrador e SuperAdmin.
   - Confirmar novamente antes do envio e bloquear cliques repetidos enquanto a solicitação estiver em andamento.

4. **Enviar e registrar somente após confirmação**
   - O clique confirmado chamará a rotina protegida que envia o pedido à Contabilidade.
   - Registrar data, hora, usuário solicitante, destinatários, valores revisados, observação e resultado do envio no histórico.
   - Somente nesse momento preencher `nfa_solicitada_em`, concluir o marco “Pedido da nota enviado à Contabilidade” e liberar a Fase 3.
   - Se o e-mail falhar, informar claramente a falha e manter opção de reenvio, sem criar uma emissão de nota.

5. **Ajustar textos e caminhos relacionados**
   - Remover textos que afirmam que o pedido é automático após a saída.
   - Alterar ações antigas que misturam aprovação e solicitação para que nenhum outro botão envie o pedido sem a revisão da Fase 2.
   - Depois do primeiro envio, trocar a ação para **REENVIAR SOLICITAÇÃO**, com confirmação e novo registro no histórico.

6. **Criar o perfil “Administrativo de Obra”**
   - Adicionar o novo perfil à lista de perfis disponíveis na edição de cada usuário, sem criar uma nova tela de usuário.
   - Permitir que Administrador e SuperAdmin atribuam ou retirem esse perfil.
   - Configurar como padrão somente o menu **Sucata**; Pesagem, Dashboard, Configurações, relatórios, WhatsApp, integrações, documentação e treinamento permanecerão indisponíveis.
   - Dentro de Sucata, permitir consultar a lista e abrir os processos das coligadas/obras vinculadas ao usuário.
   - Permitir revisar a Fase 2 e solicitar/reenviar a Nota Fiscal.
   - Não liberar cadastros de sucateiros, exclusão, reabertura, emissão da NFA, ajuste administrativo de valores ou encerramento técnico apenas por possuir esse perfil.
   - Proteger também o acesso direto por endereço e todas as ações no servidor; a restrição não dependerá apenas de esconder itens do menu.
   - Incluir o novo perfil nas regras de acesso por coligada das tabelas `sucata_*`, mantendo o isolamento por obra e sem ampliar acesso a outros módulos.

## Regras de segurança e consistência

- A permissão será validada no servidor; esconder o botão não será usado como controle de acesso.
- O servidor consultará novamente os dados atuais antes do envio, evitando pedido baseado em valores antigos da tela.
- O peso aferido continuará sendo calculado pelo banco de dados e não aceitará edição direta no cliente ou no servidor.
- Banco e número da conta serão exibidos de forma mascarada quando adequado e não poderão ser alterados durante a revisão da Fase 2.
- Alterações feitas na revisão serão auditadas com valores anteriores, valores novos, usuário, data e hora antes da solicitação.
- O destinatário continuará sendo obtido dos usuários ativos com perfil Contabilidade.
- A criação do perfil usará uma migração aditiva e idempotente para ampliar o enum de perfis, cadastrar sua descrição e permissões padrão e ajustar as políticas necessárias.
- Não haverá alteração destrutiva nem nova tabela.
- O ajuste de valor por Administrador/SuperAdmin continuará com justificativa; se ocorrer antes da solicitação, o usuário revisará o novo total antes de enviar.

## Arquivos previstos

- `src/components/sucata/painel-sucata.tsx`
- `src/components/sucata/passos-sucata.tsx`
- `src/lib/sucata/coleta.functions.ts`
- `src/lib/sucata/fases-v2.ts`
- `src/routes/sucata.$id.conferencia.tsx` — somente para remover ação/texto antigo que possa enviar sem a revisão definida
- `src/lib/permissoes-menu.ts`
- `src/hooks/useAuth.ts`
- `src/routes/configuracoes.tsx`
- Funções protegidas do módulo Sucata que validam os perfis autorizados
- Uma migração aditiva para o perfil, descrição, permissão exclusiva do menu Sucata e políticas por coligada

## Validação

- Registrar uma saída e confirmar que nenhum e-mail é enviado automaticamente.
- Confirmar que pesos e valores aparecem no quadro de revisão.
- Editar os dados permitidos da saída e o sucateiro, confirmando recálculo do peso aferido e dos valores derivados.
- Confirmar que peso aferido, banco e número da conta não podem ser editados na revisão.
- Confirmar que dados bancários ausentes impedem a solicitação e orientam a correção no cadastro do sucateiro.
- Confirmar que Operador não vê nem consegue executar a solicitação.
- Confirmar que Coordenador, Administrador e SuperAdmin conseguem solicitar.
- Confirmar que Administrativo de Obra, Administrador e SuperAdmin conseguem solicitar; Coordenador e Operador não conseguem sem outro perfil autorizado.
- Atribuir “Administrativo de Obra” a um usuário de teste e confirmar que somente o menu Sucata aparece.
- Confirmar que esse usuário acessa apenas processos das próprias coligadas/obras, inclusive ao tentar abrir endereços diretamente.
- Confirmar que cadastros, emissão, exclusão, reabertura, ajuste administrativo e demais módulos continuam bloqueados.
- Confirmar que a Fase 3 permanece bloqueada antes do clique.
- Confirmar que o clique envia o pedido, registra o histórico e libera a Fase 3.
- Confirmar que duplo clique não duplica o envio.
- Confirmar o reenvio e seu novo registro de auditoria.

## Checklist de aceite

- [ ] Saída calcula valores sem enviar e-mail.
- [ ] Quadro de revisão mostra todos os dados necessários.
- [ ] Dados permitidos da saída e do sucateiro podem ser corrigidos antes da solicitação.
- [ ] Peso aferido, banco e número da conta permanecem somente leitura.
- [ ] Botão **SOLICITAR NOTA FISCAL** aparece somente para perfis autorizados.
- [ ] Perfil **Administrativo de Obra** pode ser atribuído na edição do usuário.
- [ ] Perfil **Administrativo de Obra** vê somente o menu Sucata e os processos autorizados por coligada/obra.
- [ ] Ações administrativas e demais módulos permanecem bloqueados para esse perfil.
- [ ] Confirmação final é obrigatória antes do envio.
- [ ] Fase 3 só abre após solicitação confirmada.
- [ ] Histórico identifica quem solicitou, quando, valores e resultado.
- [ ] Reenvio é explícito e auditado.
- [ ] Nenhum outro caminho envia automaticamente o pedido à Contabilidade.
