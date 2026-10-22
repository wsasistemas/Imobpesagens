# Fechamento de saída: preservar a Carta de Traço e aferir Líquido × Carta

## O que está errado hoje (verificado no banco)

Ao registrar a saída, o sistema regrava os campos técnicos da carta de traço com o que está na tela naquele momento. No fluxo de saída o operador localiza o caminhão pela placa, e a tela **não recarrega o traço/fornecedor do registro de entrada** — então a apuração fica vazia e o valor da carta é apagado.

Evidência (registros reais):

| Nota | Traço vinculado | Peso Carta Traço gravado | Líquido | Diferença gravada |
|---|---|---|---|---|
| 039917 (ODS9221, tela anexada) | sim | vazio (apagado na saída) | 22.910 kg | vazio |
| 205438 | sim | 18.743,36 kg | 18.500 kg | −18.743,36 kg (errada) |
| 039912 | sim | 29.316,8 kg | 23.270 kg | −29.316,8 kg (errada) |

Dois defeitos, portanto:

1. **Perda do valor da carta** no fechamento da saída.
2. **Diferença calculada com aferido = 0**: hoje a diferença usa o peso digitado na tela em vez do Líquido do registro, e por isso vira exatamente o valor do esperado com sinal negativo.

O Líquido em si está correto: a coluna Líquido é calculada pelo próprio banco como Entrada − Saída (em módulo).

## O que será feito

### 1. Saída nunca apaga a carta de traço
- Ao localizar o caminhão pela placa, a tela passa a recarregar do registro de entrada: fornecedor de concreto, carta de traço selecionada, volume (m³) e a apuração salva.
- O card "Traço identificado" volta a aparecer na saída, com os mesmos dados usados na entrada.
- Na gravação da saída, os campos técnicos só são sobrescritos quando existe apuração válida; nunca são zerados/limpos.

### 2. Aferição correta no fechamento (Líquido × Carta)
No momento em que a saída fecha o registro, o sistema recalcula com base no Líquido efetivo:

```text
Líquido            = Peso Entrada − Peso Saída
Peso Carta Traço   = Volume (m³) × Densidade da carta
Diferença (kg)     = Líquido − Peso Carta Traço
Diferença (%)      = Diferença / Peso Carta Traço × 100
Status             = CONFORME | ABAIXO | ACIMA  (tolerância da carta, ou do fornecedor)
```

Grava: peso esperado, tolerância aplicada, diferença em kg e %, status da aferição, volume e base de cálculo ("carta_traco").

### 3. Registros já fechados: correção retroativa
- Recalcular diferença/percentual/status dos registros concluídos que têm carta de traço, usando Líquido × Esperado.
- Repor o Peso Carta Traço dos registros que o perderam no fechamento (recalculando por volume × densidade da carta vinculada, como no caso da nota 039917).

### 4. Dashboards de Conferência passam a usar a base técnica
Nas abas **Conferência por Fornecedor** e **Conferência por Material**:
- Quando o registro tem carta de traço, a referência de comparação passa a ser o **Peso Carta Traço** (base técnica), e não o peso declarado na NF; a tolerância usada é a da carta/fornecedor.
- Quando não há carta, continua exatamente como hoje (referência NF + tolerância por material).
- Cada linha ganha a marcação da base usada: `CARTA DE TRAÇO` ou `NF`, para não misturar critérios na leitura.
- KPIs de conformidade (OK / Abaixo / Acima) e os gráficos de linha Aferido × Referência passam a respeitar essa base.

### 5. Memória de cálculo técnica
A "Memória de cálculo" da estratificação ganha, para notas com carta de traço, o detalhamento:
- Fornecedor, código da carta, FCK, slump, densidade e tolerância;
- Volume da NF (m³), esperado = volume × densidade;
- Entrada, Saída, Líquido;
- Diferença em kg e %, faixa mín/máx da tolerância e conclusão do status;
- Indicação quando o traço foi confirmado manualmente ou veio do padrão de fallback.

## Detalhes técnicos

- `src/routes/pesagem.tsx`: no efeito que carrega a pesagem pendente (modo saída), hidratar `fornecedorIdentificado`, `tracoIdentificado`, `volume` e `resultado_afericao` a partir do registro; no update de saída, calcular `aferido = peso_entrada − peso_saida` e só sobrescrever os campos técnicos quando houver apuração (`payload` condicional em vez de `?? null`); mesma regra no fechamento com ocorrência.
- `src/lib/concreto.ts`: aceitar `aferidoDireto` (líquido do registro) para não depender da leitura ao vivo da balança.
- Nova função de referência compartilhada (`referenciaConferencia`) devolvendo `{ kg, origem: "carta_traco" | "nf", tolerancia }`, consumida por `dashboard-conferencia.tsx` e `dashboard-conferencia-material.tsx`.
- `src/components/estratificacao-dialog.tsx`: bloco de memória de cálculo da carta de traço.
- Correção retroativa via UPDATE nos registros concluídos com `traco_id`, sem mudança de schema.
