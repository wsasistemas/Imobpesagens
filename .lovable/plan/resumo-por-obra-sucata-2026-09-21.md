# Resumo por obra (sucata)

Nova aba dentro do menu Sucata com um painel de acompanhamento por obra: peso total, valor total e quantidade de processos concluídos.

## Como fica na tela

Na tela de Sucata surgem duas abas no topo:

- **Processos** — a lista atual, sem alteração.
- **Resumo por obra** — o novo painel.

No Resumo por obra:

- Três indicadores no topo (total geral do escopo visível): peso total em toneladas, valor total em reais e nº de processos concluídos.
- Tabela por obra, ordenada do maior peso para o menor: Obra | Processos concluídos | Processos em andamento | Peso aferido (t) | Valor total (R$) | Valor médio por tonelada.
- Gráfico de barras horizontais por obra (peso em t), no mesmo padrão visual já usado no gráfico de contratantes.
- Filtro de período (mês atual, últimos 3 meses, ano, tudo) usando a data de entrada do processo.
- Respeita a obra selecionada no seletor do topo: em "Todas as obras" mostra todas as obras permitidas ao usuário; com uma obra selecionada, mostra apenas ela.
- Estado vazio claro quando não há processos no período.

Números atuais na base (todos os períodos): INFRAESTRUTURA 19.646 kg / R$ 6.286,72 / 1 concluído; CONDOMINIO ARTE BOTANICA 19.420 kg / R$ 6.214,40 / 1 concluído.

## Acesso

Visível para Coordenador, Administrador, SuperAdmin, Contabilidade e Administrativo de Obra — mesmo acesso de leitura que já existe hoje no menu Sucata. Processos excluídos logicamente ficam fora do resumo.

## Detalhes técnicos

- `src/lib/sucata/sucata-queries.ts`: nova `resumoPorObraQueryOptions(obraId, inicio, fim)` selecionando apenas `obra_id, fase, situacao, entrada_em, peso_aferido_kg, valor_total, concluido_em, excluido_em`, com filtro `excluido_em is null`, `.eq("obra_id")` quando houver obra, paginação em lotes de 500 e `staleTime` de 60s. Agregação por obra em memória, cruzando com `obrasQueryOptions` para o nome.
- Nova rota `src/routes/sucata.resumo.tsx` (`createFileRoute("/sucata/resumo")`) com `head()` próprio, dentro de `AppShell` com `menu="sucata"`.
- Novo componente `src/components/sucata/resumo-por-obra.tsx` com os KPIs (`Kpi` de `@/components/kpi-card`), a tabela (`CLASSE_NUM` para números) e o `BarChart` horizontal do recharts.
- Abas em `src/routes/sucata.index.tsx` e `sucata.resumo.tsx` como dois `Link` estilizados (`/sucata` e `/sucata/resumo`), sem mudar a lista existente.
- Sem migração de banco e sem alteração de RLS: o RLS atual de `sucata_processos` já limita as obras visíveis por coligada.
