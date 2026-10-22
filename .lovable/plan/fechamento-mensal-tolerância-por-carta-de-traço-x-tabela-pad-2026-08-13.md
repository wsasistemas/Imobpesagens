# Fechamento Mensal: tolerância por carta de traço x tabela padrão

## Diagnóstico confirmado (consulta ao banco)

As duas notas do anexo (039993 e 039974 — CONCREVIT) estão gravadas assim:

- `base_calculo = carta_traco`
- `traco_id` preenchido (mesma carta para as duas)
- `tolerancia_aplicada = 4` e `status_afericao = conforme`

Ou seja, o dado correto já está no registro. O erro é de leitura na tela do
**Fechamento Mensal**: essa tela não usa o resolvedor único de tolerância
(`resolverToleranciaDaPesagem`), já adotado na Estratificação. Ela ainda:

1. Ignora a carta de traço — classifica sempre pela descrição do material.
2. Usa a tabela **antiga** de tolerâncias por material (onde "Concreto" = 3% e
   descrição vazia/"." cai em categoria de 1%), em vez da **TABELA PADRÃO** de
   tolerâncias com os overrides por fornecedor.

Resultado visível no anexo: "tolerância ±1%" e as duas notas marcadas como
**Abaixo**, quando pela carta (±4%) as diferenças de −1,24% e −2,10% são **OK**.

## Regra a ser aplicada (a mesma do resto do sistema)

```text
registro com CARTA DE TRAÇO (base_calculo = carta_traco ou traco_id)
    tolerância = cadastro da carta (traço → tolerancia_peso;
                 se vazio, tolerância padrão do fornecedor de concreto)
registro por itens da NF / peso NF
    tolerância = override do fornecedor para a categoria
                 → senão TABELA PADRÃO da categoria
                 → senão tolerância geral
```

## O que muda na tela

1. **Tabela por fornecedor (por obra/contratante)**
   - A situação de cada fornecedor passa a ser calculada com a tolerância
     resolvida registro a registro; a coluna de tolerância exibe o valor
     efetivo e, quando o fornecedor é misto, a faixa (ex.: "±2 a ±4%").
   - Selo de origem: "carta de traço" ou "tabela padrão / fornecedor".

2. **Diálogo "Notas fiscais — {fornecedor}"** (a tela do anexo)
   - Cartão **DIFERENÇA** mostra a tolerância que realmente vale para aquelas
     notas (±4% no caso CONCREVIT) com o rótulo de origem.
   - Cada linha da tabela é classificada pela tolerância do seu próprio
     registro, então as duas notas passam a aparecer como **OK**.
   - A estratificação aberta pelo "Detalhar" recebe a mesma tolerância,
     eliminando divergência entre telas.

3. **KPIs, gráficos e Ranking de diferenças**
   - Tolerância média ponderada e a classificação OK/Abaixo/Acima passam a usar
     a tolerância resolvida por registro. Cargas de concreto dentro da faixa da
     carta deixam de contar como divergentes.

4. **Exportação CSV**
   - Ganha as colunas "Tolerância %" e "Origem da tolerância".

## Detalhes técnicos

- `src/components/dashboard-fechamento-mensal.tsx`:
  - Trocar `useTolerancias` (tabela antiga `tolerancias_material`) por
    `useToleranciasPadrao` + `useGerenciamentoFornecedores` +
    `useOverridesFornecedor` de `@/lib/tolerancias-heranca`.
  - Carregar `fornecedores_concreto` com `tracos` (mesma query da
    Estratificação) para obter `tolerancia_peso` da carta / `tolerancia_padrao`
    do fornecedor de concreto; montar um mapa `traco_id → tolerância`.
  - Chamar `resolverToleranciaDaPesagem(p, ctx)` por pesagem e guardar
    `{ pct, origem }` num mapa `pesagem.id → tolerância`.
  - Agregação por fornecedor: situação por soma de kg conformes/divergentes
    usando a tolerância de cada registro; a linha guarda `tolMin`, `tolMax` e a
    origem predominante para exibição. `situacaoDe` continua, mas recebe a
    tolerância resolvida (fim do `?? 3` fixo).
  - `NotasFornecedorDialog` recebe o mapa de tolerâncias e usa
    `tolPorPesagem[p.id]` em cada linha e no `montarLinhaEstratificacao`.
- Sem alteração de schema, sem migração e sem recálculo: os valores já estão
  persistidos nos registros.
- Validação: abrir o Fechamento Mensal do período das notas 039993/039974 e
  confirmar ±4% no cartão DIFERENÇA e situação **OK** nas duas linhas; conferir
  um fornecedor de granel (sem carta) e verificar que segue a tabela padrão /
  override do fornecedor.
