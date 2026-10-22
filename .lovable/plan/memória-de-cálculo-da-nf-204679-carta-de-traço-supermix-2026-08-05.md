# Memória de cálculo da NF 204679 × Carta de Traço SUPERMIX

## Veredito: não está de acordo com a carta de traço

A tela em anexo calculou o esperado com a **densidade genérica de concreto (2.390 kg/m³)**, e não com a densidade da carta de traço da SUPERMIX.

```text
Item da NF: TC.35,0 FCK.24,00 ... D.12+-2 ... CALPER   |  10 M3
```

| Base usada | Densidade | Declarado NF (10 m³) | Aferido | Diferença | Tolerância | Situação |
|---|---|---|---|---|---|---|
| Tela atual (genérica) | 2.390 kg/m³ | 23.900 kg | 23.150 kg | -750 kg (-3,14%) | ±2% | Fora (vermelho) |
| Carta SUPERMIX SL1235 (D.12) | 2.342,92 kg/m³ | 23.429 kg | 23.150 kg | -279 kg (-1,19%) | ±4% (fornecedor) | Conforme |

Ou seja: com a carta correta, essa carga é **conforme**. A tela está acusando desvio por usar a densidade padrão de mercado.

## Três problemas encontrados (confirmados nos dados)

1. **A carta de traço não chega até a tela do grid.** O registro no banco já tem o traço identificado, mas a consulta que alimenta o histórico/estratificação não traz os campos de aferição (traço, densidade, esperado, tolerância). Sem eles, a memória de cálculo cai no fallback de 2.390 kg/m³.
2. **O traço casado é o errado.** A NF diz `D.12+-2` (slump 12), mas o sistema vinculou o traço de **slump 10** (2.350,32 kg/m³). Causa: as palavras-chave dos três traços SUPERMIX começam com `TC.35`, então o primeiro da lista ganha antes de olhar o slump.
3. **A tolerância exibida é 2% fixo.** Para concreto identificado por carta de traço, a tolerância correta é a do traço/fornecedor (SUPERMIX = 4%).

Ainda há um resíduo: o registro guarda `aferido = 11.450 kg` (só a entrada, antes da saída). O valor precisa ser recalculado para o líquido real de 23.150 kg.

## O que será feito

1. **Trazer os dados de aferição para o grid**: incluir traço, densidade, peso esperado, tolerância, status e base de cálculo na consulta do histórico.
2. **Memória de cálculo com selo de origem**: quando houver carta de traço, a tela mostra "Carta de traço SUPERMIX · SL1235 · FCK 35 · slump 12 · 2.342,92 kg/m³" no lugar de "densidade 2.390 kg/m³", e usa a tolerância do traço/fornecedor na linha de comparação. Sem carta, mantém o texto atual de densidade genérica.
3. **Corrigir a escolha do traço**: no casamento, o slump lido da NF (`D.12+-2`) passa a ser critério obrigatório de desempate entre traços do mesmo FCK; só cai para o mais próximo quando o slump não for legível.
4. **Recalcular este e os demais registros de concreto** pela rotina de manutenção já existente, para que `aferido`, esperado, diferença e status reflitam o líquido final e o traço certo.

## Detalhes técnicos

- `src/lib/pesagem-queries.ts`: adicionar `traco_id, resultado_afericao, peso_esperado, diferenca_kg, diferenca_pct, tolerancia_aplicada, status_afericao, base_calculo, volume_m3, volume_derivado_detalhe` ao `PESAGEM_COLS`.
- `src/components/estratificacao-dialog.tsx`: usar `resultado_afericao.rho`/`tol` (já lido, hoje sempre `undefined`) para rótulo da regra aplicada, cabeçalho de origem e tolerância da comparação.
- `src/lib/concreto.ts` (`identificarConcreto`): extrair slump da descrição (`D.12+-2`) e priorizar `slump_nominal` compatível antes de aceitar match só por `match_keywords`/FCK; hoje o `find` por keyword devolve o primeiro traço com `TC.35`.
- Recálculo via `src/lib/recalculo.functions.ts` (aba Manutenção), sem alterar schema.
