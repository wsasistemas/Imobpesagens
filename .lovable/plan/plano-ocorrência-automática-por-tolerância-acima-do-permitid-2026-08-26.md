# Plano — Ocorrência automática por tolerância acima do permitido

## Contexto
A coluna **Sinal de Tolerância** já existe no grid de histórico de pesagens. Quando um registro fechado (entrada + saída) apresentar sinal **"Acima da Tolerância"** (falta de peso além da tolerância), o sistema deverá abrir automaticamente uma ocorrência no próprio registro e notificar os engenheiros responsáveis pela coligada.

## Objetivo
Automatizar o registro e o e-mail de notificação sempre que uma pesagem resultar em tolerância acima do permitido, sem exigir ação manual do operador.

## Dados da ocorrência gerada automaticamente
| Campo | Valor |
|-------|-------|
| Tipo de ocorrência | **Outro** |
| Descrição do tipo | **TOLERANCIA ACIMA DO PERMITIDO** |
| Placa do automóvel | Placa do registro de pesagem |
| Relato | Texto padrão com placa e data substituídas dinamicamente |
| Data/hora da ocorrência | Momento do fechamento da pesagem |
| Autor | Sistema / usuário logado que finalizou a pesagem |

### Texto do relato
```
Prezado Engenheiro,

Foi constatada, durante o processo de pesagem, uma divergência acima da tolerância permitida referente ao veículo de placa XXXX no dia XX/XX/XXXX.

Solicitamos a gentileza de analisar o ocorrido e emitir seu parecer quanto às devidas providências que deveremos adotar em relação a essa discrepância.

Atenciosamente,

Sistema de Pesagem
```

Os marcadores `XXXX` e `XX/XX/XXXX` serão substituídos pela placa do veículo e pela data do registro, respectivamente.

## Destinatários do e-mail
- Engenheiro responsável cadastrado na obra (`obras.engenheiro_email`).
- Todos os usuários com perfil **Coordenador** vinculados à **coligada** da obra (`user_roles` + `usuario_coligadas` + `profiles.email`).
- Destinatários fixos já existentes: `rafael.telles@calper.com.br` e `roney.souza@calper.com.br`.
- E-mails duplicados serão removidos.

## Pontos de gatilho
1. **Fechamento da pesagem (saída/tara)** — após salvar com status `concluida` e sinal `acima`.
2. **Edição de registro via administrador** — após salvar alterações que resultem em sinal `acima`.

## Idempotência
A ocorrência/e-mail só será criado/enviado uma vez por registro. Se o campo `ocorrencia_tipo_outro` já for igual a `TOLERANCIA ACIMA DO PERMITIDO`, o processo será ignorado e retornará `já_notificado`.

## Componentes afetados
- `src/lib/ocorrencia-tolerancia.functions.ts` (novo): server function `notificarToleranciaAcima`.
- `src/lib/ocorrencia.ts`: funções auxiliares `relatoToleranciaAcima`, `destinatariosTolerancia` e ajuste no payload.
- `src/lib/email/resend.functions.ts` ou novo helper `.server.ts`: reutilizar/enviar e-mail via gateway Resend.
- `src/routes/pesagem.tsx`: chamada após sucesso do salvamento de saída e após edição, quando o sinal do registro for `acima`.

## Comportamento na interface
- O operador verá um toast informando: "Ocorrência de tolerância acima do permitido registrada e engenheiro notificado."
- Em caso de falha no envio, o registro da ocorrência ainda será salvo e o erro será logado, mas o operador será informado de que houve falha no envio do e-mail.

## Validação
- Garantir que e-mails inválidos sejam descartados.
- Garantir que o e-mail só seja enviado se houver pelo menos um destinatário.
- Garantir que o processo respeite a regra de idempotência.

## Próximos passos
Após aprovação, implementar os arquivos e chamadas descritos acima.
