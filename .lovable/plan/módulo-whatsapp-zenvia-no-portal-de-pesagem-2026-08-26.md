# Módulo WhatsApp (Zenvia) no Portal de Pesagem

Levantamento do projeto de origem (superapp): o módulo WhatsApp lá é grande — cerca de 17 mil linhas de tela, 17 tabelas no banco e 14 funções de servidor. Ele também está amarrado ao domínio daquele projeto (fornecedores, empreendimentos, integração TOTVS/gateway externo). Portanto não é um "copiar e colar": é uma migração, e vou entregar em 3 fases para você validar cada uma antes de seguir.

Provedor: **Zenvia**. Contatos: **engenheiros e coordenadores das obras** já cadastrados aqui.

## Estrutura de menu

- Novo menu lateral **WhatsApp** (ícone de mensagem), logo abaixo de Configurações, respeitando o perfil do usuário (nova chave de permissão `whatsapp` na matriz de Permissões por Menu; liberado por padrão para SuperAdmin/Admin/Coordenador em leitura).
- Dentro dele, submenu **Disparo em Massa** com as páginas: Contatos, Nova Campanha, Templates, Formulários ONLINE, Formulário Público, Campanhas / Execução, Relatórios, Engine e Integrações.
- Nova aba **WhatsApp** dentro de **Configurações**, com as seções do painel original: Zenvia (conexão), IA & Automação, Notificações, Integrações, Templates, Usuários e Backup.

## Fase 1 — Base + Configurações + Central de conversas

- Banco: tabelas `whatsapp_config`, `whatsapp_automacao_config`, `whatsapp_templates`, `whatsapp_mensagens`, `whatsapp_numeros`, com permissões e RLS (leitura para perfis autorizados; escrita apenas Admin/SuperAdmin; Coordenador somente leitura, como já vale no resto do sistema).
- Segredo `ZENVIA_API_TOKEN` guardado no backend (não fica na tela).
- Aba **WhatsApp** em Configurações: conexão Zenvia (token, sender, webhook), teste de envio com validação do remetente, IA & Automação (respostas automáticas, horário de atendimento, modelo e prompt), Notificações e Backup das configurações.
- Menu **WhatsApp** com a **Central de conversas**: lista de contatos (engenheiros/coordenadores das obras, mais os números já usados), histórico da conversa, envio de texto e anexo, status de entrega.
- Recebimento: rota pública de webhook (`/api/public/whatsapp/webhook`) com verificação da assinatura da Zenvia, gravando as mensagens recebidas e disparando resposta automática quando configurado.

## Fase 2 — Templates e disparo em massa (núcleo)

- Banco: `bulk_contatos`, `bulk_segmentos`, `bulk_campanhas`, `bulk_disparos`, `bulk_opt_outs`, `bulk_feriados`, `bulk_alert_configs`, `bulk_engine_logs`, `bulk_api_health`.
- Telas: Contatos (importação CSV, segmentos, opt-out), Templates (sincronização com os templates aprovados na Zenvia, pré-visualização, variáveis), Nova Campanha (seleção de público, template, canal, agendamento) e Campanhas/Execução (fila, progresso, reenvio de falhas).
- Motor de envio no servidor: disparo em lote com limite de velocidade, janela de horário/feriados, retry e atualização de status por webhook da Zenvia.
- Relatórios: entregues, lidos, falhas, timeline e exportação.

## Fase 3 — Formulários online + Engine e Integrações

- Banco: `bulk_form_templates`, `bulk_form_links`, `bulk_form_campaigns`, respostas.
- Construtor de formulários, link público por token, página pública de resposta, painel de respostas e vínculo com campanha.
- Página **Engine** (saúde do motor, logs, tick manual) e **Integrações Bulk** (webhooks de saída, chaves de API, monitor de saúde).

## O que não será copiado

- O cliente de gateway externo do superapp (`src/lib/gateway.ts`), que aponta para o Supabase de outro projeto, e as integrações TOTVS/SOAP.
- Telas amarradas a fornecedores/empreendimentos daquele sistema — substituídas pelo cadastro de obras e usuários deste portal.
- Fluxos de OTP por WhatsApp e boletos/extratos (não fazem parte do escopo do portal de pesagem).

## Detalhes técnicos

1. As 14 funções Edge do superapp serão reescritas como server functions (`createServerFn`) e rotas de servidor deste projeto (padrão TanStack usado aqui): envio Zenvia, listagem de senders/templates, status de mensagem, dispatch em lote, engine tick, health check, webhooks públicos e extração de formulário.
2. O token da Zenvia é lido apenas no servidor (`process.env`), nunca no navegador; a tela mostra somente estado da conexão e remetente.
3. Novos componentes em `src/components/whatsapp/` (central, painel de configurações, templates, teste de envio) e `src/components/whatsapp-bulk/` (layout e páginas), adaptados ao design system Calper (vermelho #B3282D, cards metálicos, tabelas com filtro por coluna).
4. Rotas: `src/routes/whatsapp.index.tsx` e `src/routes/whatsapp.bulk.*.tsx`; a aba de Configurações entra em `src/routes/configuracoes.tsx`.
5. Permissão: chave `whatsapp` (e `whatsapp_bulk`) adicionada em `src/lib/permissoes-menu.ts`, na matriz do banco e no `app-sidebar.tsx`.
6. Toda entrada validada com `zod`; webhooks públicos validam assinatura antes de gravar.
