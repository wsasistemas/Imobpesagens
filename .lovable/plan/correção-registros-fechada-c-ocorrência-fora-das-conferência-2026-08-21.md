# Correção — registros "Fechada c/ocorrência" fora das conferências e do fechamento

## Diagnóstico confirmado na base

Hoje existem **8 registros** com status `fechada_com_ocorrencia` (mais 1 `aguardando_saida_ocorrencia`). Nenhum deles entra na Conferência por Fornecedor nem no Fechamento Mensal, porque os três pontos de agregação filtram **apenas** `status = 'concluida'`:

- Conferência por fornecedor (quadro comparativo e KPIs)
- Fechamento por obra × fornecedor / Ranking de diferenças
- Indicadores do Dashboard (inclusive a função de resumo do banco)

Verificando os dados desses 8 registros:

| Situação dos dados | Qtde | Exemplo |
|---|---:|---|
| Tem peso de entrada **e** saída (líquido apurável) | 2 | NF 000.446.736 – placa LBL5860 (13.360 kg aferido × 13.510 kg NF) e NF 000.039.181 |
| Sem peso de saída (líquido não apurável) | 6 | NF 205966, 205899, 205723, 205524, 205508, 000.446.489 |

O registro da evidência (NF 000.446.736 / LBL5860) é justamente um dos que **têm** peso líquido válido — ele deveria aparecer nas conferências.

Os 6 registros sem saída estão hoje com apuração inválida gravada (diferença ≈ **−100%**, porque o líquido é nulo). Se fossem incluídos sem critério, contaminariam as médias de diferença e o Impacto R$.

## Correção proposta

1. Criar um critério único de "registro contabilizável" nas análises:
   - status `concluida` **ou** `fechada_com_ocorrencia`;
   - **e** com peso líquido apurado (entrada e saída pesadas) e peso de NF válido.
2. Aplicar esse critério em:
   - Conferência por fornecedor (quadro comparativo, KPIs, gráfico NF × aferido, exportação);
   - Fechamento por obra × fornecedor, Ranking de diferenças, subtotais, total geral e CSV;
   - Indicadores do Dashboard (visão consolidada e por obra), mantendo a mesma regra na consulta do banco usada quando uma obra específica está selecionada.
3. Sinalizar visualmente esses registros: badge/ícone discreto "c/ocorrência" na linha do quadro comparativo e na estratificação, para o usuário saber que a linha veio de um fechamento com ocorrência.
4. Adicionar um contador de exclusão explícito no rodapé/nota das conferências: "X registros sem pesagem de saída não entram na apuração", em vez de simplesmente desaparecerem.
5. Não alterar as regras de tolerância, situação (OK / Acima da Tolerância) nem a regra atual de Impacto R$.

## Detalhes técnicos

- Nova função utilitária compartilhada (ex.: `src/lib/afericao-escopo.ts`) com `contabilizavelNaConferencia(p)` e `semSaida(p)`.
- `src/components/dashboard-conferencia.tsx`: trocar `p.status === "concluida"` pelo novo predicado.
- `src/components/dashboard-fechamento-mensal.tsx`: trocar os dois filtros `status !== "concluida"` (linhas ~195 e ~218).
- `src/routes/dashboard.tsx`: mesmo ajuste no memo `concluidas`.
- Banco: migração para atualizar `dashboard_recebimento`, incluindo `fechada_com_ocorrencia` com peso líquido válido.

## Validação

1. NF 000.446.736 (placa LBL5860) passa a aparecer no quadro comparativo e no fechamento, com badge de ocorrência.
2. Total de registros contabilizados sobe de 155 para 157; os 6 sem saída continuam fora e são reportados na nota de exclusão.
3. KPIs, subtotais, total geral, gráficos e CSVs continuam consistentes entre Conferência, Fechamento e Dashboard.
