# Nota Fiscal Avulsa aparecendo quebrada nas evidências

## O que está acontecendo

O documento 012 é a Nota Fiscal Avulsa em PDF. O quadro "Evidências fotográficas" da tela do processo trata todas as evidências como foto e tenta mostrar o PDF como se fosse imagem — por isso aparece o quadrinho quebrado com o texto "Nota Fiscal Avulsa", como no print. A nota está guardada corretamente no processo; o problema é só a exibição.

Além disso, o clique nessa miniatura abre um endereço do serviço de armazenamento em outra aba — o mesmo endereço que o navegador da Contabilidade bloqueia.

## Correção

1. **Miniatura da nota** — quando a evidência for PDF, o sistema desenha a primeira página do PDF e usa essa imagem como miniatura, igual à folha da nota. Vale para qualquer documento em PDF anexado ao processo (hoje só o 012).
2. **Abrir a evidência** — o clique passa a abrir a evidência dentro do próprio sistema, em uma janela com a imagem/página ampliada e botão de fechar, sem depender de endereço externo bloqueado pelo navegador.
3. **Relatório fotográfico** — conferir na tela do relatório e no PDF gerado que a nota entra como página visível (o relatório já converte PDF em imagem; será validado com o processo SUC-0004/2026 antes de encerrar).

```text
Antes:  [ ícone quebrado ]  012 Nota Fiscal Avulsa
Depois: [ primeira página da nota ]  012 Nota Fiscal Avulsa   -> clique abre ampliada no sistema
```

## Detalhes técnicos

- `src/components/sucata/grade-evidencias.tsx`: `Miniatura` passa a usar `imagemDaEvidencia` de `src/lib/sucata/relatorio-pdf.ts` (já converte PDF em imagem com pdfjs e imagem comum em base64), com estado de carregando e um quadro "Documento sem prévia" quando a conversão falhar; o `<a href>` externo dá lugar a um `Dialog` do shadcn/ui com a imagem ampliada.
- Reaproveitar `MiniaturaFoto` não serve aqui porque ela não trata PDF; a conversão fica centralizada em `imagemDaEvidencia`.
- Validação: abrir a tela do processo SUC-0004/2026, conferir a miniatura 012 e a janela ampliada, e gerar o relatório fotográfico conferindo a página da nota na imagem do PDF.
- Sem migração de banco e sem alteração no armazenamento das evidências.

## Checklist de aceite

- [ ] Miniatura 012 mostra a primeira página da Nota Fiscal Avulsa
- [ ] Clique abre a evidência ampliada dentro do sistema, sem bloqueio do navegador
- [ ] Relatório fotográfico com a página da nota visível no PDF
- [ ] Fotos comuns (001, 004, 010, 011) continuam funcionando
