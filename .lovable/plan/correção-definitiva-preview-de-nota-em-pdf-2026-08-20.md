# Correção definitiva: preview de nota em PDF

## O que está acontecendo

O visualizador atual mostra o PDF dentro de um `iframe`, o que depende do leitor de PDF interno do navegador (um plugin). Quando o app roda dentro de outro quadro (pré-visualização do editor) ou quando o arquivo vem de um endereço temporário do armazenamento, o Chrome bloqueia esse plugin e exibe exatamente a mensagem do anexo: "Esta página foi bloqueada pelo Chrome". Não é erro do arquivo nem da nota — é o modo de exibição escolhido.

## Correção proposta

Passar a **renderizar o PDF dentro do próprio sistema**, página por página, em vez de delegar ao plugin do navegador. Assim a nota aparece sempre, independente de bloqueio, pop-up ou ambiente.

O que o usuário verá no visualizador:

- A nota em PDF renderizada direto na tela, com rolagem entre as páginas.
- Contador de páginas e controles de zoom (mais / menos / ajustar à largura).
- Indicador de carregamento enquanto a nota é processada.
- Caso raro de falha na renderização: cartão claro com o nome do arquivo e os botões "Abrir em nova aba" e "Baixar arquivo" (mantidos como hoje).
- Imagens (JPG/PNG) continuam exibidas como hoje.

Nada muda no fluxo de leitura da nota (OCR), no salvamento nem nos registros — apenas a forma de exibir o arquivo.

## Detalhes técnicos

- Adicionar a dependência `pdfjs-dist` e configurar o worker via import de URL do próprio bundle (sem CDN externo), evitando falha de rede/CSP.
- Reescrever `src/components/visualizador-arquivo-dialog.tsx`:
  - Novo subcomponente `PdfCanvasViewer` que baixa o arquivo com `fetch` → `ArrayBuffer` → `getDocument({ data })` e desenha cada página em `<canvas>`, respeitando `devicePixelRatio` e um fator de escala controlado pelo estado de zoom.
  - Carregamento e renderização apenas no cliente (dentro de `useEffect`), com `cancel`/cleanup ao trocar de arquivo ou fechar o diálogo, e limite de páginas renderizadas por vez para arquivos grandes.
  - Estado `erro` que faz cair no cartão de fallback com as ações de abrir/baixar.
  - Manter as exportações atuais (`ehArquivoPdf`, `ArquivoVisualizacao`, `VisualizadorArquivoDialog`) para não impactar `src/routes/pesagem.tsx` nem os outros pontos de chamada.
- O botão "Baixar arquivo" passa a usar o blob já carregado quando disponível, evitando um segundo pedido ao armazenamento.
