# Perfis dentro do cadastro do usuário

Hoje os perfis só podem ser trocados clicando nos botões da coluna "Perfis" da lista de acessos. A escolha passa para dentro do cadastro do usuário.

## O que muda

**1. Coluna "Perfis" da lista — apenas leitura**

- Mostra somente os perfis que o usuário realmente tem, como etiquetas (ex.: Coordenadores, Operadores).
- Sem perfil nenhum, aparece "Sem perfil".
- Os botões de conceder/remover saem dessa coluna.

**2. Dentro de "Editar usuário" — bloco novo "Perfis de acesso"**

- Uma lista com os cinco perfis (SuperAdmin, Administradores, Coordenadores, Operadores, Contabilidade), cada um com uma caixa de seleção e a descrição curta do perfil.
- Vem marcado o que o usuário já tem; o administrador marca e desmarca livremente e as mudanças só valem ao clicar em **Salvar**, junto com os outros dados do cadastro.
- Visível e editável apenas para Administrador e SuperAdmin (as demais pessoas não chegam a essa tela).
- Duas travas de segurança mantidas: ninguém remove o próprio perfil de Administrador/SuperAdmin (a caixa fica travada, com aviso), e um usuário sem nenhum perfil continua sem acesso ao sistema — se todas as caixas forem desmarcadas, aparece um aviso antes de salvar.
- Ao salvar, o resumo do que mudou aparece na confirmação (ex.: "Perfis: + Contabilidade, − Operadores").

**3. Ativar / Remover operador**

- Os botões da coluna "Status" continuam como estão, para a liberação rápida do dia a dia.

**4. Criação de usuário**

- Continua como hoje: a pessoa se cadastra na tela de login com e-mail @calper.com.br e o administrador libera e ajusta os perfis pela edição. Nenhuma tela de "Novo usuário" será criada.

## Detalhes técnicos

- `src/routes/configuracoes.tsx`: coluna "Perfis" passa a renderizar `Badge` por role presente (ordem de `PERFIS`); `EditarUsuarioDialog` recebe as roles atuais, mantém estado local `roles: AppRoleKey[]`, e no `salvar` aplica o diff chamando o server fn `definirRole` uma vez por role adicionada/removida (sequencial), antes de invalidar a lista.
- Descrições dos perfis vêm de `perfil_descricoes` (já consultada em `cadastro-perfis.tsx`) com fallback para o nome de `PERFIS`.
- `src/lib/admin.functions.ts`: nenhuma alteração — `definirRole` já exige admin/superadmin (`assertAdmin`) e já bloqueia a auto-remoção de admin/superadmin. A validação no cliente é só conveniência.
- Sem migração de banco. Nenhuma tela fora de Configurações > Acessos é alterada.

## Checklist de aceite

- Coluna "Perfis" mostra somente os perfis do usuário, sem botões de troca.
- "Editar usuário" tem o bloco "Perfis de acesso" com as cinco opções marcáveis.
- Salvar aplica as inclusões e exclusões de perfil junto com os demais dados.
- Auto-remoção de Administrador/SuperAdmin bloqueada com aviso.
- Aviso ao salvar um usuário sem nenhum perfil.
