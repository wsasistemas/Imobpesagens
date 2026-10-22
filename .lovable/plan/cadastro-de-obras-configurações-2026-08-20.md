# Cadastro de Obras (Configurações)

Hoje o menu Configurações tem as abas Operadores, Notas fiscais, SEFAZ, Balança, Concreto, Tolerâncias e Manutenção — não existe nenhuma tela para cadastrar ou editar obras (as obras só aparecem no seletor do topo). A tabela de obras já guarda Nome, Coligada, CNPJ e situação (ativa/inativa), mas ainda não tem Endereço nem os dados do Engenheiro Responsável.

## O que será entregue

Nova aba **Obras** dentro de Configurações (visível apenas para o perfil Admin), com:

- Lista das obras cadastradas mostrando Nome/Razão social, CNPJ, Endereço, Engenheiro responsável e situação (Ativa/Inativa).
- Botão **Nova obra** abrindo formulário com os campos:
  - Nome / Razão social (obrigatório)
  - CNPJ (obrigatório, com máscara 00.000.000/0000-00 e validação de dígitos)
  - Endereço
  - Nome do Engenheiro Responsável
  - E-mail do Engenheiro (validação de formato)
  - Coligada (campo já existente na base, mantido no formulário)
- Ação **Editar** em cada obra, reaproveitando o mesmo formulário.
- Alternar **Ativa / Inativa** (a obra inativa deixa de aparecer no seletor de obras). Não haverá exclusão física, para não afetar o histórico de pesagens já vinculado à obra.
- Validações com mensagens claras e aviso de CNPJ já cadastrado.
- Após salvar, o seletor de obras do topo é atualizado automaticamente.

## Detalhes técnicos

1. **Migração no banco** — adicionar em `public.obras`: `endereco text`, `engenheiro_nome text`, `engenheiro_email text` (todos opcionais, para não quebrar as obras existentes). As políticas atuais já permitem que o Admin gerencie obras e que usuários autenticados vejam as ativas, portanto nenhuma mudança de permissão é necessária.
2. **Novo componente** `src/components/cadastro-obras.tsx` com a listagem, o dialog de formulário e as mutations (insert/update via cliente do navegador, sob RLS de admin), invalidando a query `["obras"]`.
3. **`src/routes/configuracoes.tsx`** — adicionar `TabsTrigger`/`TabsContent` "Obras" como primeira aba e renderizar o novo componente.
4. **Validação** com `zod` (nome, CNPJ, e-mail) antes de gravar.
