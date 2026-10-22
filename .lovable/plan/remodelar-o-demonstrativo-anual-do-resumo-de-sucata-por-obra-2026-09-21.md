# Remodelar o demonstrativo anual do Resumo de Sucata por Obra

## Objetivo

Ao selecionar **Ano** em **Sucata > Resumo por obra**, a tela passa a seguir o formato visual da aba **Conferências** mostrada no print, adaptando os títulos e números ao processo de sucata. Os demais períodos continuam com o comportamento atual.

## Visão da tela anual

```text
[ Período: Mês atual | Últimos 3 meses | ANO | Tudo ]

[ Peso total aferido ] [ Valor total ] [ Processos concluídos ] [ Total de processos ]

┌ Demonstrativo anual de sucata por obra ─────────────────────────────┐
│ Mês       Processos   Concluídos   Em andamento   Peso    Valor     │
│ > set/2026     4           3            1         22,4 t  R$ ...    │
│ > ago/2026     7           7            0         38,1 t  R$ ...    │
└─────────────────────────────────────────────────────────────────────┘

┌ Peso de sucata ao longo do tempo ───────────────────────────────────┐
│ [ Todas as obras ▾ ]                         [ Dia | Semana | Mês ] │
│                         gráfico de linha                            │
└─────────────────────────────────────────────────────────────────────┘
```

## 1. Indicadores anuais

Exibir quatro quadros no topo, calculados com os registros do ano corrente e respeitando a obra selecionada no menu superior:

1. **Peso total aferido** — toneladas e apoio em quilogramas.
2. **Valor total** — soma em reais.
3. **Processos concluídos** — quantidade concluída e indicação dos que permanecem em andamento.
4. **Total de processos** — soma de concluídos e em andamento.

Os quadros seguirão o mesmo alinhamento, proporção, cores de estado e hierarquia visual da referência.

## 2. Demonstrativo anual recolhido por mês

Substituir, somente no filtro **Ano**, a tabela simples por um demonstrativo mensal:

- meses do mais recente para o mais antigo;
- cada mês começa recolhido, como na aba Conferências;
- linha mensal com: **Mês, Total de processos, Concluídos, Em andamento, Peso aferido e Valor total**;
- ao abrir um mês, mostrar o detalhamento por obra com as colunas atuais: **Obra, Concluídos, Em andamento, Peso aferido, Valor total e Valor médio por tonelada**;
- rodapé informa quantos meses e processos estão sendo mostrados no ano;
- meses sem movimento não aparecem;
- estados de carregamento e ausência de dados permanecem claros.

## 3. Gráfico anual no padrão da referência

No modo **Ano**, trocar o gráfico de barras por um gráfico de linha chamado **Peso de sucata ao longo do tempo**:

- seletor **Todas as obras** ou uma obra específica;
- alternância **Dia, Semana e Mês**;
- linha mostra o peso aferido em toneladas ao longo do período;
- pontos, legenda e balões exibem data/período, peso e quantidade de processos;
- ao escolher uma obra no menu superior, o gráfico permanece limitado a ela;
- no celular, controles quebram de linha sem sobreposição e o gráfico mantém leitura horizontal.

Nos filtros **Mês atual**, **Últimos 3 meses** e **Tudo**, a tabela e o gráfico atuais permanecem inalterados.

## 4. Regras de dados e segurança

- Usar apenas os dados já consultados: obra, situação, data de entrada, peso aferido, valor total e conclusão.
- Excluir processos com exclusão lógica, como já ocorre hoje.
- Manter o acesso por obra e coligada já aplicado no banco.
- Não criar tabela, migração ou nova permissão.
- Todos os totais, linhas mensais, detalhes e gráfico usarão exatamente o mesmo conjunto anual filtrado.

## Arquivos previstos

- `src/components/sucata/resumo-por-obra.tsx` — indicadores, agrupamento mensal, expansão e gráfico temporal.
- `src/lib/sucata/sucata-queries.ts` — somente se necessário ajustar a tipagem ou a seleção explícita dos campos já existentes.

## Validação

- [ ] **Ano** mostra os quatro indicadores, incluindo **Total de processos**.
- [ ] Totais anuais conferem com a soma dos meses.
- [ ] Meses aparecem recolhidos e abrem o detalhamento por obra.
- [ ] Peso e valor do mês conferem com as obras abertas.
- [ ] Gráfico alterna corretamente entre Dia, Semana e Mês.
- [ ] Seletor do gráfico filtra por obra.
- [ ] Seletor superior de obra limita indicadores, tabela e gráfico.
- [ ] Outros períodos preservam o demonstrativo atual.
- [ ] Tela validada em computador e celular, sem sobreposição.
- [ ] Compilação e execução sem erros.
