# Período Ano em Conferências: esconder Competência e agrupar mês a mês

## Comportamento aprovado

- Ao clicar no botão **Ano** na aba **Conferências**:
  - O campo **Competência** no topo do Dashboard é **ocultado** (o filtro mensal deixa de valer na visão anual).
  - O quadro comparativo passa a exibir os registros **agrupados por mês**, do mês mais recente para o mais antigo, com uma linha de cabeçalho por mês e os lançamentos daquele mês logo abaixo.
- Nos períodos **Hoje, Semana, Mês, Personalizado** nada muda: a Competência reaparece com o valor anterior e a listagem segue como hoje.
- KPIs, gráfico, fornecedores, busca e exportação continuam usando exatamente o mesmo conjunto filtrado.

## Visual dos grupos (igual ao print)

```text
┌──────────────────────────────────────────────────────────────┐
│ Período / Registros        Data   Fornecedor   Entrada  ...  │  ← cabeçalho da tabela
├──────────────────────────────────────────────────────────────┤
│ ⌄  set/2026        ( 👥 42 )                                 │  ← linha de grupo, fundo cinza claro
├──────────────────────────────────────────────────────────────┤
│      10/09/2026   IGUÁ RIO DE JANEIRO   29,140 t   ...  OK   │
│      10/09/2026   D'ANGELOS AREAL       29,990 t   ...  OK   │
├──────────────────────────────────────────────────────────────┤
│ ⌄  ago/2026       ( 👥 37 )                                  │
├──────────────────────────────────────────────────────────────┤
│      05/08/2026   IBRATA MINERACAO      23,900 t   ...  OK   │
└──────────────────────────────────────────────────────────────┘
```

Especificação visual:

- **Linha de grupo**: ocupa toda a largura da tabela, fundo neutro claro (`bg-muted/40`), borda inferior sutil, altura confortável para o dedo no celular.
- **Seta de recolher** (chevron) à esquerda, girando 90° ao expandir/recolher. Todos os meses começam **expandidos**.
- **Rótulo do mês** em `set/2026` (mês abreviado em minúsculas + ano), tipografia de título, numerais tabulares.
- **Selo de contagem** ao lado: pílula arredondada com borda fina, ícone de registros e o número de lançamentos do mês (ex.: `42`).
- **Total do mês** alinhado à direita da mesma linha, em texto discreto: quantidade de toneladas conferidas e divergentes do mês.
- **Linhas de detalhe** recebem um recuo à esquerda para reforçar a hierarquia sob o mês.
- Cores e tipografia vêm dos tokens já usados no portal (vermelho institucional só em marca/ação, status na tríade âmbar/verde/vinho com texto).
- No celular, a linha de grupo fica fixa no topo ao rolar dentro do mês (sticky), para o usuário sempre saber em qual mês está.

## Implementação

### 1. Ocultar a Competência no modo Ano — `src/routes/dashboard.tsx`

- Estado `periodoConferencia` no Dashboard, alimentado por um callback `onPeriodoChange` de `DashboardConferencia`.
- Quando o período for `ano`, o bloco do campo Competência não é renderizado; o valor selecionado permanece guardado no estado.
- Indicadores e Fechamento Mensal continuam usando a competência efetiva com fallback do mês atual — sem regressão.

### 2. Agrupamento por mês — `src/components/dashboard-conferencia.tsx`

- Notificar o pai a cada troca de período.
- No modo `ano`:
  - Agrupar os registros filtrados por `YYYY-MM` da data de pesagem, ordenados do mais recente para o mais antigo.
  - Renderizar linha de grupo (chevron, rótulo, selo de contagem, totais) + linhas do mês, com estado de expandir/recolher por mês.
  - Manter ordenação por coluna, filtros de coluna, fornecedor, situação e busca funcionando dentro do conjunto anual.
  - Paginar por **grupos de meses** (3 meses por página) para não quebrar o agrupamento.
- Gráfico do modo Ano continua agregando por mês.

### 3. Exportação

- No modo Ano, a exportação Excel ganha coluna **Mês** e mantém a ordem mês a mês.

## Fora de escopo

- Sem alteração de banco, permissões ou regras de tolerância.
- Sem mudança no seletor nativo de mês (ele apenas não aparece no modo Ano).
- Indicadores e Fechamento Mensal inalterados.

## Validação

- [ ] Clicar em **Ano** esconde a Competência e lista os meses do ano agrupados.
- [ ] Cabeçalho de cada mês mostra rótulo `mmm/aaaa`, selo de contagem e totais; a soma bate com os KPIs.
- [ ] Expandir/recolher mês funciona individualmente e todos começam abertos.
- [ ] Voltar para **Mês** reapresenta a Competência com o valor anterior.
- [ ] Filtros, busca, ordenação, paginação e exportação funcionam no modo Ano.
- [ ] Sem erros no navegador; teste visual em computador e celular.
