# Correção da Nota Fiscal Avulsa: anexo do e-mail e visualização da nota emitida

## Parte 1 — a nota anexada ao e-mail está sem formatação

O anexo que chegou ao administrativo da obra saiu como texto corrido com o símbolo do Estado do Rio, sem nenhum quadro. O anexo tem que ser exatamente a folha A4 da prévia — o mesmo desenho que a Contabilidade vê na tela.

### Diagnóstico (a confirmar no primeiro passo)

O PDF do anexo e o PDF do botão "Baixar PDF" saem do mesmo caminho: a folha é fotografada fora da tela e virada em imagem. Na conferência anterior eu só validei tamanho e número de páginas do arquivo, nunca abri a imagem da página; então o mais provável é que **os dois** estejam sem formatação, não só o anexo. Primeiro passo: abrir a nota já emitida e olhar a página como imagem, para confirmar onde a formatação é perdida antes de mexer no código.

### Correção

```text
Prévia na tela  ==  PDF baixado  ==  PDF anexado no e-mail  ==  nota no relatório fotográfico
```

- A folha usada para o PDF passa a ser medida e fotografada no tamanho A4 real, sem forçar uma "janela" artificial que faz o navegador recalcular o desenho e descartar os estilos.
- Se a captura por imagem continuar perdendo o desenho, a folha passa a ser impressa dentro de um quadro isolado que carrega as mesmas folhas de estilo do sistema.
- Validação obrigatória: gerar o PDF, converter em imagem e conferir cabeçalho com o símbolo do Estado, quadros de remetente/destinatário, tabela do produto, totais, transporte, informações complementares com o certificado e o nº de controle igual ao número da nota. Só depois emitir de verdade.

## Parte 2 — botão "Ver a nota emitida" não abre

Hoje o botão abre um endereço do serviço de armazenamento em outra aba, e o navegador da Contabilidade bloqueia esse endereço (a tela em anexo mostra "está bloqueado / ERR_BLOCKED_BY_CLIENT"). Nenhuma configuração do sistema resolve isso, porque o bloqueio acontece no navegador do usuário.

Correção: a nota emitida passa a ser exibida **dentro do próprio sistema**, na mesma janela e com o mesmo desenho da prévia.

```text
+-----------------------------------------------------+
|  Nota Fiscal Avulsa emitida — nº 00001              |
|                                                     |
|   [ folha A4 igual à da prévia, somente leitura ]   |
|                                                     |
|          [ Baixar PDF ]        [ Fechar ]           |
+-----------------------------------------------------+
```

- Ao clicar em "Ver a nota emitida", abre a janela com a folha da nota exatamente como foi emitida (dados gravados no processo), sem sair do sistema e sem depender de endereço externo.
- Não aparece o botão de emitir: a nota já foi emitida, a janela é apenas de consulta.
- "Baixar PDF" entrega o arquivo pelo próprio endereço do sistema, então também não é bloqueado pelo navegador.

## Detalhes técnicos

- `src/lib/sucata/nfa-pdf.ts`: retirar `windowWidth`/`windowHeight` do html2canvas (forçam relayout do clone) e capturar a folha pelo tamanho real do elemento; manter `scale: 2` e fundo branco. Se o clone continuar sem estilo, renderizar em `iframe` com os `<link>`/`<style>` do documento antes da captura.
- `src/components/sucata/nfa-preview-dialog.tsx`: folha do PDF sai do `left:-10000px; z-index:-1` e passa a ficar fora da tela por `clip`/`opacity`, mantendo largura A4 verdadeira; nova prop `somenteLeitura` que esconde a ação de emitir e ajusta título/descrição para "nota emitida".
- `src/components/sucata/formulario-nfa.tsx`: "Ver a nota emitida" deixa de chamar `urlNfaEmitida` + `window.open` e passa a abrir o `NfaPreviewDialog` em modo somente leitura, montado com os campos gravados em `nfa_formulario`, número e data da nota.
- `src/lib/sucata/nfa.functions.ts`: `urlNfaEmitida` passa a devolver o PDF em base64 (nova função `pdfNfaEmitida`, mesma verificação de acesso), servido pelo próprio domínio do app para o download; a função antiga deixa de ser usada pela tela.
- Nada muda em `nfa-folha.tsx` (conteúdo/layout), em `confirmarPreviewNfa` (já anexa o PDF recebido da tela) nem em `avisos.server.ts`.
- Sem migração de banco.

## Checklist de aceite

- [ ] Imagem da página do PDF idêntica à prévia da tela
- [ ] Anexo do e-mail ao administrativo com o mesmo arquivo validado
- [ ] Nota no relatório fotográfico com o mesmo desenho
- [ ] "Ver a nota emitida" abre a folha dentro do sistema, sem bloqueio do navegador
- [ ] Download da nota emitida funcionando pelo próprio sistema
