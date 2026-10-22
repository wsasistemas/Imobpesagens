# Plano — Portal de Pesagem no Supabase ImobSystem (schema `imobpesagens`)

Pedido do Wagner (22/10/2026): ligar o projeto ao Supabase `ikvjaowvpvxojvcfwnct`, num schema novo `imobpesagens`,
**sem dados históricos** (tabelas vazias) e depois com **dados fictícios para demonstração**.

> Nome do schema em minúsculas (`imobpesagens`): no Postgres, `Imobpesagens` com maiúscula obrigaria aspas em todo SQL.

## Situação hoje

- Banco: Supabase do Lovable Cloud `nhlnocvoamfrubgzfuea`, tudo no `public`.
- `supabase/migrations/`: 86 arquivos. **Não reproduzem do zero**:
  - as duas de 2024 rodam antes da base e quebram;
  - há duplicadas;
  - 2 migrations reais estão fora da pasta, em `drizzle/migrations/` (`administrativo_obra` e `sucata_pode_ler`).
- Estado final (inventário de 22/10/2026):
  - 42 tabelas e 5 enums;
  - 23 funções, todas com `search_path = public` e `public.` escrito no código;
  - cerca de 30 triggers;
  - RLS em todas as tabelas;
  - 4 buckets criados à mão, fora das migrations;
  - sem cron, sem Edge Functions e sem Vault.
- Código:
  - ~295 `.from()`, 23 `.rpc()` e ~24 `.storage.from()`, sem `.schema()`;
  - 4 clientes Supabase, 3 deles gerados pelo Lovable;
  - toda a lógica de servidor está em server functions do TanStack.

## O que muda por ser um Supabase compartilhado (riscos)

| Risco | Origem | Tratamento no plano |
|---|---|---|
| Gatilho `on_auth_user_created_profile` em `auth.users` | `20260721142759` | **Não criar.** Dispararia (e poderia travar) o cadastro de todos os sistemas Imob. O perfil é criado pelo admin do app (upsert). |
| `DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users` | `20260723191512` | Não executar. O nome é genérico e pode ser o de outro sistema. |
| Backfill de `profiles` a partir de **todo** o `auth.users` | `20260723191512` | Não executar. |
| Bucket `evidencias` com nome genérico; policies de `storage.objects` valem para todos os buckets | buckets manuais | Buckets `imobpesagens-evidencias`, `imobpesagens-sucata-documentos`, `-sucata-evidencias`, `-sucata-relatorios`. Policies com nome prefixado e `bucket_id = ...` antes de qualquer cast. |
| Admin bane, reseta senha e troca e-mail no `auth` compartilhado | `src/lib/admin.functions.ts` | Bloquear/excluir passa a valer **só no app** (inativar o vínculo). Senha e e-mail mudam o login em todos os sistemas: ver decisão D3. |
| `listUsers({ perPage: 200 })` filtrando `@calper.com.br` | `admin.functions.ts` | Listar só os usuários com vínculo no `imobpesagens`. |
| Policies `USING (true)` (tolerâncias, fornecedores) | migrations | Trocar por "tem papel no app": senão qualquer usuário logado de outro sistema lê. |
| Nomes comuns (`has_role`, `app_role`, `profiles`, `set_updated_at`) | Lovable | Ficam isolados no schema. Funções com `search_path = ''` e nomes totalmente qualificados. |
| `anon` com acesso | padrão Lovable | Nenhum grant para `anon` no schema novo. |

## Dependências do Lovable que deixam de funcionar fora dele

| Dependência | Onde | Substituição proposta |
|---|---|---|
| `ai.gateway.lovable.dev` (OCR da NF, leitura de placa, ocorrência, NFA) | `ocr-nota`, `ocorrencia`, `sucata/ler-placa`, `sucata/nfa` | Por ora continua no gateway (D4); depois, Gemini direto |
| `connector-gateway.lovable.dev/resend` | `email/resend.server`, `sucata/notificacoes.server`, `sucata/relatorio.server` | `api.resend.com` direto, `RESEND_API_KEY`, domínio `imobsystems.com.br` (o mesmo do Imobenviomassa) |
| Hook de e-mail de auth (`routes/lovable/email/*`) | Lovable | Sai. Os e-mails de auth passam a usar o SMTP e os templates do ikvj. |
| MCP + OAuth (`@lovable.dev/mcp-js`, "Conectar assistente") | `vite.config.ts`, `lib/mcp`, rotas `.mcp` | D5 |
| `client.ts`/`types.ts` gerados pelo Lovable | `integrations/supabase` | O schema vem de um ponto único, `src/integrations/db-schema.ts` (`VITE_DB_SCHEMA`), igual ao angloamericano |

## Decisões do Wagner (22/10/2026) — plano aprovado

| # | Ponto | Decisão |
|---|---|---|
| D1 | Onde roda | **Vercel**, já conectada (`imobpesagens-hkwyvwkcp-wsasistemas.vercel.app`, time wsasistemas). Build com `NITRO_PRESET=vercel`. |
| D2 | Usuários | **Login único do ImobSystem**: o admin cadastra e reaproveita o login que a pessoa já tem em outro sistema Imob ("diferencial quando a empresa comprar 2 ou mais aplicações"). Sem gatilho em `auth.users`; sem auto-cadastro na tela de login. |
| D3 | Senha | O próprio usuário troca em Meu perfil; "Esqueci a senha" na tela de login; **admin e superadmin** podem redefinir a senha dentro do sistema. Bloquear vira "inativar no Portal de Pesagem" (não bane o login dos outros sistemas). Troca de e-mail de outro usuário: só superadmin. |
| D4 | IA | **Por enquanto mantém** o gateway do Lovable (`LOVABLE_API_KEY`). Fora do Lovable o OCR/placa fica indisponível até trocar o provedor. |
| D5 | "Conectar assistente" (MCP) | Desligado nesta etapa (menu oculto). |
| D6 | Dados fictícios | Todos os módulos. |
| D7 | Configuração inicial | Mantida. **Todo e-mail `@calper.com.br` sai**; demonstração usa `wsasistemas.ia@gmail.com`. |
| — | Marca | Tirar a palavra "Calper" de todo o sistema e usar a logo da WSA Sistemas. |

## Fases (checklist feito / não feito)

### Fase 1 — Inventário do ikvj (só leitura)
- [x] SQL de inventário para o SQL Editor:
  - schemas existentes e se `imobpesagens` já existe;
  - buckets com prefixo `imobpesagens-`;
  - `pgrst.db_schemas` do `authenticator`;
  - gatilhos em `auth.users`;
  - funções `acessos.*`;
  - segredos já gravados (só os nomes).
- [x] Wagner roda e devolve o resultado (o CSV não vai para o git)

### Fase 2 — Estrutura (migration única, aditiva)
- [x] `supabase/imobsystem/migrations/2026102xxxxx_imobpesagens_01_estrutura.sql`, gerada por script a partir do estado final das 86 migrations + `drizzle/migrations`:
  - `create schema imobpesagens`;
  - 42 tabelas com as colunas GENERATED;
  - enums criados já com todos os valores (inclusive `administrativo_obra`, `rascunho_entrada` e `rascunho_saida`);
  - 23 funções com `search_path = ''`;
  - triggers de negócio da sucata e de `updated_at`;
  - RLS e policies (sem `USING (true)` aberto).
- [x] Grants:
  - `usage` + DML para `authenticated` como na origem;
  - `all` para `service_role`;
  - nada para `anon`;
  - `default privileges` para tabelas futuras.
- [x] Os 4 buckets privados com prefixo + policies de `storage.objects` com nome prefixado
- [x] Expor o schema: acrescentar `imobpesagens` à lista do painel/`pgrst.db_schemas` **sem tirar os outros**, mais `notify pgrst, 'reload config'`
- [x] Nada em `public` e nada em `auth.users`
- [x] Ensaio no container `supabase/postgres` local (PGlite trocado pelo Docker), rodado duas vezes (trava contra reaplicação)
- [x] Teste de RLS em transação desfeita: matriz por papel (admin, coordenador, operador, contador, administrativo_obra, sem papel, usuário de outro sistema)
- [x] Scripts numerados para o SQL Editor: `1_aplicar_estrutura.sql`, `2_testar_estrutura.sql` (rollback)

### Fase 3 — Configuração inicial
- [x] `3_configuracao_inicial.sql` com as seeds de D7 (upsert, roda de novo sem duplicar)
- [x] `4_super_admin.sql`: vínculo do `wsasistemas.ia@gmail.com` como superadmin (o login já existe no ikvj)

### Fase 4 — Código
- [ ] `src/integrations/db-schema.ts` (`VITE_DB_SCHEMA`) e `db: { schema }` nos 4 clientes; `.env` apontando para o ikvj (só chaves públicas); `SUPABASE_SERVICE_ROLE_KEY` só no `.env.local` e na Vercel
- [ ] `types.ts` regenerado do schema novo
- [x] Nomes de bucket centralizados numa constante (`imobpesagens-*`)
- [x] `admin.functions.ts`:
  - listar pelo vínculo do app;
  - criar reaproveitando o login;
  - inativar em vez de banir;
  - senha e e-mail conforme D3.
- [x] Login sem a aba "Cadastrar" (D2); redirect URLs do ikvj com o domínio novo
- [x] Resend direto (3 pontos); IA continua no gateway do Lovable (D4)
- [x] Remover o hook de e-mail do Lovable; MCP conforme D5
- [x] `tsc` + build sem erro

### Fase 5 — Dados fictícios
- [x] `5_dados_demonstracao.sql`, idempotente, com ids fixos e marcados como demonstração, para poder apagar depois com `6_limpar_demonstracao.sql`
- [x] Usuários de demonstração (D6), arquivos de exemplo nos buckets e conferência das contagens no fim do script

### Fase 6 — Publicação e conferência
- [ ] Vercel (D1): `NITRO_PRESET=vercel`, variáveis de ambiente (Supabase do ikvj, service role, Resend) e redirect URLs no Auth do ikvj
- [ ] Conferência no navegador, com os 4 usuários de demonstração: login, Página Inicial, Pesagem (entrada/saída), Dashboard, Sucata (processo até o portal do sucateiro), Configurações, tema escuro
- [ ] Webhooks (Zenvia/Meta) e reenvio da sucata ficam desligados até haver credenciais

## Fora do escopo
- Copiar dados do Lovable (pedido: sem histórico).
- Apagar o projeto do Lovable Cloud ou mexer no `public` do ikvj.
- Cron da sucata (reenvio/varredura): não existe hoje; fica para depois.

## Andamento (22/10/2026)

- Aplicado no ikvj pelo Wagner: 1 (estrutura), 2 (API), 3 (configuração), 4 (teste 21/21), 5 (Super Admin).
- Gerados e testados no banco local, **a rodar no ikvj**: `8_usuario_ativo_no_app.sql` (ativo só no app), `9_redefinir_senha.sql` ("Esqueceu a senha?"), `6_dados_demonstracao.sql` (3 obras, 120 pesagens, 120 NF, 13 alertas e 6 mensagens de WhatsApp, 3 sucateiros, 8 processos de sucata em fases F01–F15), `7_limpar_demonstracao.sql`.
- Usuários de demonstração por perfil: não criados por SQL (o login é compartilhado). Criar pela tela Configurações › Operadores › "Novo usuário" depois da publicação.
- SQL Editor do Supabase executa os comandos separados e bloqueia DELETE em storage: os scripts 4, 4b, 6 e 7 são um bloco `do` único.
- Código (sem commit): schema por `src/integrations/db-schema.ts`; buckets `imobpesagens-*`; usuários (lista só do app, "Novo usuário" com login único, inativar só no app, e-mail só Super Admin); "Esqueceu a senha?" com token próprio + `/redefinir-senha`; Resend direto; "Conectar assistente" fora do menu.
- Falta: commit/push (autorização do Wagner), variáveis na Vercel, conferência no navegador.
