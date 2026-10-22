# Máscara de moeda nos campos de valor da NFA + Nº de controle do formulário = número da nota

## Parte 1 — Máscara de valor monetário (2 casas decimais)

### O que você vai ver na tela

Hoje os campos de valor do formulário da NFA aceitam qualquer texto (ex.: "4528"). Com esta mudança, todos os campos de dinheiro do formulário da Fase 3 ganham máscara de moeda brasileira com exatamente 2 casas decimais:

- Você digita `4528` e o campo mostra **4.528,00**.
- Digita `032` e mostra **0,32**.
- Digita `4528,5` e mostra **4.528,50**.
- O que sai na pré-visualização A4, no PDF e na nota guardada no processo é o mesmo texto mascarado — a nota impressa fica idêntica à tela.

### Campos com a máscara

Dados do produto:
- Valor unitário, Valor total, Valor do IPI

Cálculo do imposto:
- Base de cálculo do ICMS, Valor do ICMS, Base ICMS substituição, Valor ICMS substituição, Valor total dos produtos, Valor do frete, Valor do seguro, Outras despesas, Valor total do IPI, Valor total da nota

### Como funciona a digitação

- Só aceita números e uma vírgula decimal; ponto digitado vira separador de milhar automaticamente.
- Enquanto digita, o campo formata em tempo real: milhar com ponto, decimais após a vírgula, sempre 2 casas ao sair do campo.
- Campo vazio continua vazio (não aparece "0,00" sozinho).
- Os valores que o sistema já preenche sozinho (quantidade × valor por quilo do sucateiro) entram já mascarados: ex. 4528 → "4.528,00" e 0,32 → "0,32".

## Parte 2 — Nº de controle do formulário passa a ser o número da nota

### O problema

Na nota gerada (print anexo), o quadro "Nº de controle do formulário" está mostrando o e-mail do usuário ("wagner.antunes@ca...") em vez do número da nota.

### A correção

- O campo **Nº de controle do formulário** passa a mostrar sempre o **número da Nota Fiscal Avulsa** (o mesmo do campo "Nº da nota", ex.: 00001).
- No formulário da Fase 3, esse campo fica **somente leitura** e acompanha automaticamente o número da nota — se a Contabilidade corrigir o número da nota, o controle do formulário muda junto.
- Nada de e-mail nesse quadro: na pré-visualização A4, no PDF e no relatório fotográfico sai apenas o número da nota.

## Detalhes técnicos

- `src/components/sucata/formulario-nfa.tsx`:
  - Novo helper `mascaraMoeda` (texto digitado → "4.528,00"; vírgula = decimal, ponto = milhar; ao perder o foco completa as 2 casas).
  - Nova opção `moeda: true` no helper `campo()` — aplica a máscara em `onChange` e `onBlur`, além da classe numérica.
  - `num()` passa a formatar com `toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })` para os valores automáticos entrarem já mascarados.
  - `numeroControle` deixa de ser um campo livre: o formulário o exibe travado, derivado de `numero`, e ao salvar o rascunho grava `campos.numeroControle = numero` (sobrescrevendo qualquer valor antigo, como o e-mail que ficou gravado).
- `src/components/sucata/nfa-folha.tsx` (prévia/PDF):
  - O quadro "Nº de controle do formulário" passa a exibir o número da nota recebido pela folha, sem depender do texto salvo no rascunho.
- Sem migração de banco: o formulário é texto no `nfa_formulario` (jsonb); o valor mascarado e o número de controle são o próprio conteúdo gravado.
- Nenhuma outra tela é tocada (nada fora do módulo Sucata).

## Validação

- `tsgo` + build OK.
- Teste manual no preview: abrir a Fase 3, digitar `4528` em Valor total → mostra "4.528,00"; abrir a pré-visualização e confirmar que o "Nº de controle do formulário" mostra 00001 (o número da nota), sem e-mail; conferir o mesmo no PDF.

## Premissas

- A máscara vale só para campos de dinheiro. Quantidade (kg), NCM, CST, CFOP, alíquotas e número da nota continuam numéricos simples.
- Alíquotas (ICMS/IPI) não recebem máscara de moeda — se quiser máscara de percentual com 2 casas nelas, avise e eu incluo.
- O e-mail hoje visível no quadro veio de um rascunho antigo gravado no processo; ao salvar/emitir de novo, o número da nota o substitui automaticamente.
