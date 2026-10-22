# Ordenação + filtro com ícones em todas as colunas do histórico

## Objetivo
Padronizar o cabeçalho do grid de histórico (área marcada em vermelho): toda coluna passa a ter **ordenação** e **filtro** por ícones, com o **título sempre em uma única linha**, no estilo UI/EX com as cores da marca Calper.

## Como ficará o cabeçalho

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ Data ⇅ ▽ │ Obra ⇅ ▽ │ Contratante ⇅ ▽ │ Situação ⇅ ▽ │ Sinal Tolerância ⇅ ▽ │
└──────────────────────────────────────────────────────────────────────────┘
```

- Título em **uma linha única** (sem quebra "Sinal / Tolerância", "Peso / Calculado" etc.), com `truncate` + tooltip quando o texto for maior que a coluna.
- Dois ícones discretos à direita do título:
  - **Ordenar** — `ArrowUpDown` (neutro) → `ArrowUp` (asc) → `ArrowDown` (desc) → volta ao neutro.
  - **Filtrar** — `Filter` (contorno) / `Filter` preenchido + badge com a contagem quando ativo.
- Ícones ficam em cinza suave e só aparecem no hover da célula; quando ativos, ficam em **vermelho Calper (`--primary`)** e permanentemente visíveis.
- Coluna com ordenação ativa recebe fundo `bg-primary/5` e o título em `text-primary`, deixando óbvio o critério atual.
- Clique no título também ordena (atalho); clique no funil abre o popover de filtro já existente.
- Transições suaves de 150–200 ms, `animate-scale-in` no popover (padrão já usado), foco visível por teclado (acessível).

## Colunas contempladas
Todas as colunas do grid, incluindo as que hoje não têm nada:

| Coluna | Filtro | Ordenação |
| --- | --- | --- |
| Data | faixa de datas (de/até) | data/hora |
| Obra, Contratante, Situação, Sinal Tolerância, Transportadora, Fonte, Usuário | lista com busca | alfabética |
| Nota, Placa, Carreta, Modelo/Marca, Descrição do produto | texto "contém" | alfabética |
| Qtd/Peso NF, Peso Calculado, Peso Carta Traço, Valor NF, Entrada, Saída, Líquido | faixa numérica | numérica |
| Duração | faixa (minutos) | numérica |
| Ações | — (mantém apenas o checkbox de seleção) | — |

Regra permanente: **toda nova coluna criada na visão já nasce com ordenação + filtro e título em uma linha**, por construção do componente de cabeçalho.

## Comportamento
- Uma coluna ordenada por vez; ordenação se aplica ao conjunto **já filtrado** e reinicia a paginação na página 1.
- Empates e valores vazios vão sempre para o final.
- Ordenação e filtros permanecem enquanto o usuário navega na tela (não persistem entre sessões).
- Coluna **Placa congelada** e o scroll horizontal continuam funcionando igual.
- Nenhuma alteração de banco de dados nem de regras de negócio — apenas apresentação e ordenação em tela.

## Detalhes técnicos
- `src/components/grid-filtro-coluna.tsx`: evoluir `ColunaFiltro` para `CabecalhoColuna`, aceitando props opcionais `ordenacao` (`"asc" | "desc" | null`) e `onOrdenar`, além de `tipo: "data"` e `tipo: "nenhum"` (só ordenação). Título passa a `whitespace-nowrap truncate` com `title`.
- `src/routes/pesagem.tsx`: estado `ordenacao: { coluna, direcao } | null`; comparadores por coluna (texto `localeCompare pt-BR`, número, data) aplicados após os filtros e antes da paginação; todos os `th(...)` migrados para o novo cabeçalho, inclusive Data e Duração.
- Cores por tokens semânticos (`primary`, `muted-foreground`, `primary/5`) — nada de cor fixa.
