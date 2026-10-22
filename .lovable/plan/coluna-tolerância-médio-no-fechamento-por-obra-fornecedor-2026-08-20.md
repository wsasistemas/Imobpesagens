# Coluna "% Tolerância Médio" no Fechamento por obra × fornecedor

## O que será feito

Adicionar uma nova coluna **% Tolerância Médio** no grid "Fechamento por obra × fornecedor", entre **% Dif Médio** e **Valor NF** (exatamente onde está marcado em vermelho no anexo).

O valor é a **média simples das tolerâncias de cada nota** daquele fornecedor — as mesmas tolerâncias exibidas na coluna "Tolerância" da tela "Notas fiscais". Ou seja: soma a tolerância de cada registro e divide pelo número de registros do fornecedor.

Exemplo: fornecedor com 45 notas todas com ±3% → **±3,00%**. Se houver notas com carta traço (ex.: ±2%) misturadas com tolerância padrão (±3%), a média fica entre as duas, refletindo a composição real.

Regras de exibição:
- Formato `±X,XX%`, alinhado à direita, com fonte pequena igual às demais colunas.
- Linha de **Subtotal — obra**: média das tolerâncias de todos os registros da obra (mesma lógica, sobre todas as notas da obra, não média das médias).
- Fornecedor sem nenhuma tolerância apurada: mostra "—".

## Detalhes técnicos

Arquivo: `src/components/dashboard-fechamento-mensal.tsx`

1. Na agregação `porObra` (dentro do `useMemo` das linhas por obra), calcular por bucket de fornecedor a soma de `tolPorPesagem.get(p.id)?.pct` e a contagem de registros com tolerância definida; derivar `toleranciaMedia = soma / contagem`.
2. Acumular essas somas/contagens também no nível da obra para o subtotal (`totTolSoma`, `totTolQtd`).
3. Estender os tipos `LinhaForn` (campo `toleranciaMedia: number | null`) e `GrupoObra` (campos do subtotal).
4. Em `FragmentObra`: nova `<td>` após a coluna de `% Dif Médio` na linha de fornecedor e na linha de subtotal; ajustar o `colSpan` do cabeçalho de obra (8 → 9).
5. Ajustar o `<thead>` desse grid com o header **% Tolerância Médio** e aumentar o `min-w` da tabela para caber a coluna.
6. Incluir a coluna na exportação CSV desse fechamento (cabeçalho "% Tolerância Médio" + valor numérico).

Nenhuma alteração de banco, de regra de tolerância ou de cálculo de diferença — apenas leitura das tolerâncias já apuradas por registro.
