# Correção: nota da CONCREVIT sendo tratada como documento de água

## Causa confirmada

A detecção de "Documento não fiscal — ÁGUA" está frouxa em dois pontos (`src/routes/pesagem.tsx`, bloco de sucesso do OCR):

1. `naoFiscal` fica verdadeiro apenas por **não ter lido a chave de 44 dígitos**. Em foto de DANFE com o código de barras/chave borrado, a nota fiscal legítima cai como "não fiscal".
2. O indício de água usa `\bAGUA\b` sobre descrição **e itens da nota**. Notas de concreto listam ÁGUA como matéria-prima (junto de CIMENTO, AREIA, BRITA, ADITIVO), então a CONCREVIT sempre casa com o padrão de água.

Com os dois juntos, a nota de concreto da CONCREVIT entra no formulário simplificado e perde o fluxo de carta de traço (itens, volume, tolerância do traço).

## O que será corrigido

1. O modo água passa a exigir **classificação positiva de documento não fiscal** pelo OCR (`tipo_nota = "nao_fiscal"` ou `documento_nao_fiscal = true`). Falta de chave, sozinha, deixa de ativar o modo.
2. O indício de água passa a considerar apenas sinais próprios de fornecimento de água: `produto_categoria = "agua"`, "CAMINHÃO-PIPA", "ABASTECIMENTO DE ÁGUA", "COMPROVANTE DE ABASTECIMENTO". A palavra "ÁGUA" solta dentro de itens **não** ativa mais o modo.
3. Bloqueio explícito: se o documento tiver qualquer sinal de nota fiscal ou de concreto — chave de 44 dígitos, valor total da NF, quadro de produtos com mais de um item, dados de concreto (FCK/slump/dosagem/volume), ou emissor casado com fornecedor de carta de traço — o modo água **nunca** é ativado, mesmo com a palavra água presente.
4. Com isso, a CONCREVIT volta ao fluxo completo: itens da NF, volume, identificação de fornecedor/carta de traço e tolerância da carta, conforme as regras já vigentes.
5. O botão manual "Marcar como documento não fiscal (água)" continua disponível para os casos em que o OCR erra a classificação.

Nenhuma alteração de banco, de tolerâncias ou de cálculo — apenas a calibragem da detecção no momento da leitura.

## Detalhes técnicos

`src/routes/pesagem.tsx` (bloco `onSuccess` do `ocrMut`):
- `naoFiscalDeclarado = c.tipo_nota === "nao_fiscal" || c.documento_nao_fiscal === true`.
- `indicioAgua` restrito a `produto_categoria === "agua"` ou regex de contexto (`CAMINHAO[- ]?PIPA`, `CAMINHOES[- ]?PIPA`, `ABASTECIMENTO DE AGUA`, `COMPROVANTE DE ABASTECIMENTO`); remover o `\bAGUA\b` genérico e não varrer `itens` por essa palavra.
- `sinaisFiscais` = chave com 44 dígitos, `valor_total_nf > 0`, `itens.length > 1`, ou `c.concreto` com fck/slump/dosagem/volume.
- `ehAguaNaoFiscal = naoFiscalDeclarado && indicioAgua && !sinaisFiscais`.
- Manter o restante do preenchimento, o selo do card Nota e o toggle manual inalterados.
