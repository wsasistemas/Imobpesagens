# Exportar Excel: Tolerâncias e Carta de Traço

Adicionar botão **Exportar para Excel** nas telas de cadastro, no mesmo padrão já usado em Conferência e Fechamento Mensal (arquivo CSV com BOM e separador `;`, abre direto no Excel).

## O que será entregue

### 1. Configurações → Tolerâncias
- Botão **Exportar para Excel** no topo do painel de tolerâncias.
- Exporta todas as tolerâncias cadastradas por fornecedor/categoria visíveis na tela: fornecedor, CNPJ, categoria/material, umidade (seco/úmido), % tolerância, observação e origem (padrão ou específica do fornecedor).
- Arquivo: `tolerancias-AAAA-MM-DD.csv`.

### 2. Configurações → Concreto (Carta de Traço)
- Botão **Exportar para Excel** no cabeçalho da tabela de traços.
- Colunas exportadas iguais às da tela: código, FCK, aplicação, slump, densidade teórica, consumo, densidade prática, % tolerância e keywords do item da NF.
- Também será exportada a tabela de fornecedores vinculados (razão social, CNPJ, tolerância padrão) na mesma planilha, em bloco separado, para o cadastro ficar completo.
- Arquivo: `carta-traco-AAAA-MM-DD.csv`.

## Detalhes técnicos

- `src/components/dashboard-tolerancias.tsx` e `src/components/dashboard-concreto.tsx`: nova função local `exportarCsv()` seguindo o padrão de `dashboard-conferencia.tsx` (linhas 265-280): array de header + rows, escape de aspas, join com `;`, `Blob` com `\uFEFF`, download via link temporário.
- Botão: `variant="outline"` com ícone `FileSpreadsheet` do lucide-react, mesmo texto "Exportar para Excel".
- Exporta exatamente os dados já carregados/filtrados em memória — nenhuma nova query, migração ou mudança de regra de negócio.
