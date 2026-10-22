# Por que as outras obras não aparecem (e como corrigir)

As correções de permissão (admin OU superadmin) já estão aplicadas no código. O que ainda impede você de ver as outras obras não é permissão nem dado: é **escopo de tela**.

Verificado na base agora:

- Os 153 registros estão distribuídos corretamente: Wave 68, Botânica 50, Jardim 18, Design 12, Infraestrutura 5.
- Todos são da competência 2026-08, e **apenas 6 registros são de hoje**.
- Seu usuário (admin + superadmin) tem acesso a todas as 6 coligadas; as políticas de leitura liberam todas.

Duas causas confirmadas no código:

1. **Obra selecionada fica gravada no navegador.** O seletor do topo restaura a última obra escolhida (Botânica). Com uma obra específica selecionada, a consulta do histórico e do dashboard filtra por aquela obra — logo, só ela aparece nos chips e no gráfico.
2. **O filtro de período do histórico começa em "Hoje".** Como só 6 registros são de hoje, o grid (e a faixa de chips, que hoje respeita o período) mostra quase nada.

## Correções

**Seletor de obra (topo)**
- Quando o usuário tem acesso a mais de uma obra e ainda não fez uma escolha explícita, iniciar em **"Todas as obras"** (visão consolidada) em vez da primeira obra.
- Manter a escolha do usuário quando ele selecionar uma obra específica.

**Histórico de Pesagem**
- A faixa "Registros por obra" passa a contar **todos os registros carregados** (independente do filtro de período e do filtro de coluna Obra), com total geral — assim os números batem com os 153 do escopo consolidado.
- Clicar no chip aplica o filtro da coluna Obra **e** alterna o período para "Todo o período", garantindo que os registros daquela obra realmente apareçam; clicar de novo limpa e volta o período anterior.
- No estado vazio com período "Hoje", deixar explícito que existem registros anteriores e manter o atalho "Ver todo o período".

**Dashboard**
- Manter o cartão "Registros por obra" (barras horizontais, quantidade e tonelagem, crescente).
- Na visão de obra única, exibir um aviso curto no cartão: "mostrando apenas <obra>; selecione 'Todas as obras' para o consolidado".

## Detalhes técnicos

- `src/components/app-shell.tsx`: no efeito de seleção inicial, usar `TODAS_OBRAS` como padrão quando `obras.length > 1` e não houver seleção salva; preservar `loadObraAtualId`.
- `src/routes/pesagem.tsx`: `resumoObras` deixa de aplicar `dentroDoPeriodo` (agrega sobre `linhasGrid`); handler do chip seta `filtrosLista["Obra"]` e `setPeriodo("tudo")`, com restauro ao desmarcar.
- `src/routes/dashboard.tsx`: manter `porObra`; adicionar nota condicional quando `!visaoConsolidada`.
- Nenhuma alteração de banco e nenhuma mudança em regras de permissão (já corrigidas).
