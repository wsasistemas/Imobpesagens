# Correção: portal preso em "Carregando portal..."

## O que está acontecendo (confirmado)

Depois do login, a tela inicial fica travada em "Carregando portal...".

Verificado nos registros da sessão e no banco:

- O sistema pergunta ao banco se o usuário tem o perfil **Administrativo de Obra**.
- Esse perfil **não existe no banco**. A lista atual de perfis é: admin, operador, coordenador, superadmin, contador.
- A pergunta é recusada (erro 400) e é repetida em looping — por isso o portal nunca termina de carregar.

Causa: na última implementação o perfil novo foi criado no código, mas a alteração no banco não foi aplicada (o banco estava em manutenção naquele momento).

## Correção

1. **Criar o perfil no banco** (alteração somente aditiva e idempotente):
   - adicionar `administrativo_obra` à lista de perfis;
   - cadastrar a descrição "Administrativo de Obra" (ordem 4);
   - liberar para esse perfil apenas o menu Sucata;
   - incluir o perfil na função de leitura dos processos de sucata.

2. **Tornar a tela inicial à prova de falha**: se qualquer consulta de perfil falhar, o portal deixa de girar para sempre — carrega com o que conseguiu e mostra a mensagem de acesso, em vez de ficar em looping. Sem novas tentativas infinitas.

3. **Atualizar os tipos gerados do banco** após a alteração.

4. **Validar ponta a ponta**: login real, tela inicial abrindo, menu Sucata visível para o novo perfil e nenhuma recusa 400 nos registros.

## Detalhes técnicos

- Migração: `ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'administrativo_obra'` (em migração isolada, pois o novo valor de enum só fica utilizável após commit), seguida por `INSERT ... ON CONFLICT DO NOTHING` em `perfil_descricoes` e `perfil_menu_permissoes`, e `CREATE OR REPLACE FUNCTION public.sucata_pode_ler()` incluindo o novo papel (search_path fixo, grants preservados para `authenticated`/`service_role`).
- `src/hooks/useAuth.ts`: cada `useQuery` de papel recebe `retry: false` e trata erro como `false`; `roleLoading` passa a considerar `isPending` apenas enquanto não houve resolução (sucesso ou erro), evitando trava permanente.
- `src/integrations/supabase/types.ts` regenerado via ferramenta (nunca digitado à mão).

## Checklist de aceite

- [ ] Perfil `administrativo_obra` existente no banco, com descrição e permissão apenas de Sucata
- [ ] `has_role` sem erros 400 nos registros
- [ ] Portal abre após login (sem "Carregando portal..." infinito)
- [ ] Falha de consulta de perfil não trava mais a tela inicial
- [ ] Tipos do banco regenerados; build e verificação de tipos sem erros

## Acesso do usuário wagner.antunes@calper.com.br

Confirmado no banco: essa conta já tem os perfis **superadmin**, **admin** e **contador**.

Regra reafirmada nesta correção: o SuperAdmin acessa todas as páginas e todos os dados, sem restrição por obra ou coligada. A correção não deve reduzir esse acesso — e, durante a validação, o portal precisa abrir com todos os menus liberados para essa conta.
