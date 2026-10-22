# Aglutinar materiais por similaridade e por carta de traço

Objetivo: o filtro **Material** (Conferência → Por material) hoje lista quase uma opção por grafia da nota. A proposta é reduzir a lista agrupando descrições que são o mesmo material, e unificando num único item todas as descrições que apontam para a **mesma carta de traço**.

## Como o agrupamento vai funcionar

Três camadas, aplicadas nesta ordem:

1. **Mesma carta de traço (prioridade máxima)**
   Registros de concreto já gravam o traço identificado. Todas as descrições vinculadas ao mesmo traço passam a formar **uma única opção**, rotulada pelo código/descrição da carta (ex.: `CALPER 35,0 FCK — B0/B1 12±2`), com a contagem de grafias.
   Isso funde os casos do exemplo: `35,0FCK 24.00GPA AC<0.55 J20.B.B0/B1.28D.12+-2.CALPER`, `CC.35,0FCK 28DIAS,A/C=0,550,220,0 BB B1 280,12+-2,CALPER` e as variações `CE.20,0FCK...` / `CE.20.0FCK...` quando apontam para o mesmo traço. Traços diferentes continuam separados.

2. **Mesmo conjunto de palavras (similaridade)**
   Descrições com as mesmas palavras em ordem diferente ou com palavras irrelevantes viram uma só:
   - `AREIA MEDIA`, `AREIA MEDIA LAVADA`, `AREIA LAVADA MEDIA` → **AREIA MEDIA LAVADA**
   - `BRITA 0 / TON` e `BRITA 0` → **BRITA 0**
   - plural/singular (`MATERIAIS` / `MATERIAL`) tratados como iguais.
   Palavras que **diferenciam** o material são preservadas e nunca aglutinadas: granulometria (`FINA`, `MEDIA`, `GROSSA`), números (`BRITA 0` ≠ `BRITA 1`, `PEDRA 2`), tipos de cimento (`CP III 40 RS`).

3. **Ruído fiscal e OCR** (já existente) continua: texto fiscal colado na descrição, romanos e trocas O/0, I/1.

## Efeito visual

- Lista do combo bem menor, ordenada alfabeticamente, mantendo o sufixo já usado `(N grafias)` quando o item reúne mais de uma escrita.
- Ao passar o mouse na opção, dica com as grafias originais reunidas.
- Nas opções vindas de carta de traço, um selo discreto "traço" para deixar claro o critério.
- Ao selecionar, o quadro comparativo, KPIs, gráfico e estratificação passam a considerar **todos** os registros das grafias reunidas — é exatamente o ganho pedido para filtrar registros vinculados.
- Tolerância: opção de carta de traço usa a tolerância da carta; as demais seguem a tabela padrão/fornecedor, como já é hoje.

## Detalhes técnicos

- `src/lib/material.ts`: adicionar chave de aglutinação por conjunto de tokens (ordenação, stopwords/unidades, singularização) preservando tokens discriminantes; e suportar chave alternativa `traco:<id>` com precedência sobre a textual. `construirMapaMateriais` passa a receber, por item, `{ descricao, tracoId, tracoRotulo }`.
- `src/components/dashboard-conferencia-material.tsx`: `expandirParaMaterial` passa a propagar `traco_id` da pesagem; o mapa e o combo usam a nova assinatura; filtro por `materialChave` continua igual.
- Nada muda no banco nem no texto gravado nas notas — a aglutinação é apenas de exibição/filtro.
