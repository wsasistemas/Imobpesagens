# Correção do layout do Relatório Fotográfico — duas páginas

## Objetivo

Remontar o Relatório Fotográfico no padrão CALPER do anexo: apenas duas páginas A4, quatro quadros de evidência por página e as fotos em tamanho reduzido dentro dos quadros.

## Estrutura

O processo tem cinco evidências: 001, 004, 010, 011 e 012.

```text
PÁGINA 1
┌──────────────────────────────────────────────┐
│ Logo │ Tipo de Documento: MODELO             │
│      │ Título: RELATÓRIO FOTOGRÁFICO         │
├─────────────────────────┬────────────────────┤
│ Origem/Obra             │ Data               │
├─────────────────────────┼────────────────────┤
│ Descrição               │ Relator            │
├─────────────────────────┼────────────────────┤
│ 001 caminhão vazio      │ 004 caçamba cheia  │
│ Foto / Descrição        │ Foto / Descrição   │
├─────────────────────────┼────────────────────┤
│ 010 recibo              │ 011 comprovante    │
│ Foto / Descrição        │ Foto / Descrição   │
└─────────────────────────┴────────────────────┘

PÁGINA 2
┌──────────────────────────────────────────────┐
│ Logo │ Tipo de Documento: MODELO             │
│      │ Título: RELATÓRIO FOTOGRÁFICO         │
├─────────────────────────┬────────────────────┤
│ 012 Nota Fiscal Avulsa  │ quadro reservado   │
│ Foto / Descrição        │ sem evidência      │
└─────────────────────────┴────────────────────┘
```

## Alterações

1. **Reduzir o relatório para duas páginas**
   - A terceira página exclusiva da nota deixa de existir.
   - O PDF, a impressão e a pré-visualização terão exatamente duas páginas.

2. **Cabeçalho igual ao anexo**
   - Logo CALPER em célula própria à esquerda.
   - `Tipo de Documento: MODELO`.
   - `Título do Documento: RELATÓRIO FOTOGRÁFICO`.
   - Quadro de identificação com obra, data, descrição e relator na primeira página.
   - Cabeçalho repetido na segunda página, como no modelo.

3. **Quatro quadros por página**
   - Grade de duas colunas por duas linhas.
   - Página 1: 001, 004, 010 e 011.
   - Página 2: 012 e um quadro reservado para manter a grade alinhada.
   - Todos os quadros com bordas fechadas nos quatro lados e mesmo tamanho.

4. **Fotos reduzidas dentro dos quadros**
   - Cada quadro terá área de imagem com altura fixa menor, como no modelo.
   - A foto será centralizada, com margens brancas ao redor.
   - Proporção original preservada, sem esticar nem cortar.
   - Abaixo da imagem, as linhas `Foto` com o código e `Descrição` com o texto da posição.

5. **Nota Fiscal Avulsa 012 dentro do quadro**
   - A nota será desenhada pelo mesmo modelo oficial usado no preview da emissão.
   - Será reduzida proporcionalmente para caber na área de imagem do quadro, como as fotos.
   - Não será usado o arquivo PDF antigo deformado.

6. **Mesma aparência em todos os destinos**
   - Pré-visualização na tela, impressão, PDF baixado e PDF enviado por e-mail seguirão o mesmo layout de duas páginas.

## Arquivos previstos

- `src/components/sucata/relatorio-fotografico.tsx`
- `src/routes/sucata.$id.relatorio.tsx`
- `src/lib/sucata/relatorio-pdf.ts`, apenas se necessário para a captura correta das duas páginas.

## Validação visual obrigatória

- Conferir a pré-visualização das duas páginas.
- Comparar cabeçalho, textos, logo e bordas com o anexo.
- Verificar quatro quadros iguais na página 1.
- Verificar fotos reduzidas e centralizadas, sem cortes nem deformação.
- Verificar a nota 012 legível dentro do quadro, no modelo oficial.
- Gerar o PDF, converter as páginas em imagens e inspecionar visualmente.
- Confirmar que o PDF tem exatamente duas páginas.

## Checklist de aceite

- [ ] Relatório com exatamente duas páginas.
- [ ] Quatro quadros de evidência por página.
- [ ] Cabeçalho igual ao modelo anexado.
- [ ] Fotos em tamanho reduzido dentro dos quadros.
- [ ] Nenhuma imagem ou texto fora das bordas.
- [ ] Nota 012 no modelo oficial, reduzida no quadro.
- [ ] Pré-visualização, impressão e PDF idênticos.
- [ ] Fluxo, permissões e dados do processo inalterados.

## Banco de dados

Nenhuma migração necessária. A mudança é apenas de layout e geração do relatório.
