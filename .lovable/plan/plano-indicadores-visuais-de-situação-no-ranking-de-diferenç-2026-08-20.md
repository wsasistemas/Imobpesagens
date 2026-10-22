# Plano: Indicadores visuais de situação no Ranking de Diferenças

## Objetivo
Ajustar a coluna **% Dif Médio** do grid do **Ranking de Diferenças** para refletir a situação do fornecedor com cor e seta condicionais:
- **Acima da Tolerância** → valor em vermelho + seta para cima (alerta).
- **OK** → valor em verde + seta para baixo (dentro do esperado).

## Escopo
- Arquivo: `src/components/dashboard-fechamento-mensal.tsx`
- Alvo: tabela do ranking de diferenças (linhas e total geral, se aplicável).
- Fora de escopo: gráfico de barras (mantém cores vermelho/verde por sinal do valor).

## Implementação
1. Criar helper `indicadorPctRanking(situacao: Situacao)` que retorna:
   - `"acima_da_tolerancia"` → `ArrowUp` + classe `text-red-700`.
   - `"ok"` → `ArrowDown` + classe `text-emerald-700`.
   - Demais situações → sem seta, cor neutra.
2. Substituir a renderização fixa da coluna **% Dif Médio** no `rankingOrdenado.map(...)` para usar o helper.
3. Aplicar a mesma lógica no total geral da coluna **% Dif Médio** quando houver uma situação consolidada, ou manter neutro quando não fizer sentido agregar.
4. Manter formatação de percentual (`fmtPct`) inalterada.

## Resultado visual esperado
- Fornecedores marcados como **Acima da Tolerância** exibirão `% Dif Médio` em vermelho com seta ↑.
- Fornecedores marcados como **OK** exibirão `% Dif Médio` em verde com seta ↓.
- O restante do grid (outras colunas, cores de fundo, medalhas) permanece igual.
