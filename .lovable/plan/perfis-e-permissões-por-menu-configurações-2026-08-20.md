# Perfis e Permissões por Menu (Configurações)

Hoje o sistema só tem dois perfis reais: **Admin** e **Operador**, e os menus são liberados por regra fixa no código (Pesagem para admin/operador; Dashboard e Configurações só admin). Não existe nenhuma tela de perfis nem de permissões.

## O que será entregue

Duas novas abas dentro de Configurações, ao lado de Operadores (visíveis só para Admin/SuperAdmin):

### 1. Aba "Perfis"
Lista dos 4 perfis do sistema, com descrição e quantidade de usuários vinculados:
- **SuperAdmin** — acesso total, único que pode alterar permissões e excluir registros
- **Administradores** — gestão completa da operação e configurações
- **Coordenadores** — visão gerencial (dashboards e relatórios), sem configurações
- **Operadores** — apenas a rotina de pesagem

Os 4 perfis são fixos (não haverá criação de perfis novos), mas a descrição pode ser editada. Em cada perfil, um botão mostra os usuários que possuem aquele perfil.

### 2. Aba "Permissões por Menu"
Matriz de marcação: linhas = menus do sistema, colunas = os 4 perfis.

Menus controlados: Pesagem, Dashboard, Relatórios > Ocorrências, Configurações, Conectar assistente, Manual do Sistema, Centro de Treinamento.

- Marcar/desmarcar libera ou bloqueia o menu para o perfil.
- A coluna SuperAdmin fica sempre marcada e travada (evita se trancar fora).
- Botão **Restaurar padrão** volta à configuração recomendada.
- Ao salvar, o menu lateral passa a respeitar as marcações imediatamente (o usuário vê apenas os menus liberados para seus perfis).

### Vínculo com Operadores
Na aba Operadores, o seletor de perfil passa a oferecer os 4 perfis (hoje só Admin e Operador), mantendo a regra de que ninguém remove o próprio Admin/SuperAdmin.

## Detalhes técnicos

1. **Migração**: `ALTER TYPE public.app_role ADD VALUE 'coordenador'` e `'superadmin'`; nova tabela `public.perfil_menu_permissoes` (`role app_role`, `menu_key text`, `permitido boolean`, unique(role, menu_key)) + `GRANT SELECT` para `authenticated`, `GRANT ALL` para `service_role`, RLS: leitura para autenticados, escrita apenas via `has_role(auth.uid(),'admin')`/`'superadmin'`; INSERTs com o padrão dos 7 menus x 4 perfis. Tabela opcional `perfil_descricoes` para os textos dos perfis.
2. **`src/lib/admin.functions.ts`**: ampliar o enum de `definirRole` para os 4 papéis e adicionar `listarPermissoesMenu` / `salvarPermissoesMenu` (server fns com `requireSupabaseAuth` + checagem de admin/superadmin).
3. **`src/hooks/useAuth.ts`**: expor `isCoordenador`, `isSuperAdmin` e um mapa `menusPermitidos` (query da nova tabela pelos papéis do usuário), mantendo `isAdmin`/`isOperador`.
4. **`src/components/app-sidebar.tsx`**: trocar as funções `show` fixas por consulta ao mapa de permissões, com fallback para as regras atuais caso a query ainda esteja carregando.
5. **Novos componentes** `src/components/cadastro-perfis.tsx` e `src/components/permissoes-menu.tsx`, adicionados como `TabsTrigger`/`TabsContent` em `src/routes/configuracoes.tsx` logo após Operadores.
