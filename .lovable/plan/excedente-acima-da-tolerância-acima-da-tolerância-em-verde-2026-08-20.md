# Excedente acima da tolerância = "Acima da Tolerância" em verde

## Regra nova (Quadro comparativo: Pesagem × Nota Fiscal)

| Diferença | % vs tolerância | Situação | Cor |
|---|---|---|---|
| Positiva (aferido > NF) | acima da tolerância | **Acima da Tolerância** | **verde** |
| Positiva | dentro da tolerância | OK | verde |
| Negativa | dentro da tolerância | OK | verde |
| Negativa | acima da tolerância | Acima da Tolerância | vermelho |

No exemplo em anexo, as linhas com +1,23 t / 8,97% e +1,11 t / 8,10% (tolerância ±2,00%) passam a exibir o selo **Acima da Tolerância** em verde, em vez de OK.

## Coluna %
- Excedente acima da tolerância: valor em **verde com seta para baixo** (igual ao OK atual), mantendo a leitura de que não há prejuízo.
- Déficit acima da tolerância: vermelho com seta para cima (inalterado).

## KPIs, filtros e CSV
- O status de excedente volta a ser identificado separadamente, então:
  - o filtro "Divergentes" e o KPI de divergência continuam contando **apenas déficits** acima da tolerância (sem mudança de números);
  - o CSV passa a exportar "Acima da Tolerância (excedente)" para essas linhas, diferenciando do déficit.

## Detalhes técnicos
- `src/components/estratificacao-dialog.tsx` → `montarLinhaEstratificacao`: reativar o status `acima` já previsto no tipo `SituacaoEstratificacao`, atribuído quando `difKg > 0 && |difPct| > tolLinha`; déficit acima da tolerância continua `abaixo`; o resto vira `ok`.
- `src/components/dashboard-conferencia.tsx`: badge da coluna Situação e cor/seta da coluna % passam a tratar `acima` como verde com o texto "Acima da Tolerância"; `linhaDivergente` continua excluindo `acima` do grupo divergente (ajuste explícito para `situacao === "abaixo"`).
- Selo de situação dentro da Estratificação (memória de cálculo) recebe a mesma cor verde para `acima`.
- Nenhuma alteração no cálculo de peso, diferença, percentual ou resolução de tolerância (carta de traço → override → padrão → geral).
- Fechamento Mensal e Ranking de diferenças mantêm o critério atual; posso alinhar depois se desejar.
