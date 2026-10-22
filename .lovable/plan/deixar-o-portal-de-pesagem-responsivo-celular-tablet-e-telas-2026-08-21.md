# Deixar o Portal de Pesagem responsivo (celular, tablet e telas grandes)

## Objetivo

Hoje as telas foram desenhadas para monitor de desktop largo. Em celular, tablet ou notebook de tela pequena o usuário precisa dar zoom (ou reduzir o zoom do navegador) para conseguir ler e operar. O plano ajusta apenas a apresentação (layout, tamanhos, quebras) — nenhuma regra de negócio, cálculo, tolerância ou permissão muda.

## O que muda para o usuário

### 1. Estrutura geral (cabeçalho, menu e rodapé)
- Menu lateral vira gaveta ("drawer") no celular, abrindo pelo botão do topo e fechando ao escolher a opção; no desktop continua exatamente como hoje.
- Cabeçalho: em telas estreitas o rótulo "Obra" e o nome do usuário recolhem, o seletor de obra passa a ocupar a largura disponível (sem cortar o texto da obra) e o avatar/menu do usuário fica sempre acessível.
- Rodapé com menos margem no celular, empilhado em duas linhas.
- Conteúdo das páginas: margens menores no celular (p-3) e crescentes até o desktop, aproveitando também telas muito largas.

### 2. Tela de Pesagem
- Botões grandes "Entrada (bruto)" / "Saída (tara)" passam a ocupar 100% da largura em duas colunas no celular, mantendo o tamanho de toque confortável.
- Cards de Peso / Nota / Evidência empilham em uma coluna no celular, duas no tablet e três no desktop (hoje já são três em `lg`, mas o miolo interno quebra).
- Blocos internos de 2, 3 e 4 colunas passam a 1 coluna no celular e 2 no tablet.
- Barra de filtros do histórico (período, contratante, busca, seleção, Excel) vira empilhada e com campos de largura fluida no celular, em vez de larguras fixas de 240/280px que hoje estouram a tela.
- Grid de histórico: mantém o scroll horizontal e a coluna Placa congelada, mas ganha altura e fonte adaptadas; no celular a rolagem horizontal fica explícita (indicador de "arraste para o lado") e a paginação empilha.

### 3. Dashboard e Conferências / Fechamento Mensal
- Cartões de KPI: 1 coluna no celular, 2 no tablet, layout atual no desktop.
- Abas (Indicadores, Conferências, Fechamento, Concreto) ganham rolagem horizontal com toque, sem cortar nem espremer os nomes.
- Gráficos passam a usar altura responsiva (menor no celular) e os rótulos/legendas reduzem para não sobrepor.
- Tabelas de fechamento e ranking: rolagem horizontal com cabeçalho fixo e primeira coluna congelada, seguindo o mesmo padrão do histórico.

### 4. Configurações e Relatórios
- A fileira de 11 abas de Configurações passa a rolar horizontalmente no celular (hoje quebra e desalinha).
- Formulários (Obras, Operadores, Perfis, Permissões, Tolerâncias, Concreto) empilham campos em uma coluna no celular; a matriz de Permissões por Menu ganha rolagem horizontal com a coluna de menu congelada.
- Tela de Ocorrências: filtros empilhados e cartões em coluna única no celular.

### 5. Diálogos (modais)
- Todos os modais (editar registro, detalhes, itens da nota, logs, estratificação, visualizador de nota) passam a ocupar quase toda a tela no celular com rolagem interna, em vez de largura fixa que hoje sai da área visível.
- O visualizador de nota (PDF/imagem) mantém lupa, zoom e rotação; os botões da barra passam a rolar horizontalmente no celular.

### 6. Login e Meu Perfil
- Cartões centralizados com largura fluida e espaçamentos menores no celular.

## Detalhes técnicos

- Abordagem: Tailwind mobile-first. Base para celular, refinamentos em `sm:`, `md:`, `lg:`, `xl:` e `2xl:`. Nenhuma dependência nova.
- Substituir larguras fixas (`w-[240px]`, `w-[280px]`, `w-[200px]`, `min-w-[...]` em filtros) por `w-full sm:w-[...]`.
- Aplicar o padrão de linha responsiva já usado no projeto: contêineres de texto com `min-w-0` + `truncate`, ícones com `shrink-0`, cabeçalhos em `grid-cols-[minmax(0,1fr)_auto]` promovendo para `flex` em `sm:`.
- Sidebar: usar o comportamento móvel nativo do componente `Sidebar` (`useIsMobile` já existe em `src/hooks/use-mobile.tsx`) e fechar a gaveta ao navegar em `src/components/app-sidebar.tsx`.
- Tabelas: envolver em `div` com `overflow-x-auto` + `-mx-3 px-3` no celular, mantendo `sticky` das colunas congeladas e `overscroll-x-contain`.
- Gráficos (Recharts): trocar alturas fixas por classes responsivas (`h-[220px] sm:h-[280px] lg:h-[320px]`), reduzir `fontSize` dos eixos no celular e ocultar rótulos densos abaixo de `sm`.
- Modais: `DialogContent` com `w-[calc(100vw-1rem)] max-w-[...] max-h-[92vh] overflow-y-auto` e `sm:` para os valores atuais.
- Arquivos afetados (apenas apresentação): `src/components/app-shell.tsx`, `src/components/app-sidebar.tsx`, `src/routes/pesagem.tsx`, `src/routes/dashboard.tsx`, `src/routes/configuracoes.tsx`, `src/routes/relatorios.ocorrencias.tsx`, `src/routes/auth.tsx`, `src/routes/meu-perfil.tsx`, `src/components/dashboard-conferencia.tsx`, `src/components/dashboard-fechamento-mensal.tsx`, `src/components/dashboard-concreto.tsx`, `src/components/dashboard-tolerancias.tsx`, `src/components/estratificacao-dialog.tsx`, `src/components/visualizador-arquivo-dialog.tsx`, `src/components/cadastro-obras.tsx`, `src/components/cadastro-perfis.tsx`, `src/components/permissoes-menu.tsx`, `src/components/logs-pesagem-dialog.tsx`, `src/components/ocorrencia-detalhe-dialog.tsx`, `src/components/kpi-card.tsx`.
- Validação: conferir 390px (celular), 768px (tablet), 1280px e 1920px, checando ausência de rolagem horizontal na página (a rolagem fica restrita às tabelas) e legibilidade sem zoom.

## Observação

A operação de pesagem em si (Web Serial com a balança) depende de navegador desktop compatível; no celular a tela ficará legível e utilizável para consulta, edição e evidências, mas a conexão com a balança permanece como hoje.
