# Tolerância correta por origem: Carta de Traço x Itens da NF

## Diagnóstico confirmado

Consultei o registro da NF 000125057 (ENGEMIX) no banco:

- `base_calculo = carta_traco`
- `peso_esperado = 18.417,44 kg`
- `tolerancia_aplicada = 4` (a carta ENGEMIX 6221995)
- `resultado_afericao.tol = 4`

Ou seja, o dado correto já está gravado. O erro é só de leitura na tela: o cartão
**DIFERENÇA** da Estratificação calcula a tolerância exibida sempre pela tabela de
tolerâncias por material (padrão/override do fornecedor), ignorando a carta de traço.
Por isso aparece "Tolerância aplicada ±2,00%" enquanto a Memória de cálculo, que já
lê a tolerância da carta, mostra corretamente ±4%.

## Regra a ser aplicada (única, em todo o sistema)

```text
se a base do peso esperado é CARTA DE TRAÇO
    tolerância = tolerância da carta selecionada
                 (traço → tolerancia_peso; se vazio, tolerância padrão do fornecedor de concreto)
senão (peso por itens da NF / peso NF)
    tolerância = override do fornecedor para a categoria do material
                 se não houver → tolerância da tabela PADRÃO da categoria
                 se não houver categoria → tolerância geral do filtro
```

## O que muda na tela

1. **Estratificação — cartão DIFERENÇA**
   - Passa a exibir a tolerância da carta quando a origem for carta de traço.
   - Ganha um selo de origem embaixo do valor: "tolerância da carta de traço" ou
     "tolerância por material — {fornecedor|padrão}", para o usuário saber de onde veio.
   - O status (OK / Abaixo / Acima) e o comparativo por item usam essa mesma tolerância,
     eliminando qualquer divergência entre o cartão e a Memória de cálculo.

2. **Memória de cálculo**
   - Mantém o comportamento atual (já correto) e passa a receber a tolerância resolvida
     pela mesma função, para não haver dois caminhos de cálculo.

3. **Conferência e Fechamento Mensal**
   - As linhas de registros com carta de traço passam a ser classificadas pela tolerância
     da carta, e não pela tolerância geral do filtro. Registros por itens da NF seguem a
     regra de herança (override do fornecedor → padrão).
   - Efeito prático: cargas de concreto dentro da faixa da carta deixam de ser marcadas
     indevidamente como divergentes nos KPIs, gráficos e rankings.

## Detalhes técnicos

- Criar um resolvedor único, `resolverToleranciaDaPesagem(pesagem, contexto)`, em
  `src/lib/tolerancias-heranca.ts`, retornando `{ pct, origem: "carta_traco" | "fornecedor" | "padrao" | "geral", rotulo }`.
  Precedência: `tolerancia_aplicada` / `resultado_afericao.tol` / `traco.tolerancia_peso` /
  `fornecedor_concreto.tolerancia_padrao` quando `base_calculo = carta_traco`; caso contrário
  `resolverTolerancia(categoria, fornecedor, ...)` já existente, com fallback no valor do filtro.
- `src/components/estratificacao-dialog.tsx`:
  - `montarLinhaEstratificacao` passa a usar o resolvedor (hoje só usa `ref.tol` quando
    presente e cai no `toleranciaPct` global).
  - `dados.tolAplicada` (linha 160) deixa de sobrescrever a tolerância da carta pela
    tabela de material; o cartão DIFERENÇA (linha 322) exibe `pct` + rótulo de origem.
- `src/components/dashboard-conferencia.tsx` e `src/components/dashboard-fechamento-mensal.tsx`:
  passam o mesmo resolvedor ao montar as linhas, para KPIs/gráficos coerentes.
- Sem alteração de schema e sem recálculo de registros: os valores já estão persistidos.
- Validação: abrir a estratificação da NF 000125057 e confirmar ±4,00% no cartão DIFERENÇA
  e status coerente com a Memória de cálculo; conferir um registro de granel (sem carta)
  para garantir que continua usando padrão/override.
