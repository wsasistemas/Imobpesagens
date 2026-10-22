# Coluna "Sinal Tolerância" no histórico de pesagens

## Objetivo
Mostrar, direto no grid de histórico, se a pesagem fechada (entrada + saída) ficou fora da tolerância — destacando em vermelho o status **ACIMA DA TOLERÂNCIA**.

## Onde entra
Nova coluna **Sinal Tolerância** posicionada imediatamente **à direita da coluna "Situação"** (antes de "Nota"), exatamente na posição marcada em vermelho na tela anexada, com filtro de coluna por lista igual às demais.

## Regra de preenchimento
A coluna só é avaliada quando a pesagem está **fechada** (entrada e saída registradas → status `concluida` ou `fechada_com_ocorrência`). Antes disso exibe `—` com o texto "aguardando saída".

Comparação: peso líquido aferido × peso esperado.
- Registros com **carta de traço**: peso esperado da carta e tolerância da própria carta (usa o `status_afericao` já gravado no registro).
- Registros por **itens da NF**: peso esperado = peso/qtd da nota, tolerância pela cadeia já existente (tolerância do fornecedor para o material → tabela padrão → tolerância geral).

Resultado exibido (mesma convenção já usada na Conferência e no Fechamento Mensal):

| Situação | Selo |
| --- | --- |
| Falta de peso acima da tolerância | **ACIMA DA TOLERÂNCIA** — vermelho, com seta para cima e o % de diferença |
| Diferença dentro da tolerância | Dentro da tolerância — verde discreto |
| Sobra de peso (recebeu mais que a nota) | OK — verde, seta para baixo |
| Sem peso esperado (sem carta e sem peso na NF) | `—` cinza, tooltip "sem base de comparação" |

Tooltip do selo mostra: peso esperado, líquido aferido, diferença em kg, % de diferença, % de tolerância aplicada e a origem da tolerância (carta de traço / fornecedor / padrão / geral).

## Comportamento adicional
- Filtro da coluna permite isolar rapidamente todos os registros "Acima da tolerância".
- Nenhuma alteração de banco: usa os campos já gravados (`peso_esperado`, `diferenca_pct`, `tolerancia_aplicada`, `status_afericao`) e, quando ausentes, calcula na tela a partir da NF.
- A coluna é somente leitura; correções continuam pelo fluxo de editar registro com justificativa (que já recalcula).

## Detalhes técnicos
- `src/routes/pesagem.tsx`: novo cabeçalho `th("SinalTol", ...)` inserido no array `items` logo após `th("Situação", ...)`, com `ColunaFiltro tipo="lista"`; célula correspondente na mesma posição da linha (após a célula de Situação), entrada em `opcoesColuna` e no predicado de filtro por lista.
- Reutiliza `resolverToleranciaDaPesagem`, `useToleranciasPadrao`, `useGerenciamentoFornecedores`, `useOverridesFornecedor` de `src/lib/tolerancias-heranca.ts`, e `calcularPesoNfDaPesagem` já usado no grid, para manter o mesmo número exibido na Conferência.
- Função auxiliar única (`sinalTolerancia(pesagem, ctx)`) para o rótulo/cor, evitando divergência entre grid e dashboards.
- Selo compatível com o scroll horizontal e a coluna Placa congelada já existentes.
