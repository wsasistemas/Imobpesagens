# Conferência por fornecedor — Situação e indicador de %

## Objetivo
No **Quadro comparativo: Pesagem × Nota Fiscal** (aba Conferência → Por fornecedor):
- Renomear o badge de situação **"Abaixo"** para **"Acima da Tolerância"**.
- A coluna **%** passa a seguir a situação:
  - Situação **Acima da Tolerância** → valor em **vermelho** com seta para **cima** (↑).
  - Situação **OK** → valor em **verde** com seta para **baixo** (↓).

## Alterações
1. Badge da coluna **Situação**: texto "Abaixo" → "Acima da Tolerância", em uma única linha (`whitespace-nowrap`, fonte 10px), mantendo o vermelho atual. A situação "Acima" (excedente acima da NF) permanece âmbar e inalterada.
2. Coluna **%**: cor e seta passam a derivar de `l.situacao` em vez do sinal de `l.difPct`:
   - `ok` → verde + `ArrowDown`
   - `abaixo` → vermelho + `ArrowUp`
   - `acima` → mantém âmbar/seta atual
   - Sem NF → "—" (inalterado)
3. Exportação CSV: rótulo "Abaixo" atualizado para "Acima da Tolerância".
4. O card/KPI de filtro que hoje alterna entre abaixo/acima mantém o comportamento; apenas rótulo textual ajustado se exibir "Abaixo".

## Detalhes técnicos
- Arquivo: `src/components/dashboard-conferencia.tsx` (linhas ~501-523 do grid e linha ~217 do CSV).
- Somente apresentação: o cálculo de `situacao`, tolerância por linha e diferença permanecem intactos.
