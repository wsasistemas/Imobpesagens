# Coluna "Valor NF" no Ranking de diferenças

## O que muda

No quadro **Ranking de diferenças** (aba Fechamento Mensal), entra uma nova coluna **Valor NF** logo ao lado de **Peso NF**, com o valor total das notas de cada fornecedor no período/filtros ativos — no mesmo padrão da tabela "Fechamento por obra × fornecedor".

- Valor em R$ formatado (ex.: R$ 65.990,30), alinhado à direita.
- Soma apenas os valores das notas que possuem peso NF (mesma base usada no cálculo do Impacto R$), garantindo coerência entre as colunas.
- Quando o fornecedor não tem valor informado nas notas, exibe "—".
- O rodapé "Total geral" passa a mostrar também o somatório de Valor NF.
- A exportação CSV do ranking ganha a coluna "Valor NF (R$)" na mesma posição.

Nenhuma regra de tolerância, situação ou cálculo de diferença é alterada.

## Detalhes técnicos

- `src/components/dashboard-fechamento-mensal.tsx`: o campo `valorNfComPeso` já é agregado por fornecedor em `rankingDiferencas` — basta exibi-lo.
  - `<thead>` do ranking: novo `<th>` "Valor NF" após "Peso NF".
  - `<tbody>`: nova `<td>` com `fmtBRL(r.valorNfComPeso)` (ou "—" se 0).
  - `<tfoot>`: ajustar o `colSpan` do "Total geral" e adicionar a célula de soma de `valorNfComPeso`.
  - `min-w` da tabela ajustado para acomodar a coluna extra.
  - CSV: incluir cabeçalho e valor na função de exportação do ranking.
