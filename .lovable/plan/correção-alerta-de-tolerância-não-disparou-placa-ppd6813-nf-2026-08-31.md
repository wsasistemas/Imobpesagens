# Correção: alerta de tolerância não disparou (placa PPD6813 / NF 040524)

## Causa confirmada

Consultei o registro e os logs de alerta:

- A pesagem `040524` (placa PPD6813) está fechada com `-4,67%` contra tolerância de `4%` — ou seja, é caso legítimo de **ACIMA DA TOLERÂNCIA**.
- A ocorrência automática foi gravada (`TOLERANCIA ACIMA DO PERMITIDO`), então o e-mail rodou.
- A tabela de logs de alerta WhatsApp está **completamente vazia** — nenhum registro, nem falha.

Motivo: a função de alerta lê a pesagem pedindo a coluna `fornecedor`, que **não existe** na tabela de pesagens (o campo correto é `emissor`). A consulta retorna erro e a função aborta na primeira linha, antes de gravar qualquer log. No cliente o erro é engolido e só sobra um toast genérico. Ou seja: nenhum alerta de tolerância jamais foi enviado por este fluxo, para nenhum registro — a configuração (Zenvia ativa, template ID preenchido, alertas ligados) está correta.

## O que será corrigido

1. **Coluna errada**: a leitura passa a usar `emissor` como fornecedor na variável `{{fornecedor}}` do template. Isso restabelece o disparo automático no fechamento da saída e na edição com justificativa.
2. **Falha nunca mais silenciosa**: qualquer erro dentro do fluxo passa a gravar uma linha de log com status `falhou` e o motivo, e o toast passa a mostrar o motivo real (em vez de mensagem genérica).
3. **Reenvio manual sobre o registro** (seu pedido "enviar a mensagem em cima do registro"): no menu **Ações** do grid de histórico, para registros com Sinal Tolerância = *Acima da Tolerância*, novo item **"Enviar alerta de tolerância (WhatsApp)"**, visível para Admin/SuperAdmin. Ele reenvia o template ao engenheiro responsável da coligada + engenheiros marcados para todas as coligadas, ignorando a antiduplicidade (o log fica com o carimbo de reenvio manual, usuário e hora).
4. Depois de aplicado, disparo o alerta do registro da tela em anexo (NF 040524, placa PPD6813) por esse caminho manual e confirmo o resultado no log.

Regras de destinatário, template e variáveis (`placa`, `data`, `empreendimento`, `fornecedor`) permanecem exatamente como já definidas — nada do fluxo aprovado muda.

## Detalhes técnicos

- `src/lib/whatsapp/alerta-tolerancia.functions.ts`: no `select` da pesagem trocar `fornecedor` por `emissor` e usar `pesagem.emissor` em `valores.fornecedor`; envolver o corpo do handler em `try/catch` que grava log `falhou` com `erro_detalhe` antes de retornar `{ resultado: "falha", motivo }`; novo parâmetro opcional `forcarReenvio` que, quando verdadeiro, exige Admin/SuperAdmin (`has_role`) e insere um novo log (sem depender do `unique (pesagem_id, tipo_alerta, destinatario_user_id)` — em conflito, atualiza o log existente para `pendente` e reenvia), marcando `ocorrencia_ref` com `REENVIO MANUAL`.
- `src/routes/pesagem.tsx`: `dispararAlertaTolerancia` passa a exibir `res.motivo` no toast de falha; novo item no `DropdownMenu` de Ações chamando a mesma server fn com `forcarReenvio: true`, habilitado quando `sinalTolerancia(...)?.chave === "acima"` e o perfil é admin/superadmin; invalida `["whatsapp-alertas"]` ao final.
- Sem alteração de schema; o grid **Logs de Alertas de Tolerância** já exibe os novos registros.
