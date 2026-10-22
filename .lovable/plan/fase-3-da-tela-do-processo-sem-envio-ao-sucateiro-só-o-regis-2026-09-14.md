# Fase 3 da tela do processo: sem envio ao sucateiro, só o registro da emissão

## O que sai da tela

No card **FASE 3 — Nota Fiscal Avulsa** saem:

- o bloco "Emissão pela Contabilidade" (número da nota, data de emissão, "Anexar a nota", "Anexar e enviar a nota por e-mail ao sucateiro", "Exportar em PDF", "Reenviar ao sucateiro");
- o bloco "Teste de envio" (campo de e-mail e botão "Enviar teste", que só o TI via).

Motivo: a nota não é mais enviada ao sucateiro, e a emissão acontece por um único botão na tela de emissão ("EMITIR NOTA FISCAL AVULSA").

Também saem os dois campos que só falavam de envio: "Enviada ao sucateiro em" e "Exportada em PDF em".

## O que entra no lugar

Um quadro de registro da emissão, somente leitura:

```text
+---------------------------------------------------------------+
|  Registro da emissão                                          |
|                                                               |
|  Sucateiro          CALPER TESTE LTDA                         |
|  Nota fiscal        00001                                     |
|  Emitida em         14/09/2026, 18:07                         |
|  Emitida por        contabilidade@calper.com.br               |
|  Avisos enviados    coordenador@calper.com.br,                |
|                     administrativo@calper.com.br,             |
|                     engenheiro@calper.com.br                  |
+---------------------------------------------------------------+
```

Antes de emitir, o quadro mostra "Nota ainda não emitida" e continua o botão **Abrir os dados de emissão**, que leva à tela onde a nota é conferida e emitida.

## Detalhes técnicos

- `src/components/sucata/passos-sucata.tsx`: remover, na Fase 3, o bloco de emissão manual e o bloco de teste, os campos "Enviada ao sucateiro em"/"Exportada em PDF em", os estados/mutações locais `numeroNota`, `emissao`, `notaFile`, `anexar`, `reenviarNota`, `exportar`, `emailTeste`, `enviarTeste` e os imports que ficarem sem uso (`Upload`, `Download`, `enviarNfaTeste`, `anexarNfa`/`enviarNfaSucateiro`/`exportarNfaPdf` conforme o que sobrar). Inserir o componente de registro no lugar.
- Origem dos dados do registro: nome do sucateiro pelo `sucateiro_id` do processo (`sucata_sucateiros`); número e data pela própria linha do processo (`nfa_numero`, `nfa_emissao`); data/hora, autor e destinatários pelo evento `nfa_preview_confirmada` em `sucata_eventos`, já consultado em `src/lib/sucata/evidencias-queries.ts`.
- `src/lib/sucata/nfa.functions.ts` (`confirmarPreviewNfa`): incluir no `payload` do evento os campos `emails` (destinatários avisados) e `avisos` (falhas de envio), para o quadro poder exibi-los. O evento é gravado depois do aviso, então a ordem das duas chamadas passa a ser: enviar aviso, depois registrar evento com a lista.
- As funções de servidor `anexarNfa`, `enviarNfaSucateiro`, `exportarNfaPdf` e `enviarNfaTeste` permanecem no servidor (histórico e outros pontos), apenas deixam de ser chamadas nesta tela.
- Sem migração de banco (o payload do evento é jsonb). Nenhuma tela fora do módulo Sucata é alterada.

## Checklist de aceite

- [ ] O bloco "Emissão pela Contabilidade" não aparece mais na Fase 3
- [ ] O bloco "Teste de envio" não aparece mais na Fase 3
- [ ] Nenhum botão da tela envia a nota por e-mail ao sucateiro
- [ ] Quadro "Registro da emissão" com sucateiro, número, data/hora, autor e destinatários avisados
- [ ] Antes de emitir, o quadro mostra "Nota ainda não emitida"
- [ ] O botão "Abrir os dados de emissão" continua funcionando

## Premissas

- "Nome do e-mail enviado" = a lista de quem recebeu o aviso da nota (coordenadores da obra, administrativo e engenheiro). Se você quiser apenas um endereço específico, diga qual.
- Emissões antigas, feitas antes desta mudança, não têm a lista de destinatários guardada; nesses casos o quadro mostra "—" nesse item.
