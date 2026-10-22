# Modo de teste: aviso da Nota Fiscal Avulsa só para dois endereços

Durante o fechamento dos testes do módulo Sucata, o aviso de "Nota Fiscal Avulsa emitida" deixa de ir para coordenadores da obra, engenheiro responsável e destinatários administrativos. Passa a ir apenas para:

```text
wagner.antunes@calper.com.br
roney.souza@calper.com.br
```

## Como fica

- Ao emitir a nota, o e-mail com o PDF em anexo sai somente para esses dois endereços.
- O registro da emissão na Fase 3 mostra exatamente quem recebeu, então fica visível na tela que o envio está em modo de teste.
- Os avisos por WhatsApp também ficam limitados a esses dois destinatários (o telefone é buscado pelo e-mail do cadastro); se eles não tiverem WhatsApp cadastrado, nenhuma mensagem é enviada.
- Nada muda no fluxo do processo: fases, gravação da nota (documento 012) e relatório fotográfico continuam iguais.
- O pedido da nota à Contabilidade (Fase 2) continua como está hoje — vai para os usuários com perfil Contabilidade.

## Como voltar ao normal depois do teste

A lista de teste fica isolada em um único ponto do código, com comentário explícito. Quando você mandar encerrar o modo de teste, basta remover essa lista e os destinatários reais voltam a receber sem nenhuma outra alteração.

## Detalhes técnicos

- `src/lib/sucata/avisos.server.ts`: constante `DESTINOS_TESTE` com os dois endereços e uma flag `MODO_TESTE = true`; em `avisarNotaEmitida`, quando a flag está ligada, `destinos()` não é usado e a lista passa a ser a de teste. A função `destinos()` e `coordenadoresDaObra()` permanecem intactas para o retorno ao normal.
- Nenhuma alteração em `coleta.functions.ts`, `nfa.functions.ts` ou `notificacoes.server.ts`; nenhuma migração de banco.

## Premissa

O endereço digitado como `wagner.antunes@caper.com.br` foi lido como `wagner.antunes@calper.com.br` (domínio da empresa). Se for outro domínio mesmo, me avise.

## Checklist de aceite

- [ ] Emissão da nota envia e-mail apenas aos dois endereços de teste
- [ ] Coordenadores, engenheiro e administrativo não recebem nada
- [ ] WhatsApp limitado aos mesmos dois destinatários
- [ ] Fluxo do processo e relatório inalterados
- [ ] Reversão em um único ponto do código
