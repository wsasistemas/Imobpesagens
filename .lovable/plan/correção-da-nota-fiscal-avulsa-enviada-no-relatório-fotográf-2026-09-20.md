# Correção da Nota Fiscal Avulsa enviada no relatório fotográfico

## O problema, confirmado no código

A folha da Nota Fiscal Avulsa (`src/components/sucata/nfa-folha.tsx`) é montada quase inteiramente com CSS Grid (a função interna `grade()` usa `display: grid`). A conversão da folha em imagem para o arquivo da nota (`src/lib/sucata/nfa-pdf.ts`) usa `html2canvas-pro`, que **não desenha CSS Grid**: todas as células caem uma sobre a outra no mesmo ponto. É exatamente o que aparece no print — rótulos azuis sobrepostos aos valores, sem quadros e sem alinhamento.

Além disso, na tela do relatório a nota é convertida por outro caminho (`html-to-image`, que respeita Grid). Quando essa conversão ainda não terminou ou falha, o relatório cai no arquivo da nota guardado como evidência 012 — que é justamente o arquivo defeituoso. Por isso o e-mail sai com a nota quebrada mesmo quando a prévia da tela parecia correta.

## O que será feito

1. **Reescrever o desenho da folha da nota sem CSS Grid**, usando linhas e colunas com flexbox e tabelas (compatíveis com as duas bibliotecas de captura). O visual, os campos, as medidas em A4, o símbolo da Receita e os textos permanecem os mesmos — muda só a técnica de montagem.
2. **Unificar a conversão da folha em imagem**: um único utilitário passa a ser usado pela emissão da nota, pela evidência 012 e pelo relatório fotográfico, para os três saírem sempre idênticos.
3. **Bloquear o envio com nota defeituosa**: o relatório só usa a nota recém-renderizada. Se a renderização não concluir, o botão de enviar continua bloqueado com aviso claro, em vez de cair no arquivo antigo.
4. **Validação visual** com o processo que já tem nota emitida: gerar o PDF do relatório, abrir as duas páginas e conferir que a nota aparece completa, com quadros, números e sem sobreposição — antes de considerar concluído.

## Sobre notas já emitidas

Nada é apagado. As versões de relatório já enviadas continuam guardadas. Para um processo já concluído com a nota quebrada, o reenvio continua usando o arquivo original (regra de imutabilidade); se você quiser reemitir o relatório corrigido desses processos, isso é feito por TI, gerando uma nova versão — me avise se quer que eu inclua isso.

## Detalhes técnicos

- Arquivos alterados: `src/components/sucata/nfa-folha.tsx` (grid → flex/tabela), `src/lib/sucata/nfa-pdf.ts` e `src/lib/sucata/relatorio-pdf.ts` (caminho único de captura via `html-to-image`), `src/routes/sucata.$id.relatorio.tsx` (remoção do recurso ao arquivo antigo como imagem da nota).
- Sem migração de banco, sem alteração de RLS, sem novas dependências.
- Nada fora do módulo Sucata é tocado.
