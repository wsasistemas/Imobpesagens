# Correção definitiva do período anual em Dashboard > Conferências

## Diagnóstico confirmado

Há dois filtros de data atuando em sequência:

1. A **Competência** do topo limita previamente todas as pesagens ao mês selecionado.
2. A aba **Conferências** recebe essa lista já mensal e depois aplica novamente Hoje, Semana, Mês, Ano ou Personalizado.

Por isso, ao clicar em **Ano**, a aba tenta mostrar o ano, mas só dispõe dos registros do mês que já passaram pelo primeiro filtro.

O erro ao clicar em **Limpar** também tem causa definida: o campo mensal fica vazio, porém a tela continua tentando separar ano/mês e converter uma data incompleta. Isso cria uma data inválida e dispara `RangeError: Invalid time value`. O aviso de campo alternando entre controlado e não controlado reforça que o valor vazio não está sendo tratado como um estado válido.

## Comportamento corrigido

- Na aba **Conferências**, o período escolhido nela será a única fonte de verdade para o intervalo:
  - **Hoje**: somente o dia atual.
  - **Semana**: semana corrente.
  - **Mês**: mês da competência escolhida; sem competência, mês atual.
  - **Ano**: de 1º de janeiro até hoje do ano da competência; sem competência, ano atual.
  - **Personalizado**: intervalo informado pelo usuário.
- O período **Ano** consultará e calculará todos os registros do ano, não apenas os do mês.
- Limpar a competência não causará erro: a tela adotará explicitamente o período atual compatível com o botão selecionado.
- A competência mensal continuará atendendo **Indicadores** e **Fechamento Mensal**, sem regressão.
- Ao trocar a competência, a seleção de período da aba Conferências não será forçada silenciosamente de volta para **Mês**.
- KPIs, quadro comparativo, gráfico, fornecedores, busca, paginação e exportação usarão exatamente o mesmo conjunto filtrado.

## Implementação

### 1. Separar dados-base de dados mensais

Em `src/routes/dashboard.tsx`:

- Manter a lista completa de pesagens concluídas e permitidas como base da aba Conferências.
- Manter o recorte mensal da competência somente onde ele é realmente necessário.
- Passar para `DashboardConferencia` a base completa, evitando o pré-filtro mensal que hoje impede Ano e Personalizado.
- Validar a competência antes de construir datas ou chamar `toISOString()`.

### 2. Tornar competência vazia um estado válido

Em `src/routes/dashboard.tsx`:

- Tratar `""` de forma explícita, sem criar `Date` inválida.
- Manter o campo sempre controlado.
- Definir fallback seguro para o mês atual nas áreas que exigem competência mensal.
- Nunca enviar datas inválidas à consulta de indicadores.

### 3. Corrigir a regra de período da aba Conferências

Em `src/components/dashboard-conferencia.tsx`:

- Centralizar o cálculo do intervalo em uma função validada.
- Fazer **Ano** usar o ano da competência quando houver uma competência válida; caso contrário, usar o ano atual.
- Remover o efeito que redefine automaticamente o botão para **Mês** a cada alteração da competência.
- Atualizar apenas as datas auxiliares do modo Personalizado, sem mudar o período escolhido pelo usuário.
- Validar datas personalizadas vazias, incompletas ou invertidas antes de formatar e filtrar.

### 4. Uniformizar todos os resultados

Garantir que o mesmo intervalo calculado alimente:

- cartões de totais e divergências;
- quadro comparativo;
- lista de fornecedores;
- gráfico temporal;
- paginação;
- relatório/exportação analítica.

Ao mudar o período, fornecedor, situação ou busca, a paginação volta para a página 1.

## Validação obrigatória

- [ ] **Ano** mostra registros de meses diferentes do mesmo ano.
- [ ] O total anual é maior ou igual ao total do mês quando há registros nos demais meses.
- [ ] **Mês** respeita a competência selecionada.
- [ ] Limpar a competência não derruba a aplicação.
- [ ] Após limpar, **Ano** usa o ano atual e **Mês** usa o mês atual.
- [ ] Trocar a competência com **Ano** ativo mantém **Ano** ativo.
- [ ] Hoje, Semana e Personalizado continuam corretos.
- [ ] Intervalo personalizado vazio ou invertido exibe tratamento seguro, sem erro técnico.
- [ ] KPIs, tabela, gráfico e exportação apresentam a mesma quantidade-base.
- [ ] Indicadores e Fechamento Mensal continuam usando a competência mensal corretamente.
- [ ] Nenhum aviso de campo controlado/não controlado aparece no navegador.
- [ ] Teste visual em computador e celular.
- [ ] Verificação final sem erros de compilação ou execução.

## Arquivos previstos

- `src/routes/dashboard.tsx`
- `src/components/dashboard-conferencia.tsx`

Sem alteração de banco de dados, permissões ou regras de tolerância.
