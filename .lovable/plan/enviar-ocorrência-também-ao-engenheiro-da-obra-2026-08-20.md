# Enviar ocorrência também ao engenheiro da obra

Hoje o e-mail de ocorrência vai sempre para os dois destinatários fixos (rafael.telles e roney.souza). A ideia é somar o **engenheiro responsável da obra selecionada**, usando o e-mail cadastrado em Configurações > Cadastro de Obras.

## Comportamento

- Ao registrar uma ocorrência (na entrada e também na ocorrência de saída), o destinatário do engenheiro da obra atual é incluído automaticamente junto aos dois fixos.
- O card de Evidência passa a mostrar um terceiro selo de destinatário, identificado como engenheiro da obra (ex.: "Diogo Amorim — diogo.silva@calper.com.br"), no mesmo estilo travado dos atuais.
- Se a obra não tiver e-mail de engenheiro cadastrado, nada muda: envia só para os fixos e o card exibe um aviso discreto de que a obra não tem engenheiro cadastrado.
- E-mails repetidos são deduplicados (todas as obras hoje têm engenheiro cadastrado, e em duas delas o engenheiro já é um dos destinatários fixos — nesse caso não haverá cópia duplicada).
- O corpo do e-mail passa a citar o engenheiro responsável junto ao nome da obra.

## Detalhes técnicos

- `src/lib/ocorrencia.ts`: `montarPayloadOcorrencia` recebe `engenheiroEmail` e `engenheiroNome` opcionais; `para` = destinatários fixos + engenheiro, com normalização (minúsculas/trim) e deduplicação. Nova função auxiliar `destinatariosOcorrencia(engenheiroEmail)` para a UI reutilizar a mesma regra.
- `src/routes/pesagem.tsx`: nas duas chamadas de `montarPayloadOcorrencia` (ocorrência de entrada e de saída) passar `obraAtual?.engenheiro_email` / `engenheiro_nome`; o bloco "Destinatários do e-mail" passa a renderizar `destinatariosOcorrencia(...)` em vez de `DESTINATARIOS_FIXOS`.
- Os dados já vêm na consulta de obras (`engenheiro_nome`, `engenheiro_email` já são selecionados em `obrasQueryOptions`), então não há mudança de banco nem de função de servidor.
