# Paginação no Quadro comparativo: Pesagem × Nota Fiscal

## Objetivo
Exibir no máximo **30 registros por página** na tabela do Quadro comparativo (Conferência → Por fornecedor), com passador de páginas e contador de registros.

## Como ficará

```text
┌───────────────────────────────────────────────────────────────┐
│ Quadro comparativo: Pesagem × Nota Fiscal                      │
│ ... 30 linhas ...                                              │
├───────────────────────────────────────────────────────────────┤
│ Mostrando 1–30 de 128 registros   [‹ Anterior] 1 2 3 5 [Próx ›]│
└───────────────────────────────────────────────────────────────┘
```

- Rodapé fixo abaixo da tabela, dentro do mesmo card.
- Contador: "Mostrando X–Y de N registros" (N = total já filtrado).
- Passador: botões Anterior/Próxima + números de página (com reticências quando houver muitas páginas), página atual destacada em vermelho Calper.
- Rodapé aparece apenas quando houver mais de 30 registros; o contador sempre aparece quando houver registros.
- A mensagem de registros sem pesagem de saída continua abaixo do rodapé.

## Comportamento
- A página volta para 1 sempre que mudar: período/competência, fornecedor, situação, busca ou tolerância.
- Se a lista encolher e a página atual ficar vazia, ajusta automaticamente para a última página válida.
- KPIs, gráficos e **exportação CSV continuam considerando todos os registros filtrados**, não apenas a página exibida.
- Nenhuma mudança em cálculo, tolerância ou banco de dados — apenas apresentação.

## Detalhes técnicos
- Arquivo único: `src/components/dashboard-conferencia.tsx`.
- Novo estado `pagina` e constante `POR_PAGINA = 30`; `useMemo` `paginadas = filtradas.slice((pagina-1)*30, pagina*30)` usado no `.map` do `<tbody>`.
- `useEffect` reseta `pagina` quando `filtradas.length` ou os filtros mudam.
- Rodapé com `Button` (variant ghost/outline) do shadcn e ícones `ChevronLeft`/`ChevronRight`; cores por tokens semânticos (`primary`, `muted-foreground`).
- `colSpan={12}` do estado vazio permanece inalterado.
