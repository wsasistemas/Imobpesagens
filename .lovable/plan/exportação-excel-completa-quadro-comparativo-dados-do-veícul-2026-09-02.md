# Exportação Excel completa: Quadro comparativo + dados do veículo/transporte

## Objetivo
O botão **Exportar para Excel** (Conferências) hoje gera 11 colunas apenas do quadro comparativo. Passará a exportar também os dados de identificação do transporte que existem no grid de Histórico de Pesagem (placa, carreta, modelo, marca, transportadora, motorista e dados da nota).

## Como ficará a planilha

Uma única aba/arquivo, com blocos de colunas na seguinte ordem:

```text
| IDENTIFICAÇÃO ------------------------------- | TRANSPORTE ------------------------------------------- | PESAGEM / NF ----------------------------------------- |
Data | Nº Nota | Emissor | Contratante/Obra       | Transportadora | Placa | Carreta | Modelo | Marca | Motorista | UF | Entrada | Saída | Líquido | NF | Diferença | % | % Tolerância | Situação
```

Colunas finais mantidas do quadro atual: Fornecedor / Produto / Carta traço / Entrada (kg) / Saída (kg) / Líquido (kg) / NF (kg) / Diferença (kg) / Diferença (%) / Tolerância (%) / Situação.

Lista completa e ordem definitiva:
1. Data
2. Nº Nota
3. Emissor
4. Contratante (empreendimento)
5. Fornecedor (nome aglutinado)
6. Produto / Descrição
7. Carta traço (Carta traço / Padrão Calper / —)
8. Transportadora
9. Placa (cavalo)
10. Carreta
11. Modelo
12. Marca
13. Motorista
14. UF
15. Entrada (kg)
16. Saída (kg)
17. Líquido aferido (kg)
18. Declarado NF (kg)
19. Diferença (kg)
20. Diferença (%)
21. % Tolerância
22. Situação (OK / Acima da Tolerância / Sem NF)

## Regras
- Exporta **todos os registros filtrados** (período, contratante, fornecedor, situação, busca) — não apenas a página exibida, como já é hoje.
- Campos vazios saem como `—`.
- Números continuam em formato brasileiro (vírgula decimal), com BOM UTF-8 e separador `;` para abrir direto no Excel.
- Nome do arquivo: `conferencia-AAAA-MM-DD.csv`.
- Nenhuma mudança em cálculo, tolerância, KPIs, gráficos ou banco de dados.

## Detalhes técnicos
- Arquivo único: `src/components/dashboard-conferencia.tsx`, função `exportarCsv()` (linhas 306-325).
- Os dados novos já estão disponíveis em memória via `l.pesagem` (`numero_nota`, `emissor`, `contratante`, `transportadora`, `placa`, `carreta`, `modelo`, `marca`, `motorista`, `uf`, `traco_id`, `is_calper_fallback`) — nenhuma nova consulta ou coluna no banco.
- Reaproveitar o helper `baixarCsv` de `src/lib/exportar-csv.ts` no lugar do código de download duplicado.
