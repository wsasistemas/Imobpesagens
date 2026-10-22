# Plano: permitir vincular Carta de Traço na edição de registros sem carta

## Situação atual (verificada no código)
No modal **Editar registro**, o bloco **Apuração de Concreto (Carta Traço)** — que contém os seletores de Fornecedor (usina) e Carta de traço — só é renderizado quando o registro **já possui** algum dado de carta (`traco_id`, apuração, peso esperado, tolerância, status ou volume).

Consequência: em registros como o do anexo (NF 000125249 — VOTORANTIM/ENGEMIX, itens em M³, sem carta vinculada), o bloco não aparece e o administrador não tem como escolher a carta de traço.

A gravação já está pronta: ao trocar fornecedor/carta o formulário marca a alteração e, ao salvar, o sistema reapura peso esperado (ρ × volume), tolerância, diferença em kg/% e status, exigindo a justificativa e registrando o log.

## O que será feito

1. **Exibir o bloco de Carta de Traço sempre para Administrador/SuperAdmin**
   - O bloco passa a ser renderizado para perfis administrativos mesmo quando o registro não tem nenhuma carta vinculada.
   - Para os demais perfis, o comportamento atual é mantido (bloco apenas quando existem dados de carta).

2. **Estado "sem carta vinculada"**
   - Título do bloco passa a indicar a situação: "Apuração de Concreto (Carta Traço)" com selo **SEM CARTA VINCULADA** quando não há traço.
   - Mensagem de apoio: "Selecione o fornecedor (usina) e a carta de traço para apurar o peso esperado deste registro."
   - Seletor de Fornecedor destacado (borda de atenção) enquanto nada estiver escolhido; o seletor de Carta de traço continua bloqueado até o fornecedor ser escolhido.

3. **Volume da carga**
   - O campo **Volume (m³)** fica visível e editável nesse cenário, pré-preenchido com a quantidade total da nota quando ela estiver em M³ (no exemplo, 8 m³), para que a apuração possa ser calculada.
   - Aviso quando faltar volume: "Informe o volume (m³) para calcular o Peso Carta Traço".

4. **Gravação e recálculo**
   - Ao escolher a carta e salvar com justificativa, o sistema grava o vínculo e reapura peso esperado, tolerância, diferença (kg e %) e status — mesma rotina já usada na troca de carta.
   - O registro passa a aparecer com Peso Carta Traço no histórico e a usar a **tolerância da carta** na Conferência e no Fechamento Mensal, conforme a regra vigente.

## Escopo
- Apenas o modal de edição em `src/routes/pesagem.tsx` (condição de exibição do bloco, estado vazio e pré-preenchimento do volume).
- Sem mudanças de banco, de RLS ou de regras de tolerância.

## Resultado esperado
O administrador abre "Ações → Editar registro" em qualquer pesagem — inclusive nas que hoje não têm carta — escolhe fornecedor e carta de traço, informa/confirma o volume, salva com justificativa e o registro passa a ter apuração por carta de traço.
