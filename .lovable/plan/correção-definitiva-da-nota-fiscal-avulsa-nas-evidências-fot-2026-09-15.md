# Correção definitiva da Nota Fiscal Avulsa nas Evidências Fotográficas

## Diagnóstico confirmado pelo print

O quadro **Evidências fotográficas** ainda trata a evidência `012 — Nota Fiscal Avulsa` como um PDF comum. Ao clicar, o sistema abre uma imagem extraída do arquivo antigo armazenado, que está sem o desenho correto.

A prévia da emissão e a nova página do Relatório Fotográfico já conseguem montar a nota com o modelo correto. Falta aplicar exatamente essa mesma apresentação na evidência 012 da tela do processo.

## Resultado visual

```text
EVIDÊNCIAS FOTOGRÁFICAS

[001 Caminhão] [004 Caçamba] [010 Recibo]
[011 Comprovante] [012 Nota Fiscal Avulsa]
                              │
                              └── clique
                                  ↓
┌──────────────────────────────────────────────────────┐
│  012 — Nota Fiscal Avulsa                       ×    │
│                                                      │
│       NOTA FISCAL AVULSA NO MODELO OFICIAL           │
│       • mesmo desenho do preview da emissão          │
│       • símbolo da Receita Estadual                  │
│       • quadros, textos e valores nas mesmas posições│
│       • certificado digital e rodapé                 │
│                                                      │
│                                      [Fechar]         │
└──────────────────────────────────────────────────────┘
```

## Alterações

1. **Tratar a evidência 012 de forma específica**
   - Fotos 001, 004, 010 e 011 continuam usando a visualização atual.
   - A evidência 012 deixa de abrir a imagem extraída do PDF antigo.

2. **Usar o mesmo modelo da prévia emitida**
   - A janela da evidência 012 será montada com a mesma folha oficial usada em **Pré-visualização da Nota Fiscal Avulsa**.
   - Os dados virão do formulário salvo no processo: número, emissão, CFOP, natureza da operação, emitente, destinatário, produtos, valores, transporte, certificado e número de controle.
   - A visualização será somente leitura.

3. **Miniatura correta na grade**
   - A miniatura 012 também será gerada a partir do modelo correto, sem mostrar o PDF antigo deformado.
   - Ao clicar, a nota abrirá ampliada dentro do sistema, mantendo proporção A4 e sem cortes.

4. **Unificar as três apresentações**
   - Preview da emissão.
   - Evidência 012 na tela do processo.
   - Página 3 do Relatório Fotográfico e seu PDF final.
   - Todas usarão o mesmo componente de nota e os mesmos dados salvos, evitando diferenças futuras.

5. **Compatibilidade com notas já emitidas**
   - O processo `SUC-0004/2026` e outras emissões antigas serão mostrados no formato correto sem exigir nova emissão.
   - O arquivo histórico permanece preservado; apenas sua apresentação visual deixa de depender da versão deformada.

## Arquivos previstos

- `src/components/sucata/grade-evidencias.tsx`
- `src/routes/sucata.$id.index.tsx`
- Reutilização de `src/components/sucata/nfa-folha.tsx` e da consulta de dados já usada na emissão.

## Validação visual obrigatória

- Abrir a evidência 012 do processo `SUC-0004/2026`.
- Comparar lado a lado com o preview correto enviado no anexo.
- Conferir símbolo, cabeçalho, quadros, CFOP, valores, certificado, número de controle e rodapé.
- Conferir a miniatura 012.
- Conferir que fotos 001, 004, 010 e 011 continuam abrindo normalmente.
- Gerar uma nova versão do Relatório Fotográfico e confirmar que a página 3 permanece igual à evidência 012.

## Checklist de aceite

- [ ] Evidência 012 não abre mais o PDF antigo deformado.
- [ ] Janela ampliada mostra o mesmo layout do preview da nota emitida.
- [ ] Miniatura 012 representa corretamente a nota.
- [ ] Nota aparece inteira, em proporção A4 e sem cortes.
- [ ] Dados e certificado permanecem iguais aos da emissão.
- [ ] Página 3 do relatório final permanece idêntica.
- [ ] Demais fotos continuam funcionando.

## Banco de dados

Nenhuma migração será necessária. A correção será somente na apresentação da evidência 012, reutilizando os dados já gravados no processo.
