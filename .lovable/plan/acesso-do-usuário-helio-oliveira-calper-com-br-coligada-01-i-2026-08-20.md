# Acesso do usuário helio.oliveira@calper.com.br (coligada 01 – INFRAESTRUTURA)

## O que foi verificado na base e no sistema

- O usuário está corretamente configurado: perfis **coordenador + operador** e vínculo com a coligada **01**.
- As permissões de leitura do banco estão certas: entrei no sistema como ele no preview e a obra **01 – INFRAESTRUTURA** aparece no seletor e os **5 registros** da obra são lidos sem erro.
- Ou seja: **não é falta de permissão de dados**. São dois bloqueios de tela:

1. **Dashboard bloqueado por regra fixa antiga.** A tela de Dashboard ainda exige perfil Admin (`requireAdmin`) e, ao entrar, joga o usuário de volta para Pesagem — mesmo com a matriz de "Permissões por Menu" liberando Dashboard para Coordenadores. Foi exatamente o que aconteceu no teste.
2. **Histórico abre vazio.** O período inicial é "Hoje" e a obra 01 não tem recebimento de hoje, então o grid mostra "Nenhum recebimento hoje" apesar de existirem 5 registros (a faixa "Registros por obra: 01 – INFRAESTRUTURA 5" já indica isso). Dá a impressão de "não acessa os dados".

## Plano de correção

**1. Respeitar a matriz de Permissões por Menu nas telas**
- Dashboard passa a exigir a permissão de menu `dashboard` (em vez de "ser Admin"). Coordenadores liberados na matriz entram normalmente.
- Configurações continua exigindo `configuracoes` (Admin/SuperAdmin pela matriz), sem mudança de comportamento.
- Quem não tem a permissão é redirecionado para o primeiro menu liberado do seu perfil (e não sempre para Pesagem).
- Coordenador segue **somente leitura**: nenhum botão de alteração é liberado por esta mudança.

**2. Abrir o histórico já com dados visíveis**
- Quando o período "Hoje" não tiver nenhum registro na obra selecionada e existirem registros anteriores, o histórico abre automaticamente em "Todo o período", com um aviso curto ("sem recebimentos hoje — exibindo todo o período").
- O usuário pode trocar o período livremente depois disso.

## Detalhes técnicos

- `src/routes/dashboard.tsx`: trocar `requireAdmin` por uma checagem de `menusPermitidos.dashboard`.
- `src/components/app-shell.tsx`: substituir a prop `requireAdmin` por `menu?: MenuKey`; o efeito de redirecionamento usa `menusPermitidos[menu]` e navega para o primeiro item liberado (`pesagem` → `dashboard` → `relatorios_ocorrencias` → `treinamento`).
- `src/routes/configuracoes.tsx`: passar `menu="configuracoes"`.
- `src/routes/pesagem.tsx`: efeito único (por obra) que, se `periodo === "hoje"` e nenhum registro do dia mas houver registros carregados, muda para `"tudo"` e exibe a nota.
- Sem alteração de banco, RLS ou vínculos de coligada — já estão corretos.
