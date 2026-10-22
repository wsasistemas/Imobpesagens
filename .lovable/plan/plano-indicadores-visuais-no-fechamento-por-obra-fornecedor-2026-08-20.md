# Plano: Indicadores visuais no Fechamento por obra × fornecedor

## Contexto
A tabela **Fechamento por obra × fornecedor** já possui a coluna **Situação** com os badges **OK** e **Acima da Tolerância**. No entanto, a coluna **% Dif Médio** ainda renderiza uma seta vermelha para cima em todas as linhas, independentemente da situação.

## Objetivo
Replicar na tabela de fechamento o mesmo comportamento visual já existente no **Ranking de Diferenças**:
- Situação **"Acima da Tolerância"**: `% Dif Médio` em **vermelho** com seta para **cima** (↑).
- Situação **"OK"**: `% Dif Médio` em **verde** com seta para **baixo** (↓).

## Alterações
1. No componente `FragmentObra` (`src/components/dashboard-fechamento-mensal.tsx`), substituir a renderização fixa da coluna `% Dif Médio` (linhas ~1255-1262) para usar o helper existente `indicadorPctRanking(f.situacao)`.
2. Preservar o formato `inline-flex items-center gap-1` e as classes de tipografia/tabular.
3. Manter inalteradas as linhas de **Subtotal** e **Total Geral**, pois não possuem situação individual associada.

## Verificação
- Executar `tsc --noEmit`.
- Capturar screenshot da aba **Fechamento Mensal** confirmando que linhas "OK" exibem seta verde para baixo e linhas "Acima da Tolerância" exibem seta vermelha para cima.
