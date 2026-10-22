# Plano robusto — recuperação consolidada das pesagens

## Diagnóstico confirmado na base

Existem **152 registros**, todos vinculados a uma obra (`obra_id`) e sem registros órfãos.

| Coligada | Obra cadastrada | Registros | Situação |
|---|---|---:|---|
| 01 | INFRAESTRUTURA | 5 | deve aparecer no histórico e dashboards consolidados |
| 124 | CONDOMINIO ARTE JARDIM | 17 | deve aparecer no histórico e dashboards consolidados |
| 125 | CONDOMINIO ARTE BOTANICA | 50 | aparece atualmente |
| 126 | CONDOMINIO ARTE DESIGN | 12 | deve aparecer no histórico e dashboards consolidados |
| 127 | CONDOMINIO ARTE WAVE (CONECTA) | 68 | deve aparecer no histórico e dashboards consolidados |
| 128 | CONDOMINIO ARTE WOOD | 0 | cadastro sem pesagens |

Distribuição por status com peso disponível:

- **INFRAESTRUTURA:** 5 concluídas.
- **ARTE JARDIM:** 14 concluídas, 2 fechadas com ocorrência e 1 aguardando saída.
- **ARTE BOTANICA:** 46 concluídas, 2 fechadas com ocorrência, 1 aguardando saída e 1 aguardando saída com ocorrência.
- **ARTE DESIGN:** 9 concluídas, 1 fechada com ocorrência e 2 aguardando saída.
- **ARTE WAVE:** 67 concluídas e 1 fechada com ocorrência.

### Inconsistências encontradas

A NF **205959**, placa **GPM6773**, possui 2 registros vinculados à obra 125 — ARTE BOTANICA, mas com contratante textual incorreto:

1. Contratante `CONDOMINIO ARTE JARDIM`, status `aguardando_saida`.
2. Contratante `SUPERMIX CONCRETO S/A`, status `aguardando_saida_ocorrencia` — o fornecedor foi gravado como contratante.

Os outros **150 registros** já possuem correspondência correta entre o contratante histórico e o cadastro oficial da obra.

## Causa técnica

A opção **Todas as obras** usa o valor interno `__todas__`.

- No histórico de pesagens, esse valor já é convertido para consulta consolidada.
- No Dashboard e no relatório de ocorrências, ele ainda é enviado como se fosse um UUID de obra.
- Com isso, a consulta filtra por uma obra inexistente ou chama o resumo do Dashboard com um identificador inválido, ocultando as demais obras.
- Os dashboards internos recebem a lista já filtrada pela obra selecionada; portanto, Conferência, Fechamento Mensal e gráficos também ficam limitados.

## Correção a implementar

### 1. Padronizar o escopo de consulta

Criar uma conversão única do seletor:

```text
Obra específica → UUID da obra
Todas as obras  → null (sem filtro por obra)
```

Aplicar essa regra em:

- Histórico de pesagens.
- Dashboard de indicadores.
- Conferência por material.
- Conferência por fornecedor.
- Fechamento Mensal.
- Relatório de ocorrências.

### 2. Corrigir o Dashboard consolidado

- Carregar todas as pesagens permitidas pela segurança da base quando “Todas as obras” estiver selecionado.
- Não chamar o resumo RPC de obra específica no modo consolidado.
- Calcular KPIs e gráficos diretamente sobre a coleção consolidada no período escolhido.
- Manter a consulta RPC otimizada quando uma obra específica estiver selecionada.
- Exibir no subtítulo o escopo atual: **Todas as obras** ou o nome da obra selecionada.
- Disponibilizar filtro de obra dentro da visão consolidada quando necessário para conferência rápida.

### 3. Corrigir Histórico e Relatórios

- Garantir que “Todas as obras” retorne os **152 registros** antes dos filtros de data/status.
- Manter a coluna **Obra** visível no modo consolidado.
- Preservar o filtro padrão “Hoje”, mas mostrar claramente que ele limita a data — sem confundir ausência histórica com ausência na base.
- No relatório de ocorrências, converter o sentinela para consulta sem filtro de obra e exibir a obra de origem em cada linha/exportação.
- Continuar bloqueando novas pesagens enquanto “Todas as obras” estiver selecionado; gravação exige uma obra específica.

### 4. Normalizar os 2 registros inconsistentes

- Atualizar o contratante textual dos dois registros da NF 205959 para `CONDOMINIO ARTE BOTANICA`, mantendo `obra_id` 125.
- Registrar a correção em `pesagem_logs`, com data/hora, autor técnico e justificativa de normalização cadastral.
- Não excluir nem fundir automaticamente os dois registros: eles têm status distintos e qualquer deduplicação precisa respeitar o fluxo operacional e os logs.

### 5. Evitar novas divergências

- Ao salvar ou editar uma pesagem, persistir o nome oficial da obra selecionada no campo textual `contratante`, nunca o texto bruto do OCR.
- Usar o OCR apenas para identificar/sugerir a obra; após a seleção, o cadastro oficial passa a ser a fonte de verdade.
- Impedir que o emissor/fornecedor seja gravado no campo contratante.
- Manter `obra_id` como chave de filtro e agrupamento; `contratante` será apenas o rótulo histórico oficial.

## Validação de aceite

1. Selecionar **Todas as obras** no histórico e confirmar total-base de **152** registros antes dos filtros locais.
2. Confirmar as contagens por obra: **5 / 17 / 50 / 12 / 68**.
3. Alterar o período para abranger todo o histórico e validar as 5 obras no Dashboard.
4. Validar Indicadores, Conferência por Material, Conferência por Fornecedor e Fechamento Mensal com os mesmos registros consolidados.
5. Validar o relatório de ocorrências em modo consolidado e por obra.
6. Confirmar que a NF 205959 aparece vinculada e rotulada como ARTE BOTANICA.
7. Confirmar que Coordenadores permanecem somente leitura e que RLS/coligadas continuam limitando cada usuário às obras permitidas.
8. Testar seleção de obra específica para garantir que os totais individuais continuam corretos.
