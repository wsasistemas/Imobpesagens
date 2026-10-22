# Diferença a maior nunca fica "Acima da Tolerância"

## Regra
Quando o aferido é MAIOR que o declarado na NF (ou que a carta de traço), a entrega tem sobra — não há prejuízo. A situação passa a ser sempre **OK** (verde), independentemente do percentual.

| Diferença | % vs tolerância | Situação |
|---|---|---|
| Positiva (sobra) | qualquer | **OK** (verde) |
| Negativa (falta) | dentro da tolerância | OK (verde) |
| Negativa (falta) | acima da tolerância | Acima da Tolerância (vermelho) |

No exemplo anexado (+1.920 kg, 11,43%, tolerância ±3%), o KPI "Diferença" e a linha da NF 000.039.274 passam a exibir **OK** em verde, sem o selo "Acima" âmbar nem o fundo vermelho.

## Onde muda
Módulo **Fechamento Mensal** (`src/components/dashboard-fechamento-mensal.tsx`), que hoje ainda classifica sobra como divergência:

1. Classificação por nota (`situacaoDe`): sobra passa a retornar `ok`; só déficit fora da tolerância vira alerta. O status âmbar "Acima" deixa de ser produzido.
2. Classificação do fechamento por obra × fornecedor e do ranking (`situacaoFechamento`): só marca "Acima da Tolerância" quando o percentual médio é negativo e ultrapassa a tolerância média; sobra fica OK.
3. Diálogo "Notas fiscais" (KPI Diferença): fundo verde e selo OK nesses casos; a coluna Diferença mantém o valor em verde.
4. Reflexo automático, sem lógica duplicada: badge da coluna Situação, seta/cor do % Dif Médio (verde para baixo), Impacto R$ (linhas OK continuam exibindo "—" e não somam no total) e exportações CSV.

## Não muda
- Cálculo de aferido, peso NF, diferença em kg e percentual — os números exibidos continuam iguais.
- Resolução da tolerância (carta de traço → override do fornecedor → tabela padrão → geral) e as colunas de tolerância.
- Abas Conferência e coluna Sinal Tolerância do histórico, que já tratam sobra como OK.

## Validação
Reabrir o diálogo da NF 000.039.274: KPI Diferença em verde com selo OK e linha com Situação OK; conferir que uma nota com falta acima da tolerância continua vermelha com "Acima da Tolerância".
