# Correção das variáveis do alerta de tolerância (empreendimento e fornecedor)

## O que foi verificado

- No envio atual, `empreendimento` recebe o **nome da obra** e `fornecedor` recebe o **emissor da nota** — não as colunas que você indicou.
- Na evidência anexada, o log gravou apenas as variáveis `placa` e `data`, e o corpo da mensagem saiu com `{{empreendimento}}` e `{{fornecedor}}` **sem substituição**. Motivo: o sistema só envia as variáveis que o provedor declara na lista de campos do template; como essa lista traz apenas `placa` e `data`, as outras duas nunca são enviadas, mesmo existindo no texto aprovado.

## Correções

1. **Origem correta dos dados**
   - `empreendimento` passa a usar a coluna **contratante** do registro de pesagem (se estiver vazia, usa o nome da obra como reserva).
   - `fornecedor` passa a usar a coluna **transportadora** do registro (se estiver vazia, usa o emissor como reserva).

2. **Enviar todas as variáveis que o texto do template exige**
   - As variáveis passam a ser deduzidas do **corpo aprovado do template** (todos os `{{...}}` encontrados), unidas às declaradas pelo provedor.
   - Assim, `empreendimento` e `fornecedor` são enviadas e substituídas corretamente no corpo da mensagem.

3. **Log fiel**
   - O log de alertas passa a gravar as 4 variáveis efetivamente enviadas e o texto final já substituído, para o diálogo **Detalhe do alerta** mostrar a mensagem real.
   - Se alguma variável exigida pelo template ficar sem valor, o log registra o aviso no motivo, em vez de enviar marcador cru.

4. **Teste manual (Configurações → Alertas de Tolerância)**
   - A inspeção do template passa a listar as variáveis do corpo, não só as declaradas, para o teste refletir o envio real.

## Detalhes técnicos

- `src/lib/whatsapp/alerta-tolerancia.functions.ts`: `valores.empreendimento = pesagem.contratante ?? obra.nome`; `valores.fornecedor = pesagem.transportadora ?? pesagem.emissor`; incluir `contratante, transportadora` no `select` da pesagem; gravar `variaveis`/`campos_enviados` a partir do retorno do envio.
- `src/lib/whatsapp/alerta-envio.server.ts`: em `variaveisTemplateAlerta`, unir `tpl.fields` com os nomes extraídos por regex de `tpl.text` (Zenvia) / `corpo` (Meta), preservando a ordem do texto; `enviarAlertaTemplateAuto` monta os campos sobre essa união.
- Sem alteração de banco, de regras de destinatário ou do fluxo aprovado de disparo.
