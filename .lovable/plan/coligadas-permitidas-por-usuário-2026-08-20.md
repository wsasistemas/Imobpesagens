# Coligadas permitidas por usuário

Hoje o cadastro de usuários (aba Operadores) tem nome, e-mail, celular, ativo e perfis — não existe nenhum vínculo com coligada, e qualquer usuário ativo enxerga todas as obras ativas. As obras já têm o campo **Coligada** preenchido com o código (01, 124, 125, 126, 127, 128), e o nome é o próprio nome da obra.

## O que será entregue

1. **Campo "Coligadas permitidas" no cadastro de usuário** (no mesmo dialog de Editar usuário e na criação): lista com todas as coligadas existentes no cadastro de Obras, mostradas como **código – nome da obra** (ex.: `124 – CONDOMINIO ARTE JARDIM`), com seleção múltipla por checkbox e um atalho "Selecionar todas".
2. **Coluna "Coligadas"** na tabela de Operadores, mostrando os códigos vinculados (ou "Todas" para Admin/SuperAdmin).
3. **Filtro global por coligada**: o seletor de obra do topo e todas as visões (Pesagem/histórico, Dashboard, Conferências, Fechamento Mensal, Ocorrências, notas fiscais) passam a mostrar apenas registros das obras cujas coligadas o usuário pode acessar.
4. **Administradores e SuperAdmin enxergam todas as coligadas**, independentemente do vínculo. Coordenadores e Operadores ficam restritos ao que foi marcado.
5. Usuário sem nenhuma coligada marcada (e sem perfil admin) vê uma mensagem clara de "Nenhuma coligada liberada — solicite acesso ao administrador" em vez de telas vazias.

## Detalhes técnicos

**Banco de dados (migração)**

- Nova tabela `public.usuario_coligadas` com `user_id` (referência ao usuário), `codcoligada text`, `nome text` (rótulo capturado da obra no momento do vínculo, para exibição), `created_at`, e chave única (`user_id`, `codcoligada`).
- GRANTs: `SELECT` para `authenticated`, `ALL` para `service_role`; RLS ativa com política de leitura do próprio vínculo e gestão apenas por admin/superadmin (as escritas passam pelo servidor com privilégio).
- Função `public.coligadas_do_usuario(_user_id uuid)` retornando os códigos permitidos, e `public.pode_ver_coligada(_cod text)` que devolve verdadeiro quando o usuário é admin/superadmin ou possui o vínculo.
- Ajustar as políticas de leitura para respeitar a coligada:
  - `obras`: SELECT das obras ativas apenas quando `pode_ver_coligada(coligada)`.
  - `pesagens`, `evidencias`, `notas_fiscais`: SELECT condicionado à coligada da obra do registro (via subconsulta em `obras`).
- `dashboard_recebimento` recebe validação extra: rejeita `_obra_id` de coligada não permitida.

**Servidor**

- `src/lib/admin.functions.ts`: `listarUsuarios` passa a retornar `coligadas: { codcoligada: string; nome: string }[]`; novo `definirColigadasUsuario({ userId, coligadas })` (admin/superadmin) que substitui os vínculos do usuário; `criarUsuario` aceita coligadas iniciais.
- Nova função de leitura `listarColigadas()` que agrega `codcoligada` + nome a partir de `public.obras` (distinct por coligada, ordenado por código) para alimentar os seletores.

**Frontend**

- `src/hooks/useAuth.ts`: expor `coligadasPermitidas: string[]` e `verTodasColigadas` (admin/superadmin), carregados por query com o mesmo padrão de cache dos papéis.
- `src/lib/pesagem-queries.ts`: `obrasQueryOptions` filtra as obras pelas coligadas permitidas (a RLS já garante, o filtro no cliente evita flicker); `pesagensQueryOptions` continua por obra, agora sempre dentro do conjunto permitido.
- `src/components/app-shell.tsx`: seletor de obra só lista obras permitidas; estado "sem coligada liberada" com aviso.
- `src/routes/configuracoes.tsx`: nova coluna Coligadas e o bloco de seleção múltipla no dialog de Editar/Criar usuário, salvando via `definirColigadasUsuario` e invalidando `["admin-usuarios"]`.
- Dashboards e relatórios (`dashboard.tsx`, `dashboard-conferencia*.tsx`, `dashboard-fechamento-mensal.tsx`, `relatorios.ocorrencias.tsx`) passam a usar somente a lista de obras permitidas nos seus seletores e agregações.
