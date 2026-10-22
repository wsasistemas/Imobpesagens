# Diferença positiva = situação OK (verde)

## Regra nova
No **Quadro comparativo: Pesagem × Nota Fiscal** (Conferência → Por fornecedor):

- **Diferença ≥ 0** (aferido maior ou igual ao declarado/carta) → situação **OK**, badge verde, `%` em verde com seta para baixo — mesmo que o percentual ultrapasse a tolerância.
- **Diferença < 0** dentro da tolerância → **OK** verde (inalterado).
- **Diferença < 0** acima da tolerância → **Acima da Tolerância**, vermelho, seta para cima.

Observação: isso inverte o critério aprovado anteriormente (que marcava divergência positiva acima da tolerância como vermelha). Passa a valer a regra de que sobra de peso recebido não é penalizada.

## Onde muda
- `src/components/estratificacao-dialog.tsx` → `montarLinhaEstratificacao`: a classificação de `situacao` passa a considerar apenas o déficit; excedente vira sempre `ok`.
- Reflexo automático (sem lógica duplicada) em:
  - badge da coluna **Situação** e cor/seta da coluna **%** no quadro comparativo;
  - KPIs e filtro "Divergentes" da aba Conferência (linhas com excedente deixam de contar como divergentes);
  - rótulo de Situação na exportação CSV;
  - selo de situação dentro da Estratificação (memória de cálculo).

## Não muda
- Cálculo de peso aferido, diferença em kg e percentual.
- Resolução da tolerância por registro (carta de traço → override do fornecedor → tabela padrão → geral) e a coluna **% Tolerância**, que continuam sendo exibidas.
- Fechamento Mensal e Ranking de diferenças (permanecem com o critério de desvio absoluto), caso queira alinhar depois é só pedir.

## Validação
Conferir no exemplo em anexo: linhas com **+1,23 t / 8,97%** e **+1,11 t / 8,10%** devem exibir **OK** verde com seta para baixo; uma linha de déficit acima da tolerância deve continuar vermelha com seta para cima.
