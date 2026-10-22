# Correção da Nota Fiscal Avulsa no Relatório Fotográfico

## Diagnóstico confirmado

A Nota Fiscal Avulsa emitida está armazenada como PDF e sua primeira página é convertida corretamente em imagem. Porém, o relatório atual coloca essa imagem dentro de um quadro pequeno da grade de evidências, com duas colunas e altura limitada. Por isso a nota fica reduzida e não mantém a apresentação A4 mostrada no preview correto.

## Resultado visual proposto

```text
RELATÓRIO FOTOGRÁFICO

Página 1 — Entrada e saída
┌──────────────────────┬──────────────────────┐
│ Foto 001             │ Foto 004             │
│ Caminhão vazio       │ Caçamba cheia        │
└──────────────────────┴──────────────────────┘

Página 2 — Documentos do fechamento
┌──────────────────────┬──────────────────────┐
│ Foto 010             │ Foto 011             │
│ Recibo do sucateiro  │ Comprovante bancário │
└──────────────────────┴──────────────────────┘

Página 3 — Nota Fiscal Avulsa
┌─────────────────────────────────────────────┐
│                                             │
│      NOTA FISCAL AVULSA EM A4 INTEIRO       │
│      mesmo desenho do preview emitido       │
│                                             │
└─────────────────────────────────────────────┘
```

## Alterações

1. **Separar a evidência 012 da grade de fotos**
   - A Nota Fiscal Avulsa não será mais exibida como uma miniatura ao lado do recibo ou comprovante.
   - A grade continuará somente com as fotos 001, 004, 010 e 011.

2. **Criar uma página exclusiva para a Nota Fiscal Avulsa**
   - Adicionar ao relatório uma terceira página A4 dedicada à nota.
   - Usar a primeira página do PDF emitido, mantendo proporção, margens e orientação.
   - Exibir o desenho completo: símbolo da Receita Estadual, quadros, textos, certificado digital e rodapé.
   - Não recortar, esticar ou reorganizar os campos.

3. **Manter a mesma origem da nota emitida**
   - O relatório usará o PDF definitivo guardado na evidência 012, e não reconstruirá outra versão da nota.
   - Assim, o conteúdo do relatório será exatamente o documento confirmado na emissão.

4. **Aplicar em todos os caminhos do relatório**
   - Corrigir a pré-visualização do Relatório Fotográfico.
   - Corrigir o PDF baixado/gerado.
   - Corrigir o PDF enviado por e-mail.
   - Corrigir novas versões geradas após o processo já estar concluído.

## Arquivos previstos

- `src/components/sucata/relatorio-fotografico.tsx`
- `src/lib/sucata/relatorio-pdf.ts`
- Ajustes mínimos nos pontos que usam a quantidade de páginas do relatório, se necessários.

## Validação visual obrigatória

- Abrir o processo `SUC-0004/2026` e comparar a Nota Fiscal Avulsa emitida com a página 3 do relatório.
- Confirmar que símbolo, quadros, textos, certificado e rodapé aparecem inteiros e nas mesmas posições.
- Gerar o PDF final e converter suas páginas em imagens para inspeção visual.
- Conferir que as fotos 001, 004, 010 e 011 continuam corretas.
- Conferir que o anexo enviado por e-mail é o mesmo PDF aprovado na tela.

## Checklist de aceite

- [ ] Nota Fiscal Avulsa removida do quadro pequeno da grade.
- [ ] Nota Fiscal Avulsa ocupa uma página A4 exclusiva no relatório.
- [ ] Página da nota mantém o mesmo formato do preview emitido.
- [ ] Símbolo e todos os campos aparecem sem corte ou deformação.
- [ ] Pré-visualização, download e anexo do e-mail mostram o mesmo relatório.
- [ ] Fotos e documentos das demais fases permanecem corretos.

## Banco de dados

Nenhuma migração será necessária. A correção será somente na composição visual do relatório e na geração do PDF.
