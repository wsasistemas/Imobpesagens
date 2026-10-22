# Ajuste de valor, retirada do painel de teste e liberação do relatório fotográfico

## Parte 1 — Novo valor digitado pelo administrador avisa a Contabilidade

Hoje, quando o administrador digita um novo valor total no quadro "Ajuste do valor (administrador)", o sistema apenas grava o novo valor e a justificativa. A Contabilidade não é avisada.

Passa a funcionar assim:

1. O administrador digita o novo valor e a justificativa e clica em "Ajustar valor".
2. Aparece uma confirmação: o valor da venda passa de R$ X para R$ Y e a Contabilidade recebe um pedido de cancelamento da nota anterior, quando ela já tiver sido emitida.
3. Ao confirmar, o sistema grava o novo valor e envia automaticamente um e-mail a todos os usuários com perfil Contabilidade.
4. A tela da Nota Fiscal Avulsa passa a mostrar sempre o valor atual, que é o valor com que a nota será gerada.

### O e-mail para a Contabilidade

- **Nota ainda não emitida** — assunto "Valor corrigido antes da emissão — processo SUC-xxxx/AAAA": a nota deve ser emitida pelo novo valor.
- **Nota já emitida** — assunto "Cancelar nota nº NNNNN e emitir nova — processo SUC-xxxx/AAAA": pede o cancelamento da nota anterior (número e data) e a emissão de nova nota pelo novo valor.

Em ambos os casos o e-mail traz: número do processo, obra, sucateiro, placa, peso aferido, valor por quilo, valor total anterior e novo, quem ajustou, data/hora, justificativa e o botão "Emitir nota no sistema", que abre direto a tela da Fase 3.

### Quando a nota já foi emitida

```text
Fase 3 - Nota Fiscal Avulsa
  Nota nº 00001 emitida em 15/09/2026    [ Substituição solicitada ]
  Valor da nota: R$ 4.250,00
  Novo valor a emitir: R$ 4.528,00
```

- O quadro de registro da emissão exibe o aviso âmbar "Substituição solicitada — nota anterior a cancelar".
- O botão de emissão volta a ficar disponível para a Contabilidade emitir pelo novo valor, sem exigir reabertura pelo TI.
- O histórico guarda os dois eventos: o ajuste de valor e o pedido de cancelamento com a lista de quem recebeu o e-mail.

## Parte 2 — Sai o bloco "Preenchimento manual (teste do fluxo)"

O quadro amarelo de preenchimento manual desaparece da tela do processo, junto com o botão "Gravar valores de teste". A marca "Processo de teste" continua aparecendo nos processos já marcados, para não perder o rastro do que foi testado.

## Parte 3 — Relatório fotográfico só com o processo completo

O botão "Relatório fotográfico" no topo da tela do processo passa a ter duas condições:

1. **Todas as quatro fases preenchidas e validadas** — dados e fotos obrigatórias de cada fase:
   - Fase 1: sucateiro, placa, tara e foto 001 (caminhão vazio)
   - Fase 2: peso bruto, valor da coleta e foto 004 (caçamba cheia)
   - Fase 3: nota fiscal emitida com o documento 012
   - Fase 4: recibo (010) e comprovante de pagamento (011)
2. **Perfil autorizado** — administrativo da obra (Administrador) ou TI (SuperAdmin). Outros perfis veem o botão desligado.

Enquanto faltar algo, o botão fica desligado e, ao passar o mouse, mostra o que falta:

```text
[ Relatório fotográfico ]  (desligado)
   Falta: foto do recibo (010) · comprovante de pagamento (011)
```

Sem permissão, a explicação é "Só o administrativo da obra ou a TI podem gerar o relatório".

## Detalhes técnicos

- `src/lib/sucata/coleta.functions.ts` — em `ajustarValorColeta`, após gravar o novo valor: recarregar o processo por `PROCESSO_NFA_SELECT`, resolver destinatários com `emailsContabilidade`, enviar via `notificar` com novo tipo `AJUSTE_VALOR_NFA`, registrar evento `nfa_cancelamento_solicitado` com payload `{ emails, valor_anterior, valor_novo, nfa_numero, justificativa, envio }`. Retorno passa a incluir `{ emailOk, destinatarios, erro?, notaEmitida }`. Sem destinatário Contabilidade, o ajuste é gravado e a resposta traz o aviso.
- `src/lib/sucata/nfa.server.ts` — novas funções `assuntoAjusteValor(p, notaEmitida)`, `htmlAjusteValor(p, dados)` e `textoAjusteValor(p, dados)`, reaproveitando `camposNfa`, `moeda` e `dataBr`.
- `src/lib/sucata/notificacoes.server.ts` — acrescentar `"AJUSTE_VALOR_NFA"` à união de `tipo`.
- `src/components/sucata/passos-sucata.tsx` — diálogo de confirmação antes de `ajustarValorColeta`; toast do envio ou da falha; aviso âmbar de substituição pendente quando `valor_ajustado_em` for posterior a `nfa_emissao`/`nfa_exportada_em`.
- `src/routes/sucata.$id.nfa.tsx` / `src/components/sucata/formulario-nfa.tsx` — liberar novamente a emissão com substituição pendente e recalcular os valores pelo valor atual do processo.
- `src/routes/sucata.$id.index.tsx` — remover `<PainelTesteManual />` e seu import (linhas 14 e 101); o botão do relatório passa a ser condicional, usando `estadosDoProcesso` (`fases-v2.ts`) e `posicoesVigentes` para montar a lista de pendências, `useAuth()` para `isAdmin || isSuperAdmin`, com `Tooltip` do shadcn/ui explicando o bloqueio. O arquivo `painel-teste-manual.tsx` fica no projeto, sem uso.
- Sem migração de banco: `valor_ajustado_em`, `valor_ajuste_justificativa`, `nfa_numero` e `nfa_emissao` já existem, e a substituição pendente é derivada da comparação dessas datas.

## Checklist de aceite

- Ajuste de valor pede confirmação explicando o pedido de cancelamento — PENDENTE
- E-mail chega a todos os usuários com perfil Contabilidade — PENDENTE
- Texto diferente para nota já emitida (pede cancelamento) e não emitida — PENDENTE
- Tela da Fase 3 mostra o novo valor e libera a emissão da nota substituta — PENDENTE
- Bloco "Preenchimento manual (teste do fluxo)" não aparece mais — PENDENTE
- Botão "Relatório fotográfico" desligado até as 4 fases estarem completas, com a lista do que falta — PENDENTE
- Só Administrador e TI conseguem gerar o relatório — PENDENTE

## Premissas

- O e-mail vai apenas para usuários com perfil Contabilidade, no e-mail do próprio cadastro (mesma regra do pedido original).
- O cancelamento da nota anterior é feito pela Contabilidade no sistema fiscal externo; o portal apenas solicita e registra.
- "Administrador da obra" = perfil Administrador; "TI" = SuperAdmin.
- Processos concluídos continuam com o relatório liberado, já que passaram por todas as fases.
