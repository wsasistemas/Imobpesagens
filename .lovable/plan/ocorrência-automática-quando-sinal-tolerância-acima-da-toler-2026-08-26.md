# Ocorrência automática quando "Sinal Tolerância = Acima da Tolerância"

## Objetivo
Ao fechar a pesagem (entrada + saída), se a coluna **Sinal Tolerância** apontar **Acima da Tolerância**, o sistema abre automaticamente uma ocorrência no próprio registro de pesagem e dispara e-mail para os **engenheiros/coordenadores da coligada da obra** (e-mails do cadastro de usuários, perfil Coordenadores).

## Quando dispara
- No momento em que a saída é gravada e o registro fica fechado (`concluída` ou `fechada c/ ocorrência`).
- Também ao **editar um registro** com justificativa, se o recálculo passar o registro para "Acima da Tolerância" e ainda não houver ocorrência automática enviada.
- Dispara **uma única vez por registro** (se já existe ocorrência automática gravada, não reenvia).
- Se o operador já registrou uma ocorrência manual naquela pesagem, o automático não sobrescreve — apenas envia o aviso ao(s) engenheiro(s).

## O que fica gravado na ocorrência
| Campo | Valor |
| --- | --- |
| Tipo de ocorrência | **Outro** |
| Descrição do tipo | **TOLERANCIA ACIMA DO PERMITIDO** |
| Placa | placa do registro de pesagem |
| Data | data/hora do fechamento da pesagem |
| Relato | texto padrão abaixo |

Relato gravado e enviado (placa e data substituídos automaticamente):

```text
Prezado Engenheiro,

Foi constatada, durante o processo de pesagem, uma divergência "Acima da Tolerância" permitida referente ao veículo de placa ABC1D23 no dia 26/08/2026.

Solicitamos a gentileza de analisar o ocorrido e emitir seu parecer quanto às devidas providências que deveremos adotar em relação a essa discrepância.

Atenciosamente,
Sistema de Pesagem
```

O e-mail acrescenta, abaixo do relato, o bloco de dados já usado nas ocorrências (obra, contratante, NF, emissor, peso da NF, peso líquido aferido, peso esperado, diferença em kg/% e % de tolerância aplicada), para o engenheiro ter a base do cálculo.

## Destinatários
- Todos os usuários com perfil **Coordenador** cuja coligada permitida seja a coligada da obra do registro (ex.: coligada 126 → carlos.perdigao, iuri.menezes, vitor.vargens, athus.araujo, claudio.estebanez).
- Mais o engenheiro cadastrado na obra (Configurações > Cadastro de Obras), quando houver, e os destinatários fixos atuais (rafael.telles, roney.souza) — todos deduplicados.
- Se nenhum coordenador estiver cadastrado para a coligada, envia só para os fixos + engenheiro da obra e mostra aviso discreto ao operador.

## Sinalização na tela
- Ao salvar a saída de um registro acima da tolerância, aparece um toast: "Ocorrência de tolerância registrada e e-mail enviado ao(s) engenheiro(s) da coligada".
- O registro passa a mostrar o ícone/menu de ocorrência já existente no grid, com o relato automático visível em "Ações → Ocorrências".
- O status da pesagem **continua** `concluída` (não vira "fechada c/ ocorrência"), para não alterar os números das conferências e do fechamento mensal.

## Detalhes técnicos
- Nova função de servidor `notificarToleranciaAcima` em `src/lib/ocorrencia-tolerancia.functions.ts` (`createServerFn` + `requireSupabaseAuth`): recebe `pesagemId`; lê a pesagem e a obra (coligada), busca coordenadores via `user_roles` + `usuario_coligadas` + `profiles.email` com o cliente admin (carregado dentro do handler, pois `profiles` de outros usuários não é legível pelo chamador), grava os campos `ocorrencia_tipo='Outro'`, `ocorrencia_tipo_outro='TOLERANCIA ACIMA DO PERMITIDO'`, `ocorrencia_relato`, `ocorrencia_em`, `ocorrencia_por` (somente se ainda vazios) e envia o e-mail reutilizando a mesma chamada Resend de `src/lib/email/resend.functions.ts` (helper extraído para um `.server.ts` compartilhado, sem duplicar código).
- Idempotência: só envia se `ocorrencia_tipo_outro` ainda não for `TOLERANCIA ACIMA DO PERMITIDO`; retorna `{ enviado: false, motivo }` quando já enviado.
- Texto e destinatários montados em `src/lib/ocorrencia.ts` (novas funções `relatoToleranciaAcima({ placa, data })` e `destinatariosTolerancia({ engenheiroEmail, coordenadores })`), mantendo a convenção atual.
- Avaliação do "acima da tolerância" reutiliza `sinalTolerancia` de `src/lib/sinal-tolerancia.ts` (mesma função da coluna do grid), calculada no cliente após o fechamento em `src/routes/pesagem.tsx` (mutação de saída e mutação de edição com justificativa); quando `chave === "acima"`, chama a função de servidor.
- Sem alteração de banco: usa colunas de ocorrência já existentes em `public.pesagens`.
