# Vínculo opcional de densidade por fornecedor dentro do cadastro

Hoje a exceção por fornecedor só é criada pelo botão "Exceções" da linha da tabela. O pedido é
permitir fazer esse vínculo direto no formulário de **Novo material** e **Editar material**, de
forma **opcional** (pode ficar em branco).

## O que muda na tela

### 1. Novo bloco no diálogo do material
Abaixo de "Ordem / Ativo", um bloco intitulado **Densidade específica por fornecedor (opcional)**
com dois campos lado a lado:

- **Fornecedor** — campo com sugestões dos fornecedores já cadastrados no sistema, permitindo
  também digitar um nome livre (ex.: D'ANGELOS AREAL).
- **Densidade do fornecedor** — valor numérico, com o mesmo sufixo da unidade base do material
  (kg/m³, kg/L ou kg por saco).

Regras:
- Os dois campos em branco: nada acontece, o material é salvo normalmente (comportamento atual).
- Os dois preenchidos: ao salvar o material, a exceção é criada/atualizada junto.
- Apenas um preenchido: aviso "preencha fornecedor e densidade, ou deixe ambos em branco" e o
  salvamento não ocorre.

### 2. Na edição
Quando o material já tem exceções, o bloco lista as existentes (fornecedor + densidade) com
opção de editar o valor ou remover, e os campos acima ficam vazios para adicionar mais uma.
Quando existe exatamente uma exceção, ela vem carregada nos campos para edição direta.

### 3. Tabela
A coluna "Exceções" continua igual (botão com a contagem), e passa a refletir imediatamente o que
foi criado pelo formulário. O diálogo "Exceções" existente permanece disponível.

## O que NÃO muda
- Precedência de cálculo: carta de traço > exceção do fornecedor > densidade padrão do material >
  tabela interna.
- Banco de dados: nenhuma alteração de estrutura — o vínculo continua gravado em
  `densidades_fornecedor`.
- Registros de pesagem já gravados não são recalculados automaticamente.

## Detalhes técnicos
- `src/components/cadastro-densidades.tsx`: novo estado `fornecedorVinculo` / `densVinculo` no
  diálogo de material; em `abrirNovo` limpa, em `abrirEdicao` pré-carrega a exceção única do
  material. Em `salvar()`, após `salvarMaterial.mutateAsync`, chamar `salvarExcecao.mutateAsync`
  com o `densidade_material_id` retornado.
- `src/lib/densidades.ts`: `salvarMaterial` passa a retornar o `id` do registro (`.select("id").single()`
  no insert) para permitir vincular a exceção logo após criar um material novo.
- Sugestões de fornecedor: consulta a `fornecedores_material_v2` (razão social) via React Query,
  renderizada em `<datalist>` no input, mantendo texto livre — o casamento por nome normalizado do
  resolvedor de densidade continua o mesmo.
- Validação de par obrigatório antes de qualquer mutação; toasts no padrão atual.
