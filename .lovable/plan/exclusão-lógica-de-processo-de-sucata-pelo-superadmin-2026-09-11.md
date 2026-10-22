# Exclusão lógica de processo de sucata pelo SuperAdmin

## Objetivo
Adicionar na lista de processos um botão **Excluir** visível somente ao perfil **SuperAdmin**.

A ação não apagará fisicamente o processo, fotos, documentos ou eventos. Ela fará exclusão lógica, conforme as regras obrigatórias do módulo, preservando todo o histórico para auditoria.

## Comportamento da tela
- Nova coluna de ações na listagem de processos.
- Botão com ícone de lixeira disponível apenas para SuperAdmin.
- Ao clicar, abrir confirmação mostrando o número do processo e avisando que ele sairá das listagens operacionais.
- Exigir um motivo antes de confirmar.
- Após confirmar, remover imediatamente o registro da lista e mostrar mensagem de sucesso.
- Usuários de outros perfis não verão o botão e não poderão executar a ação diretamente.

## Regras de segurança e dados
- Criar migração aditiva com os campos `excluido_em`, `excluido_por` e `exclusao_motivo` em `sucata_processos`.
- Não alterar nem remover registros relacionados.
- Executar a ação em função autenticada, validando novamente no servidor que o usuário possui o papel `superadmin`.
- Registrar um evento `processo_excluido` em `sucata_eventos`, com processo, usuário, data e motivo.
- Adicionar proteção de leitura para que processos excluídos fiquem disponíveis somente ao SuperAdmin, inclusive por acesso direto ao endereço do processo.
- Filtrar processos excluídos das consultas operacionais e contagens.

## Arquivos previstos
- Nova migração aditiva em `supabase/migrations/`.
- `src/lib/sucata/sucata-queries.ts` — filtro das listagens e campos necessários.
- Novo arquivo de função autenticada em `src/lib/sucata/` — exclusão lógica e auditoria.
- `src/components/sucata/lista-processos.tsx` — coluna, botão e confirmação.
- `src/integrations/supabase/types.ts` — somente regeneração dos tipos após a migração.

## Validação
- SuperAdmin vê e usa o botão com motivo obrigatório.
- Admin, Coordenador, Operador e Contador não veem o botão.
- Chamada direta por perfil não autorizado é recusada no servidor.
- O processo excluído desaparece das listagens comuns.
- Fotos, documentos e histórico permanecem preservados.
- O evento de auditoria é criado.
- Listagem, paginação e abertura dos processos não excluídos continuam funcionando.
