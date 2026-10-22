# Remover a aba "Por Material" das Conferências

## O que muda
- A sub-aba **Por Material** (dentro de Conferências, no Dashboard) deixa de existir.
- Conferências passa a abrir direto em **Por Fornecedor**, que fica como única visão.
- Como sobra apenas uma visão, a barra de sub-abas é removida e o conteúdo de Por Fornecedor é exibido diretamente.

## Detalhes técnicos
- `src/routes/dashboard.tsx`: remover o bloco `Tabs` interno (linhas ~241-264) e renderizar `DashboardConferencia` direto no `TabsContent value="conferencias"`; remover o import de `DashboardConferenciaMaterial`.
- `src/components/dashboard-conferencia-material.tsx` deixa de ser usado; será excluído do projeto.
- Nenhuma alteração de banco, cálculo ou permissões.
