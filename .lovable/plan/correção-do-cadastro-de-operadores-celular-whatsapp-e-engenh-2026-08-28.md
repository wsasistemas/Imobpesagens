# Correção do cadastro de operadores (Celular, WhatsApp e Engenheiro responsável)

## O que eu verifiquei no banco

Os dados **estão sendo gravados**, o problema é de leitura/preenchimento da tela:

- `roney.souza@calper.com.br`: celular `21969160058` gravado no cadastro de acesso, `whatsapp_e164 = 5521969160058` e a marcação "engenheiro responsável por todas as coligadas" ativa.
- `claudio.estebanez@calper.com.br`: celular `21971014501` e WhatsApp `5521971014501` gravados.

Ou seja: o usuário salva, a tela recarrega vazia e parece que nada foi gravado.

## Causas confirmadas

1. **Celular volta vazio**: a listagem de usuários usa o telefone da conta de autenticação antes do celular do cadastro. O serviço de autenticação devolve esse campo como texto vazio (`""`) em vez de nulo, e o texto vazio "ganha" da informação real — então o celular gravado nunca chega à tela.
2. **WhatsApp (E.164) volta vazio/errado**: a listagem não traz o campo `whatsapp_e164` do perfil, e a tela de edição preenche esse campo com o celular da conta. Como o celular chega vazio (item 1), o campo WhatsApp abre em branco mesmo estando gravado.
3. **Engenheiro responsável por coligada não é confiável**: ao salvar os vínculos, se a gravação com a marcação de engenheiro falhar por qualquer motivo, o código grava de novo **sem** a marcação e não avisa nada. O resultado é um "Usuário atualizado" com a responsabilidade perdida em silêncio. Hoje não há nenhum registro com engenheiro responsável por coligada no banco.

## Correções

1. **Listagem de usuários** (`listarUsuarios`)
   - Tratar texto vazio como ausente na leitura do telefone (celular do cadastro passa a aparecer).
   - Passar a trazer também `whatsapp_e164` do perfil e expô-lo como `whatsapp` no usuário listado.

2. **Tela Editar usuário** (`EditarUsuarioDialog` em Configurações > Operadores)
   - Preencher o campo **WhatsApp (E.164)** com o WhatsApp do perfil (não com o celular), exibindo no formato `+55...`.
   - Preencher **Celular** com o valor corrigido da listagem.
   - Manter a seleção de **Engenheiro responsável** carregada da coligada gravada.

3. **Gravação dos vínculos** (`definirColigadasUsuario`)
   - Remover o "salvamento silencioso sem a marcação": se a gravação com a marcação de engenheiro falhar, o erro é propagado e a tela mostra a mensagem, em vez de fingir sucesso.
   - Propagar também o erro de atualização do perfil (WhatsApp e responsabilidade global), que hoje é ignorado.

4. **Confirmação visual**
   - Após salvar, recarregar a lista e reabrir o usuário mostrando os valores gravados; na lista, o selo de engenheiro responsável passa a refletir a coligada marcada ou "todas as coligadas".

## Detalhes técnicos

- `src/lib/admin.functions.ts`
  - `UsuarioAdmin`: novo campo `whatsapp: string | null`.
  - `listarUsuarios`: helper `naoVazio()` na resolução de `phone`; incluir `whatsapp_e164` no `select` de `profiles` (já consultado para `engenheiro_todas_coligadas`) e mapear por usuário.
  - `definirColigadasUsuario`: remover o `catch` implícito do insert de fallback (manter só o insert com `engenheiro_responsavel`) e checar o `error` do `update` em `profiles`, lançando `Error` em ambos os casos.
- `src/routes/configuracoes.tsx`
  - `EditarUsuarioDialog`: `setWhatsapp(usuario.whatsapp ? "+" + usuario.whatsapp : "")`; manter `celular` a partir de `usuario.phone`; nenhuma mudança de layout.
  - Selo/legenda de engenheiro responsável na listagem usando `engenheiroTodas` e `engenheiroColigadas`.
- Sem migração de banco: as colunas `profiles.whatsapp_e164`, `profiles.engenheiro_todas_coligadas` e `usuario_coligadas.engenheiro_responsavel` já existem.
