# Renomear botão "Exportar para Excel" na aba Conferências

## Objetivo
Renomear o botão de exportação da aba **Conferências** (Dashboard de recebimento) de **"Exportar para Excel"** para **"Gerar Relatorio Analitico"**, conforme indicado em anexo.

## Onde alterar
- Arquivo: `src/components/dashboard-conferencia.tsx`
- Local: botão ao lado do filtro de busca, linha ~456

## Mudança
```text
Antes:
<FileSpreadsheet className="mr-2 h-4 w-4" /> Exportar para Excel

Depois:
<FileSpreadsheet className="mr-2 h-4 w-4" /> Gerar Relatorio Analitico
```

## Regras
- Apenas renomear o rótulo do botão.
- Manter ícone, estilo, comportamento de exportação CSV e nome do arquivo (`conferencia-AAAA-MM-DD.csv`).
- Nenhuma alteração nas colunas exportadas, filtros, KPIs ou gráficos.
