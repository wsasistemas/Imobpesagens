# Ranking de diferenças — Impacto R$ só para "Acima da Tolerância"

## Objetivo
No **Ranking de diferenças**, a coluna **Impacto R$** deve exibir valor apenas nas linhas cuja **Situação** é **Acima da Tolerância**. Linhas **OK** exibem "—".

## O que muda
Arquivo: `src/components/dashboard-fechamento-mensal.tsx`

1. **Célula Impacto R$ da tabela do ranking**: exibe `fmtBRL(r.impactoRS)` somente quando `r.situacao` é acima da tolerância; caso contrário mostra "—" (sem cor de alerta).
2. **Total geral da coluna Impacto R$**: passa a somar apenas as linhas fora da tolerância, ficando coerente com o que está visível na tabela.
3. **Métrica "Por impacto (R$)"** (ordenação + gráfico de barras): linhas OK entram com impacto 0, de modo que o ranking por impacto destaca apenas os fornecedores fora da tolerância.
4. **Exportação CSV do ranking**: coluna de impacto vazia nas linhas OK, igual à tela.

## Não muda
- Cálculo do impacto (`valor NF × diferença %`), diferença, percentuais e a regra de tolerância média por fornecedor.
- A tabela **Fechamento por obra × fornecedor**, que mantém o impacto em todas as linhas (posso alinhar depois, se desejar).

## Validação
Na tela de evidência, apenas **NOBRE COMERCIO** (−R$ 476,74) e **ABISAI** (−R$ 266,64) devem manter valor; as demais linhas OK exibem "—" e o Total geral passa a somar somente essas duas.
