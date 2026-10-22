# Plano — design system do Imobenviomassa no Portal de Pesagem

Mockup aprovado em 22/10/2026: `docs/mockups/design-system-imobenviomassa.html`.

## Decisões do Wagner (22/10/2026)

| # | Ponto | Escolha |
|---|---|---|
| 1 | Tela de login (`/auth`) | A — mesma paleta azul/abóbora |
| 2 | Marca no menu lateral | B — logo WSA Sistemas |
| 3 | Fontes | A — Inter em tudo + IBM Plex Mono nos números (sai o Poppins) |
| 4 | Páginas públicas do sucateiro (`/coleta/aceite/*`) | A — paleta nova |

Fica como está: folha da NFA (`--nfa-*`), PDFs gerados (jsPDF), templates de e-mail, lógica, rotas, banco e permissões.

## Mapa de cores fixas → tokens

| Antes | Depois |
|---|---|
| `#B3282D`, `#B0202E`, `#A12429` | `primary` |
| `#8E1A25`, `#8F1A25`, `#7F1D2B`, `#4A1119` | `primary-dark` |
| `#FBEEEE`, `#FDE8EA`, `#FDF3F4` | `primary-soft` |
| `#6B1F1F`, `#8B1E1E` / `#F5E6E6` | `destructive` / `destructive/10` |
| `#171616`, `#2E2C2B`, `#454342`, `#2C3344`, `#334155`, `#475569` | `foreground` |
| `#716E6E`, `#64748B`, `#94A3B8` | `muted-foreground` |
| `#918D8A`, `#BFBBB7` | `dimmer` |
| `#EDEBE9`, `#E2E8F0` / `#D9D6D3`, `#CBD5E1` | `border` / `border-strong` |
| `#F7F6F5`, `#F8FAFC` | `muted` |
| `#1F6B4A`, `#2F6F52` / `#E1F0E7`, `#E7F0EA`, `#DCEEE1` | `success` / `success-soft` |
| `#35618C`, `#1F4E7A` / `#DCE7F0`, `#DCE6EC` | `info` / `info-soft` |
| Tailwind `emerald/green`, `amber`, `red`, `sky/blue`, `slate/gray` | `success`, `warning`, `destructive`, `info`, neutros |
| Paletas de gráfico (`PALETTE`, `fill="#..."`) | `var(--chart-1..5)` |

## Fase 1 — Tokens, fontes e tema

- [x] `src/styles.css`: `:root` e `.dark` copiados do Imobenviomassa; tokens novos (`primary-dark/soft`, `abobora*`, `success/warning/info-soft`, `dimmer`, `border-strong`); `shadow-card`, `shadow-brand`; variant `dark` = `&:where(.dark, .dark *)`
- [x] `brand-gradient`, `card-metal`, `label-brand` e botões premium no azul
- [x] Fontes: Inter 400–800 + IBM Plex Mono; sai o Poppins (`font-heading` passa a ser Inter)
- [x] `src/lib/tema.ts` (claro/escuro, `localStorage`) + script inline no `<head>` do `__root`

## Fase 2 — Menu lateral, cabeçalho e ícones

- [x] `@iconify/react` + `@iconify-json/{fluent-color,flat-color-icons,fluent-emoji-flat}` (dev)
- [x] `scripts/gerar-icones.mjs` (`npm run icones`) → `src/components/icones/icones.data.ts`
- [x] `src/components/icones/icone-colorido.tsx` (`IconeDoMenu`, `IconeIlustrativo`)
- [x] Logo WSA em `src/assets/wsa-logo.png` (do Imobenviomassa)
- [x] `app-sidebar.tsx`: sidebar clara, grupos 11px, item ativo em degradê azul → abóbora, ícones coloridos (inclusive submenus de Configurações), rodapé Recolher/Sair
- [x] `app-shell.tsx`: fundo, cabeçalho (sol/lua, avatar abóbora), rodapé sem grafite/vermelho
- [x] Página Inicial: cards com ícones coloridos e cores por token
- [x] `kpi-card.tsx` com tokens
- [ ] KPIs na Página Inicial (o mockup mostrava) — não feito: a Home não tem consulta de dados hoje

## Fase 3 — Cores fixas nas telas

- [x] Troca das cores Calper (tabela acima) em todos os `.tsx`, menos NFA/PDF/e-mail
- [x] Troca das cores Tailwind de estado pelos tokens
- [x] Login `/auth` e páginas públicas `/coleta/aceite/*`
- [x] `DESIGN_SYSTEM.md` atualizado
- [x] TypeScript (`tsc --noEmit`) sem erro; build de client e SSR ok (sem o `mcpPlugin`, que falha no Windows já antes da mudança)
- [ ] Conferência visual no navegador — não feito: local o SSR pede a chave da API do Lovable; conferir no preview do Lovable
