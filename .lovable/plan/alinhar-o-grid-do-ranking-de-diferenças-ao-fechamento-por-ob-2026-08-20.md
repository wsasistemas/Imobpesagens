# Alinhar o grid do Ranking de diferenças ao Fechamento por obra × fornecedor

## Objetivo
O grid abaixo do gráfico "Ranking de diferenças" passa a ter as mesmas colunas, ordem e formatação do grid "Fechamento por obra × fornecedor".

## Colunas finais do ranking
```text
# | Fornecedor | Obra(s) | Receb. | Aferido | Peso NF | Valor NF | Diferença | % Dif Médio | % Tolerância Médio | Impacto R$ | Situação
```
Mudanças:
- Coluna **%** renomeada para **% Dif Médio**, exibida com **seta para cima em vermelho** (igual ao fechamento).
- Nova coluna **% Tolerância Médio**, com a tolerância média apurada do fornecedor (carta de traço quando houver, senão cadastro do fornecedor/tabela padrão) — o mesmo valor que já define a Situação do ranking.
- Demais colunas mantidas na mesma ordem já usada no fechamento (Valor NF antes de Diferença, Impacto R$ antes de Situação).
- **#** (medalhas) e **Obra(s)** permanecem, pois são específicos do ranking; o fechamento já é agrupado por obra.

## Ajustes de linha
- Linha de **Total geral** do ranking: nova célula vazia para % Tolerância Médio, mantendo o alinhamento das colunas de Valor NF, Diferença e Impacto R$.
- Largura mínima da tabela aumentada para acomodar a coluna extra, mantendo o scroll horizontal.

## Detalhes técnicos
- Arquivo: `src/components/dashboard-fechamento-mensal.tsx`, bloco do grid do ranking.
- A tolerância média já existe em `RankingItem.tolerancia` (via `tolerarConjunto`), formatada com `fmtTolMedia` — sem novo cálculo ou consulta.
- Exportação CSV do ranking atualizada com o cabeçalho "% Dif Médio" e a nova coluna "% Tolerância Médio".
