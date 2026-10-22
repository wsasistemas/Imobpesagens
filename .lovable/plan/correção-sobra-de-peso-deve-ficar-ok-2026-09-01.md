# Correção — sobra de peso deve ficar “OK”

## Diagnóstico confirmado
O registro exibido de **D’ANGELOS AREAL** está correto nos valores: **17.440 kg aferidos**, **16.800 kg na NF**, diferença de **+640 kg / +3,81%** e tolerância de **±2,00%**. Como a diferença é positiva, houve sobra na entrega e a situação deve ser **OK**.

A origem do erro está no Quadro comparativo: a montagem da linha ainda cria um estado separado `acima` quando a sobra ultrapassa a tolerância. A apresentação pinta esse estado de verde, mas mantém o texto incorreto **“Acima da Tolerância”**. Portanto, a cor está coerente com ausência de prejuízo, porém a classificação e o rótulo não estão.

## Regra única a aplicar
| Resultado apurado | Situação | Aparência |
|---|---|---|
| Aferido maior ou igual ao peso da NF/carta | **OK** | Verde |
| Aferido menor, mas dentro da tolerância | **OK** | Verde |
| Aferido menor e fora da tolerância | **Acima da Tolerância** | Vermelho |
| Sem peso de referência | **Sem NF / Sem parâmetro** | Neutro |

## Alterações
1. **Centralizar a classificação por registro**
   - Ajustar `montarLinhaEstratificacao` para que toda diferença positiva ou zero retorne diretamente `ok`, independentemente do percentual.
   - Manter `abaixo` exclusivamente para déficit que ultrapassa a tolerância aplicável.

2. **Corrigir o Quadro comparativo: Pesagem × Nota Fiscal**
   - A linha de D’ANGELOS AREAL passa a mostrar o badge **OK** em verde.
   - Preservar os valores `+640 kg`, `3,81%` e `±2,00%`; apenas a situação será corrigida.
   - Remover o caminho visual que exibe **“Acima da Tolerância” em verde** para excedentes.

3. **Alinhar todos os reflexos da mesma situação**
   - KPIs: excedentes passam a contar como OK, nunca como “acima”.
   - Filtros: excedentes ficam no grupo OK e não no grupo de divergências.
   - CSV: exportar **OK** para sobras, eliminando “Acima da Tolerância (excedente)”.
   - Estratificação/memória de cálculo: usar o mesmo status OK, sem alterar peso, diferença ou tolerância.

4. **Preservar os alertas reais**
   - Déficits acima da tolerância continuam vermelhos e com o texto **Acima da Tolerância**.
   - A regra de tolerância por carta de traço ou por material permanece inalterada.
   - Nenhuma mudança no banco de dados ou nos cálculos gravados.

## Validação
- Conferir o registro de D’ANGELOS AREAL: `+640 kg / +3,81% / ±2,00%` deve exibir **OK** em verde.
- Validar uma sobra menor que a tolerância e outra maior: ambas devem ser OK.
- Validar um déficit dentro da tolerância: deve ser OK.
- Validar um déficit fora da tolerância: deve continuar **Acima da Tolerância** em vermelho.
- Conferir KPIs, filtros, CSV e diálogo de estratificação para garantir a mesma classificação em todos os pontos.
