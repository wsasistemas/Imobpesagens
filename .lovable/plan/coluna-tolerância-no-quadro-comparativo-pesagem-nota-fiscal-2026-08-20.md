# Coluna "% Tolerância" no Quadro comparativo: Pesagem × Nota Fiscal

## Objetivo
Incluir, na tabela do Quadro comparativo (Conferência → Por fornecedor), uma coluna **% Tolerância** com o valor absoluto da tolerância aplicada a **cada registro**:
- Registro com **carta de traço** → tolerância do cadastro da carta (traço/fornecedor de concreto).
- Registro sem carta → tolerância do **material (categoria)**: override do fornecedor quando existir, senão a tabela padrão.
- Sem categoria identificada → tolerância geral do filtro (fallback atual).

## Posição e formato
```text
Data | Fornecedor / Produto | Carta traço | Entrada | Saída | Líquido aferido | Declarado NF | Comparativo | Diferença | % | % Tolerância | Situação
```
- Valor exibido como `±X,XX%` em cor neutra, com tooltip informando a origem (carta de traço, fornecedor, tabela padrão ou geral).
- Registros sem NF exibem "—".

## Consistência da Situação
Hoje, quando não há carta de traço, a linha usa a tolerância geral do filtro (2%). Passará a usar a tolerância resolvida por registro (carta → override → tabela padrão → geral), o mesmo critério já usado no Fechamento Mensal. Assim o badge **OK / Acima da Tolerância** e a coluna % Tolerância ficam coerentes entre si e com o fechamento.

## Detalhes técnicos
- Arquivo principal: `src/components/dashboard-conferencia.tsx`.
- Reaproveitar o resolvedor único já existente `resolverToleranciaDaPesagem` de `src/lib/tolerancias-heranca.ts`, junto com os hooks `useToleranciasPadrao`, `useGerenciamentoFornecedores`, `useOverridesFornecedor` e `categorizar` de `src/lib/tolerancias-material.ts` — mesma montagem de contexto usada em `dashboard-fechamento-mensal.tsx` (linhas 243-274), incluindo o mapa `traco_id → tolerancia_peso` a partir dos fornecedores de concreto/traços.
- Passar a tolerância resolvida por registro para `montarLinhaEstratificacao` (parâmetro `toleranciaPct` por linha), de modo que `tolLinha` e `situacao` já saiam corretos; nenhuma alteração de regra de cálculo de peso/diferença.
- Novo `<th>` "% Tolerância" e nova célula na linha; `colSpan` do estado vazio ajustado de 10 para 12.
- Exportação CSV do quadro recebe a coluna "Tolerância (%)".
