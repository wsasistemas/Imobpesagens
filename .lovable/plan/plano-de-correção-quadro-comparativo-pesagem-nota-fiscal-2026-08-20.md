# Plano de correção — Quadro comparativo Pesagem × Nota Fiscal

## Diagnóstico confirmado
No exemplo anexado, a diferença é **+7,42%** e a tolerância da carta de traço é **±4,00%**. Como `|7,42| > 4,00`, o registro deveria aparecer em vermelho com seta para cima.

O cálculo já identifica esse caso como divergente positivo (`acima`), porém a apresentação atual trata como alerta somente o status negativo (`abaixo`). Por isso, divergências positivas acima da tolerância estão sendo exibidas incorretamente como **OK**, em verde e com seta para baixo.

## Correção visual e de regra
1. Manter a tolerância individual de cada registro, priorizando a tolerância cadastrada na **carta de traço** quando houver `traco_id` ou base de cálculo por carta.
2. Centralizar a conformidade da linha pela regra absoluta:
   - `|% diferença| <= % tolerância` → **OK**;
   - `|% diferença| > % tolerância` → **Acima da Tolerância**.
3. No campo `%` do quadro comparativo:
   - divergente, positiva ou negativa → **vermelho + seta para cima**;
   - dentro da tolerância → **verde + seta para baixo**.
4. Na coluna **Situação**, exibir **Acima da Tolerância** em vermelho para os dois sentidos de divergência; manter **OK** em verde apenas para registros dentro do limite.
5. Alinhar filtros, KPIs e exportação CSV à mesma classificação, evitando que divergências positivas sejam contabilizadas ou exportadas como OK.

## Validação
Testar especificamente uma linha de carta de traço como a evidência: diferença **7,42%**, tolerância **4,00%**, resultado esperado **vermelho, seta para cima e “Acima da Tolerância”**. Também conferir um registro dentro do limite para garantir **verde, seta para baixo e “OK”**.
