# Declarado NF deve usar o mesmo peso da memória de cálculo

## Diagnóstico confirmado

Existem hoje **dois cálculos diferentes** para o mesmo registro:

- **Memória de cálculo** (dentro da estratificação): usa o cadastro de Densidades (Configurações › Densidades), inclusive a exceção por fornecedor e a densidade da carta de traço. É o valor correto do peso do item.
- **Declarado NF** (KPI, coluna do quadro comparativo, diferença, %, situação, KPIs e relatório analítico): recalcula o peso da NF **sem** consultar o cadastro de Densidades, caindo nas densidades internas antigas do código.

Resultado: a memória mostra um peso do item (ex.: densidade cadastrada) e o campo Declarado NF mostra outro (densidade genérica), então a diferença contra o aferido sai errada — exatamente o que aparece na tela anexada.

## O que será corrigido

1. O peso de referência da NF passa a aceitar o cadastro de Densidades (material + exceção por fornecedor) e a densidade da carta de traço, com a mesma precedência já usada na memória de cálculo:
   **carta de traço › exceção por fornecedor › densidade cadastrada do material › regra interna de fallback**.
2. O quadro comparativo Pesagem × Nota Fiscal passa a montar cada linha com esse resolvedor, de forma que **Declarado NF = Total declarado NF da memória de cálculo**, sempre.
3. Diferença (kg), %, Situação, filtros, KPIs e o Gerar Relatorio Analitico passam a usar esse mesmo valor — nada mais compara contra um peso calculado por densidade genérica.
4. O selo de origem do valor (CARTA / calculado / NF informada) continua sendo exibido, agora indicando também quando a densidade veio do cadastro ou de uma exceção de fornecedor.
5. Onde o cadastro de densidades não estiver carregado, o comportamento atual é mantido como fallback (nenhum registro fica sem valor).

Não haverá alteração de banco nem recálculo automático dos registros gravados: a correção é de apuração/apresentação. Os campos gravados continuam podendo ser atualizados pela aba Manutenção quando você quiser persistir os novos valores.

## Detalhes técnicos

- `src/lib/unidades.ts`: `pesoNfReferencia` e `calcularPesoNfDaPesagem` recebem um `ResolvedorDensidade` opcional e o repassam a `calcularPesoItem`; a densidade da carta (`resultado_afericao.rho`) continua com prioridade.
- `src/components/estratificacao-dialog.tsx`: `montarLinhaEstratificacao` recebe o resolvedor e a densidade da carta, e o valor de `linha.nf` passa a ser idêntico ao total da memória de cálculo.
- `src/components/dashboard-conferencia.tsx`: usa `useDensidades()` + `criarResolvedorDensidade` ao montar as linhas, KPIs e a exportação.
- `src/routes/dashboard.tsx` e `src/components/dashboard-fechamento-mensal.tsx`: mesma injeção do resolvedor nas chamadas de `pesoNfReferencia`, para o fechamento e os rankings ficarem coerentes com a estratificação.
