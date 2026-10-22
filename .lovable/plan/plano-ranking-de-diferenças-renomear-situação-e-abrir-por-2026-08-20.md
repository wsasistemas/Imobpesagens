# Plano: Ranking de diferenças — renomear situação e abrir por %

## Contexto
No card **Ranking de diferenças** (dentro de **Conferências / Fechamento Mensal**) a tabela exibe a coluna **Situação** com os rótulos **OK**, **Abaixo** e **Acima**. A métrica inicial do ranking está configurada como **"Por peso (kg)"**.

## Objetivo
1. Renomear a situação de divergência no **Ranking de diferenças** para **"Acima da Tolerância"** (quando o desvio absoluto superar a tolerância apurada).
2. Fazer o **Ranking de diferenças** abrir por padrão na métrica **"Por %"**, conforme a tela de referência.

## O que será alterado
Arquivo: `src/components/dashboard-fechamento-mensal.tsx`

### 1. Métrica inicial do ranking
- Alterar o estado `metrica` de `"kg"` para `"pct"`.
- Resultado: ao abrir a tela, o ranking já será exibido ordenado por percentual e os botões **Por peso (kg) / Por % / Por impacto (R$)** virão com **Por %** selecionado.

### 2. Regra da situação no ranking
- Atualmente a situação do ranking é calculada por `situacaoDe(pct, tolerancia)`, que distingue **Abaixo** (medido < NF) de **Acima** (medido > NF).
- Será substituída por `situacaoFechamento(pct, tolerancia)`, que já existe no componente e compara o **desvio absoluto** contra a tolerância média.
- Resultado:
  - Dentro da tolerância → **OK** (verde)
  - Fora da tolerância → **Acima da Tolerância** (vermelho)
- Essa mudança afeta apenas o **Ranking de diferenças**; a tabela **Fechamento por obra × fornecedor** já usa essa mesma regra e não será alterada.

### 3. Texto explicativo do ranking
- Ajustar o parágrafo informativo abaixo da tabela do ranking para deixar claro que a situação no ranking é apurada pela tolerância média do fornecedor.

## Não será alterado
- A regra de tolerância (carta de traço → fornecedor → tabela padrão) permanece a mesma.
- Os cálculos de diferença, percentual e impacto financeiro permanecem inalterados.
- A tabela **Fechamento por obra × fornecedor** mantém seu comportamento atual.

## Validação
Após a implementação, verificar no preview:
- Ao acessar **Dashboard → Conferências → Fechamento Mensal**, o botão **Por %** do ranking deve estar ativo.
- Fornecedores com desvio percentual superior à tolerância devem exibir o badge **Acima da Tolerância**.
- O CSV exportado do ranking deve refletir o novo rótulo de situação.
