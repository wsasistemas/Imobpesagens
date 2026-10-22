# Correção definitiva da coluna "Peso Carta Traço"

## Causa confirmada

A gravação usa um nome de campo que não existe no objeto de apuração.

- O cálculo do traço devolve o valor no campo `esperado` (é o mesmo que a tela mostra em "Esperado").
- Os três pontos de salvamento gravam `resultadoConcreto?.peso_esperado`, que é sempre indefinido → a coluna `peso_esperado` vai para o banco como vazio.

Evidência no banco: todos os registros com traço identificado têm `peso_esperado` vazio, mas o bloco de apuração salvo no mesmo registro traz o valor certo. Exemplos:

| Nota | Esperado apurado | peso_esperado gravado |
|---|---|---|
| 039917 | 29.433,6 kg | vazio |
| 205438 | 18.743,36 kg | vazio |
| 039912 | 29.316,8 kg | vazio |

O 29.433,6 kg da tela em anexo é exatamente o valor já presente no registro — só não foi copiado para a coluna do grid.

## O que será feito

1. **Corrigir a gravação** nos três fluxos (salvar entrada, registrar saída, fechar com ocorrência): passar o valor de `esperado`. Junto, gravar também tolerância aplicada, diferença em kg, diferença em %, status da aferição e volume, que hoje sofrem do mesmo problema e ficam vazios.
2. **Leitura resiliente no grid**: quando a coluna estiver vazia mas o registro tiver a apuração salva, a tela exibe o valor da apuração — assim nenhum registro antigo aparece com "—".
3. **Backfill dos registros existentes**: preencher `peso_esperado` (e os campos de aferição correlatos) de todos os registros que já têm apuração salva, usando os valores que já estão no próprio registro. Sem recálculo, sem alteração de schema.

## Detalhes técnicos

- `src/routes/pesagem.tsx`: trocar `resultadoConcreto?.peso_esperado` por `resultadoConcreto?.esperado` nas linhas de payload (~1051, ~1104, ~1320); adicionar `tolerancia_aplicada: resultadoConcreto?.tol`, `diferenca_pct: resultadoConcreto?.desvioPct`, `diferenca_kg: aferido - esperado`, `status_afericao: resultadoConcreto?.status`, `volume_m3: resultadoConcreto?.volume`.
- Grid (~linha 3086) e o mapeamento de `pesoEsperado` (~1520): fallback para `resultado_afericao.esperado`.
- Backfill via UPDATE nos registros onde `resultado_afericao->>'esperado'` existe e `peso_esperado` é nulo.
