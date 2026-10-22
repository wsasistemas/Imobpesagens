# Padronizar colunas: Fechamento por obra × fornecedor = Ranking de diferenças

## Objetivo
Deixar o grid "Fechamento por obra × fornecedor" com as mesmas colunas, ordem e formatação do grid do "Ranking de diferenças", e ajustar a coluna **% Dif Médio** para exibir seta para cima em vermelho.

## Colunas finais (mesma ordem do ranking)
```text
Fornecedor | Receb. | Aferido | Peso NF | Valor NF | Diferença | % Dif Médio | % Tolerância Médio | Impacto R$ | Situação
```
Mudanças em relação ao grid atual:
- **Valor NF** passa a ficar logo após Peso NF (como no ranking), em vez do fim da linha.
- Nova coluna **Impacto R$** = Valor NF × (Diferença ÷ Peso NF), em vermelho quando negativa.
- Mantidas **% Dif Médio** e **% Tolerância Médio** (exclusivas do fechamento, ficam entre Diferença e Impacto R$).
- Mesmas formatações do ranking: toneladas (t) no Aferido/Peso NF, kg com sinal na Diferença, moeda em Valor NF/Impacto, badge de Situação.

## % Dif Médio
- Exibe sempre **seta para cima em vermelho** junto ao percentual, indicando desvio.
- O valor numérico segue o cálculo atual (média de divergência) e a Situação continua comparando o % Dif Médio com o % Tolerância Médio ("Acima da Tolerância" quando estoura).

## Aplicação em todas as faixas do grid
- Linhas de fornecedor
- Linha de **Subtotal — obra**
- Linha de **TOTAL GERAL** (Impacto R$ somado, em vermelho)
- Cabeçalho de obra ajustado para o novo número de colunas

## Detalhes técnicos
- Arquivo: `src/components/dashboard-fechamento-mensal.tsx` (grid do fechamento e `FragmentObra`).
- Impacto R$ calculado por fornecedor a partir de `valorNf`, `diff` e `pesoNf`; subtotais e total geral somam os valores das linhas.
- `colSpan` do cabeçalho de obra e `min-w` da tabela atualizados para 10 colunas.
- Exportação CSV do fechamento atualizada com a nova ordem de colunas e a coluna Impacto (R$).
