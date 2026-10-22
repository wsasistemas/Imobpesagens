# Conferências — período Ano com meses sempre recolhidos

## Objetivo

Ao clicar no período **Ano**, todos os meses do quadro comparativo abrem **recolhidos** (só o cabeçalho visível: `set/2026`, selo de quantidade, total conferido e divergentes). O usuário clica no mês que deseja para expandir os registros — igual à tela de referência.

## Mudanças

**Arquivo único: `src/components/dashboard-conferencia.tsx`**

1. **Inverter o estado de expansão**: hoje o conjunto `mesesFechados` começa vazio, o que deixa todos os meses abertos. Substituir por `mesesAbertos` (também começando vazio): mês só mostra os registros se estiver nesse conjunto. A seta (chevron), o título do botão ("Expandir mês" / "Recolher mês") e a montagem das linhas da tabela passam a ler esse novo conjunto.
2. **Resetar ao trocar de período**: ao entrar ou sair do modo Ano (ou mudar ano/filtros), o conjunto volta a ficar vazio — os meses sempre reabrem recolhidos.
3. **Comportamento de clique inalterado**: clicar no cabeçalho do mês alterna expandir/recolher; 3 meses por página e demais períodos (Hoje, Semana, Mês, Personalizado) continuam exatamente como estão.

## Fora de escopo

- Nenhuma mudança em banco de dados, filtros, KPIs, gráfico ou exportação.
- Nenhuma mudança visual nos cabeçalhos de mês (já seguem o layout aprovado).

## Verificação

- TypeScript e build sem erros.
- No navegador: abrir Conferências → clicar em **Ano** → confirmar que todos os meses aparecem recolhidos e que o clique expande apenas o mês escolhido.
