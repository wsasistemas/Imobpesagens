# Emissão da Nota Fiscal Avulsa em um único botão, com confirmação irreversível

## O que muda na tela da Contabilidade

Saem os três blocos do anexo:

- "Emissão e anexo da nota" (número, data, escolher arquivo, "Anexar nota ao processo")
- "Registrar impedimento"
- "Enviar nota ao sucateiro (opcional)"

Entra, no lugar, um único bloco de ação, bem destacado, logo abaixo do formulário da nota:

```text
+---------------------------------------------------------------+
|  Emissão da Nota Fiscal Avulsa                                |
|                                                               |
|  Número 00001 · Emissão 14/09/2026                            |
|  Confira os dados e o certificado antes de emitir.            |
|                                                               |
|   [  EMITIR NOTA FISCAL AVULSA  ]   (botão grande CALPER)     |
|                                                               |
|  A emissão é definitiva. Nova nota desta venda só depois de   |
|  cancelar e reabrir a emissão do mesmo processo.              |
+---------------------------------------------------------------+
```

O número e a data de emissão continuam sendo preenchidos no formulário da nota (numeração começando em 00001, corrigível antes de emitir).

## O que acontece ao clicar

1. Abre a pré-visualização da nota no modelo oficial (a mesma folha de hoje), para conferência final.
2. Ao pedir a emissão, aparece um aviso de confirmação:
   - título: "Emitir a Nota Fiscal Avulsa?"
   - texto: a emissão é irreversível; a nota será registrada no processo e enviada por e-mail; uma nova nota desta venda só será possível se esta emissão for cancelada e a emissão do mesmo processo de venda for reaberta.
   - botões: "Cancelar" e "Emitir definitivamente".
3. Confirmando, o sistema gera o PDF da folha, guarda como documento 012 do processo, registra número e data, fecha a Fase 3, abre a Fase 4 (recibo do sucateiro) e registra o evento na auditoria.
4. O e-mail com o PDF em anexo vai para os **coordenadores da obra** e o **administrativo da obra**, além do engenheiro responsável, com os dados da nota (processo, placa, peso aferido, valor por quilo, valor total, número e data da nota). O aviso por WhatsApp de hoje continua funcionando para quem tem telefone no cadastro.
5. Depois de emitida, o bloco passa a mostrar apenas o estado "Nota emitida" com a data, quem emitiu e o botão para baixar o PDF. O botão de emitir fica indisponível — não há como emitir duas vezes.

## Cancelar e reabrir

Nota emitida por engano deixa de ser corrigível na tela da Contabilidade. A reabertura segue a regra já existente do módulo: somente o perfil TI/SuperAdmin pode cancelar a emissão e reabrir a fase, com motivo obrigatório registrado na auditoria. A nova nota entra como nova via do documento 012, preservando a anterior no histórico.

## Detalhes técnicos

- `src/routes/sucata.$id.nfa.tsx`: remover os cards de anexo manual, impedimento e envio ao sucateiro, e as mutações `anexarNfa`, `registrarImpedimentoNfa`, `enviarNfaSucateiro` da tela; manter o painel de dados somente leitura e o `FormularioNfa`.
- `src/components/sucata/formulario-nfa.tsx`: trocar "Pré-visualizar nota" pelo bloco de ação destacado com o botão primário "EMITIR NOTA FISCAL AVULSA"; estado emitido lido de `dados.nfaNumero`/`nfaAnexada`.
- `src/components/sucata/nfa-preview-dialog.tsx`: substituir "Confirmar e enviar à obra" por "Emitir definitivamente" com `AlertDialog` de confirmação irreversível antes de chamar o servidor; manter "Baixar PDF" e "Fechar".
- `src/lib/sucata/nfa.functions.ts`: em `confirmarPreviewNfa`, recusar quando já existir `nfa_storage_path`/`nfa_numero` sem reabertura (erro claro "Nota já emitida"); manter verificação de papel contador/admin/superadmin e o registro do evento.
- `src/lib/sucata/avisos.server.ts`: ampliar a lista de destinos para incluir os usuários com perfil Coordenador com acesso à obra (`user_roles` + `obra_acessos`, e-mail do cadastro), somados ao engenheiro e aos destinatários administrativos, sem repetição.
- As funções `anexarNfa`, `registrarImpedimentoNfa` e `enviarNfaSucateiro` permanecem no servidor (usadas por outros pontos/histórico), apenas deixam de aparecer nesta tela.
- Sem migração de banco. Nenhuma tela fora do módulo Sucata é alterada.

## Checklist de aceite

- [ ] Os três blocos do anexo não aparecem mais na tela da NFA
- [ ] Botão único e destacado "EMITIR NOTA FISCAL AVULSA"
- [ ] Aviso de confirmação informando que a emissão é irreversível
- [ ] Emissão grava a nota (documento 012), fecha a Fase 3 e abre a Fase 4
- [ ] E-mail com o PDF vai aos coordenadores da obra e ao administrativo da obra
- [ ] Segunda emissão bloqueada; só após cancelamento e reabertura pelo TI
- [ ] Estado "Nota emitida" com data, autor e download do PDF

## Premissas

- Coordenadores da obra = usuários com perfil Coordenador que têm acesso à obra do processo.
- O envio da nota ao sucateiro por e-mail sai desta tela; se você quiser que ele volte como parte automática da emissão, avise e eu incluo no mesmo disparo.
