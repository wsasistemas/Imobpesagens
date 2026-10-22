# Design System — Portal de Pesagem

Desde 22/10/2026 o portal usa o design system do **Imobenviomassa**, copiado token a token de
`Imobenviomassa/src/styles.css`. Plano e decisões: `docs/plano-design-system-imobenviomassa.md`.
Mockup aprovado: `docs/mockups/design-system-imobenviomassa.html`.

## Cores (tokens em `src/styles.css`, `:root` e `.dark`)

| Token | Claro | Uso |
|---|---|---|
| `primary` / `primary-dark` / `primary-soft` | `oklch(0.55 0.11 250)` azul WSA | ação, links, série principal de gráfico |
| `abobora` / `abobora-soft` / `abobora-dark` | `oklch(0.8 0.11 62)` | destaque: menu ativo (degradê), avatar, botão do banner |
| `background` | `oklch(0.972 0.016 40)` coral bem claro | fundo das telas; cartões continuam brancos (`card`) |
| `sidebar` | `oklch(0.958 0.022 40)` | menu lateral claro |
| `success` / `warning` / `info` (+ `-soft`) | verde / âmbar / azul-petróleo | selos, KPIs, alertas |
| `destructive` | vermelho | **só** erro e exclusão |
| `muted-foreground`, `dimmer`, `border`, `border-strong` | neutros frios | texto secundário, bordas |
| `chart-1…5` | azul, abóbora, verde-água, marinho, coral | gráficos (Recharts usa `var(--chart-n)`) |

Regra: nada de cor fixa (`#B3282D`, `text-emerald-600`…) nas telas — use os tokens, senão o tema escuro quebra.
Exceções que seguem fixas: folha da NFA (`--nfa-*`), relatório fotográfico A4, PDFs (jsPDF) e e-mails.

## Tema escuro

Botão sol/lua no cabeçalho (`src/lib/tema.ts`). Classe `dark` no `<html>`, escolha no `localStorage`
(`imobpesagens:tema`), padrão claro. `SCRIPT_TEMA` roda no `<head>` antes de pintar.

## Tipografia

Inter 400–800 em tudo (`font-sans` e `font-heading`) e IBM Plex Mono nos números (`font-mono`). Google Fonts no `__root.tsx`.

## Ícones

- Coloridos (Iconify `fluent-color`, `flat-color-icons`, `fluent-emoji-flat`) embutidos no bundle com `addIcon`.
- Para incluir: editar `scripts/gerar-icones.mjs` e rodar `npm run icones` (gera `src/components/icones/icones.data.ts`).
- `IconeDoMenu id="pesagem"` — menu lateral e cards da Página Inicial.
- `IconeIlustrativo icon={Recycle}` — ícone de título/KPI: troca o Lucide pelo colorido equivalente.
- Botões de ação continuam com Lucide de linha.

## Layout

- Menu lateral claro (`app-sidebar.tsx`): logo WSA, grupos com título 11px maiúsculo, item 13.5px, ativo em degradê
  `primary` → `abobora` com `shadow-brand`.
- Cabeçalho (`app-shell.tsx`): seletor de obra, sol/lua, pílula do usuário com avatar abóbora.
- Cartões: `rounded-xl border bg-card shadow-card`. Botões `rounded-lg`; primário com `shadow-brand`.
- Utilitários: `shadow-card`, `shadow-brand`, `brand-gradient` (banner azul → abóbora), `card-metal` (cartão de atalho).
