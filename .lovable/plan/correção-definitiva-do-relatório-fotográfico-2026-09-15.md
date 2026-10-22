# Correção definitiva do relatório fotográfico

## Diagnóstico confirmado

- O arquivo anexado **não corresponde à pré-visualização atual**: perdeu a grade, os enquadramentos e os tamanhos definidos, ampliou apenas o símbolo vermelho da marca e deixou a Nota Fiscal cortada na página seguinte.
- A tela atual do processo SUC-0004/2026 renderiza corretamente duas folhas A4, com a logo horizontal `calper — gestão compartilhada`, quatro evidências na página 1 e a Nota Fiscal na página 2.
- Portanto, a correção será feita no caminho que transforma a pré-visualização em arquivo definitivo e na forma como o arquivo já emitido é reapresentado. Não será feito outro ajuste visual por tentativa.

## Resultado obrigatório

### Página 1 de 2
- Cabeçalho CALPER completo, proporcional e sem ampliação.
- Identificação da obra, data, descrição e relator.
- Grade 2 × 2 com as evidências 001, 004, 010 e 011.
- Cada imagem reduzida e centralizada dentro do próprio quadro, sem corte ou deformação.
- Rodapé `Página 1 de 2`.

### Página 2 de 2
- Mesmo cabeçalho CALPER completo.
- Um único quadro para a evidência 012.
- Nota Fiscal Avulsa inteira, proporcional e centralizada no quadro, usando exatamente o mesmo desenho da prévia oficial.
- Rodapé `Página 2 de 2`.
- Nenhuma folha intermediária ou página em branco.

## Implementação

1. **Eliminar a saída que perde a formatação**
   - Retirar a impressão direta da página como forma de emitir o documento.
   - Gerar sempre o PDF a partir de duas folhas A4 isoladas, com dimensões fixas, sem depender da escala da tela ou dos estilos de impressão do navegador.
   - Esperar logo, fotos, Nota Fiscal e fontes terminarem de carregar antes da captura.

2. **Usar um único arquivo em todas as ações**
   - A prévia de emissão, o download, a impressão, o anexo enviado e o reenvio serão derivados do mesmo PDF validado.
   - Depois da emissão, `Reimprimir` e `Reenviar` continuarão abrindo/enviando somente o arquivo salvo, sem reconstruir o relatório.
   - Bloquear nova emissão enquanto existir um relatório definitivo válido.

3. **Corrigir o relatório já emitido incorretamente**
   - Criar uma única versão corretiva para o processo afetado, sem sobrescrever nem apagar o arquivo anterior.
   - Registrar a substituição como correção técnica no histórico.
   - Tornar essa versão corrigida o arquivo definitivo usado em todas as reimpressões e reenvios seguintes.
   - Depois dessa correção, o relatório permanece imutável conforme a regra da Fase 4.

4. **Validação obrigatória antes de liberar**
   - Gerar o arquivo real do processo SUC-0004/2026.
   - Confirmar tecnicamente: PDF A4, exatamente 2 páginas e nenhuma terceira página vazia.
   - Converter as duas páginas do PDF em imagens e conferir visualmente logo, quadros, fotos, Nota Fiscal e rodapés.
   - Comparar as imagens finais com a pré-visualização lado a lado.
   - Testar `Reimprimir` e `Reenviar` e confirmar que ambos reutilizam exatamente o mesmo arquivo salvo.
   - Só considerar concluído quando o PDF real passar por todas essas verificações.

## Arquivos previstos

- `src/components/sucata/relatorio-fotografico.tsx`
- `src/lib/sucata/relatorio-pdf.ts`
- `src/routes/sucata.$id.relatorio.tsx`
- `src/lib/sucata/relatorio.functions.ts`

## Banco de dados

- Sem nova tabela e sem migração destrutiva.
- A versão anterior será preservada para auditoria; a correção será registrada de forma aditiva no histórico existente.

## Checklist de aceite

- [ ] PDF com exatamente 2 páginas A4 sequenciais
- [ ] Logo horizontal correta e proporcional nas duas páginas
- [ ] Quatro evidências enquadradas na página 1
- [ ] Nota Fiscal completa e enquadrada na página 2
- [ ] Nenhuma página em branco
- [ ] Prévia, download, impressão e anexo visualmente idênticos
- [ ] Relatório definitivo bloqueado para edição
- [ ] Reimpressão e reenvio usando o mesmo arquivo salvo
- [ ] Correção do relatório existente registrada sem apagar o histórico
