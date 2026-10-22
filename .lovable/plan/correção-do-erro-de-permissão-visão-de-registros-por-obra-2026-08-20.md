# Correção do erro de permissão + visão de registros por obra

## 1. Erro "Apenas administradores podem executar esta ação."

Causa confirmada: a verificação usada pelas funções administrativas exige o perfil **admin** literalmente. Na base há usuários com perfil **superadmin** sem o perfil admin (2 dos 3 superadmins), então ao abrir Configurações / Perfis a listagem de usuários é bloqueada e a tela quebra.

Correção:
- Aceitar **admin OU superadmin** na verificação central usada por todas as funções administrativas (uma única função de checagem, aplicada aos 12 pontos que já a chamam).
- Aplicar a mesma regra na checagem avulsa de administrador que existe em outra função do mesmo arquivo.
- Em vez de estourar erro de runtime na tela, exibir mensagem amigável ("sem permissão") quando a listagem falhar.

## 2. Mostrar nos grids a análise por obra

Números atuais confirmados na base (153 registros):

| Obra | Registros |
| --- | --- |
| CONDOMINIO ARTE WAVE (CONECTA) | 68 |
| CONDOMINIO ARTE BOTANICA | 50 |
| CONDOMINIO ARTE JARDIM | 18 |
| CONDOMINIO ARTE DESIGN | 12 |
| INFRAESTRUTURA | 5 |

Onde isso vai aparecer:

**Tela de Pesagem (Histórico)**
- Faixa de resumo acima do grid com um "chip" por obra: nome + quantidade de registros do escopo filtrado, ordenado do maior para o menor, e total geral.
- Clicar no chip aplica o filtro da coluna Obra; clicar de novo limpa.
- Na visão de uma obra específica, a faixa mostra apenas aquela obra.

**Dashboard**
- Novo cartão "Registros por obra" com barras horizontais (quantidade de registros e peso total em t), ordenado do menor para o maior, seguindo o padrão já usado no gráfico de contratantes.
- Visível na visão consolidada ("Todas as obras"); na visão de obra única o cartão mostra somente a obra selecionada.

## Detalhes técnicos

- `src/lib/admin.functions.ts`: `assertAdmin` passa a checar `has_role(admin)` e `has_role(superadmin)`; mesma lógica no bloco `isAdmin` (linha ~475).
- `src/components/cadastro-perfis.tsx` e `src/routes/configuracoes.tsx`: tratar erro da listagem sem quebrar a tela.
- `src/routes/pesagem.tsx`: agregação `useMemo` por `obra_id`/nome sobre os registros já carregados; chips ligados ao filtro existente da coluna Obra.
- `src/routes/dashboard.tsx`: agregação por obra a partir dos registros já carregados (sem nova consulta) e `BarChart` horizontal com `LabelList`.
- Nenhuma alteração de banco: os vínculos de obra já estão consistentes com o campo Contratante histórico.
