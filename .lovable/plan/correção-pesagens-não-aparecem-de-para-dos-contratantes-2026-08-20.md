# Correção: pesagens não aparecem + DE → PARA dos Contratantes

## Diagnóstico (confirmado no banco)

- As **149 pesagens estão íntegras**, porém **todas foram gravadas na mesma obra**: CONDOMINIO ARTE JARDIM (coligada 124) — porque até agora existia só uma obra cadastrada.
- O campo **Contratante** foi salvo como **texto livre** e tem 12 variações diferentes (nomes de obra corretos, variações com acento, e até nomes de fornecedores gravados por engano).
- Resultado prático: ao abrir o sistema com 6 obras cadastradas, a tela seleciona a primeira obra em ordem alfabética (ARTE BOTANICA, com 0 registros) e o histórico aparece vazio, mesmo com os dados existindo na obra 124.

## DE → PARA: Contratante (texto atual) → Cadastro de Obras

Preencha a última coluna com a obra do cadastro (código da coligada) para cada texto. Onde já sugeri, basta confirmar.

| # | DE (contratante gravado) | Registros | Período | PARA (obra do cadastro) — sugestão |
| --- | --- | --- | --- | --- |
| 1 | CONDOMINIO ARTE CONECTA | 67 | 10–19/08 | 127 – CONDOMINIO ARTE WAVE (CONECTA) |
| 2 | CONDOMINIO ARTE BOTANICA | 44 | 10–19/08 | 125 – CONDOMINIO ARTE BOTANICA |
| 3 | CONDOMINIO ARTE JARDIM | 17 | 10–20/08 | 124 – CONDOMINIO ARTE JARDIM |
| 4 | CONDOMINIO ARTE DESIGN | 12 | 10–18/08 | 126 – CONDOMINIO ARTE DESIGN |
| 5 | CONDOMINIO ARTE BOTANICA RESIDENCIAL | 2 | 14–19/08 | 125 – CONDOMINIO ARTE BOTANICA |
| 6 | ARTE BOTÂNICA | 1 | 13/08 | 125 – CONDOMINIO ARTE BOTANICA |
| 7 | ARTE CONECTA | 1 | 12/08 | 127 – CONDOMINIO ARTE WAVE (CONECTA) |
| 8 | INFRAESTRUTURA | 1 | 17/08 | 01 – INFRAESTRUTURA |
| 9 | JA SOCIEDADE UNIPESSOAL LTDA | 1 | 17/08 | 01 – INFRAESTRUTURA |
| 10 | RAJA SOCIEDADE UNIPESSOAL | 1 | 19/08 | 01 – INFRAESTRUTURA |
| 11 | VOTORANTIM CIMENTOS S A | 1 | 18/08 | 01 – INFRAESTRUTURA |
| 12 | CONCREVIT CONCRETO VITORIA LTDA | 1 | 18/08 | 01 – INFRAESTRUTURA |

DE → PARA fechado e confirmado. Distribuição final após o remapeamento: **127 – ARTE WAVE (CONECTA): 68 | 125 – ARTE BOTANICA: 47 | 124 – ARTE JARDIM: 17 | 126 – ARTE DESIGN: 12 | 01 – INFRAESTRUTURA: 5** — total 149 registros.


## Plano de correção

1. **Aplicar o DE → PARA aprovado**: para cada registro, gravar o **nome oficial da obra** no campo Contratante e **reapontar o `obra_id`** para a obra correta do cadastro. Assim cada registro passa a pertencer à obra/coligada certa e aparece na visão de quem tem aquela coligada.
2. **Registrar o histórico**: cada alteração entra no log de alterações do registro com a justificativa "Normalização de contratante — vínculo ao Cadastro de Obras", com data/hora e usuário.
3. **Corrigir a seleção inicial de obra**: quando não houver obra válida salva, abrir na obra com movimentação mais recente (em vez da primeira em ordem alfabética), e mostrar no topo `coligada – nome da obra`.
4. **Estado vazio informativo** no histórico: "Nenhuma pesagem para esta obra/período", com atalhos para trocar de obra e ampliar o período.
5. **Regularizar acessos pendentes**: vincular coligadas aos usuários que estão sem nenhuma (jorge.miranda, nathan.santos, rachel.marcondes) e incluir o perfil **Coordenador** na regra de leitura (somente consulta).
6. **Validar**: conferir por obra a soma dos registros após o remapeamento (67 / 44 / 17 / 12 / … = 149) no Dashboard e no Fechamento Mensal.

## Detalhes técnicos

- Atualização de dados em `public.pesagens`: `contratante` = nome oficial da obra e `obra_id` = obra correspondente, por grupo de texto do DE → PARA (com `INSERT` correspondente em `public.pesagem_logs`).
- `src/components/app-shell.tsx`: fallback de obra passa a usar a obra com `max(created_at)` de pesagens; rótulo do seletor com coligada.
- `src/lib/pesagem-queries.ts`: nova consulta de apoio para o fallback de seleção de obra.
- `src/routes/pesagem.tsx`: estado vazio contextual no grid de histórico.
- Migração: incluir `coordenador` no caminho de leitura das políticas SELECT de `pesagens`/`obras`/`evidencias`/`notas_fiscais`, mantendo as políticas de escrita intactas; vínculos faltantes em `usuario_coligadas`.
