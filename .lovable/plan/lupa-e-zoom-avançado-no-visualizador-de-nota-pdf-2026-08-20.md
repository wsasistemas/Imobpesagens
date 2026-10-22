# Lupa e zoom avançado no visualizador de nota (PDF)

## O que muda para o usuário

O visualizador de PDF passa a ter ferramentas de ampliação de verdade, além dos botões de porcentagem que já existem:

- **Lupa (botão com ícone de lupa)**: ao ligar, o cursor vira uma lente circular que amplia (2x sobre o zoom atual) a região da nota sob o mouse — ideal para ler número da nota, peso e chave de acesso sem perder a visão geral. Clicar de novo desliga.
- **Zoom pela roda do mouse**: Ctrl + roda (ou pinça no trackpad) amplia/reduz mantendo fixo o ponto sob o cursor.
- **Arrastar para navegar**: com a nota ampliada, clicar e arrastar move a visualização (cursor de "mãozinha").
- **Ajustar à largura**: botão que calcula o zoom ideal para a nota ocupar toda a largura disponível.
- **Girar 90°**: útil para notas fotografadas de lado (o caso do anexo, que está levemente rotacionado).
- Faixa de zoom ampliada de 60% até 400%, com atalho de duplo clique para alternar entre ajuste à largura e 200%.

Também aumento a área útil do diálogo (altura maior e menos margem) para a nota aparecer maior por padrão.

## Detalhes técnicos

Alterações concentradas em `src/components/visualizador-arquivo-dialog.tsx`:

- **Renderização**: manter o `pdfjs-dist` desenhando cada página em `<canvas>`, mas separar "escala de renderização" (nítida, recalculada com debounce) do zoom visual, para o zoom responder de imediato sem re-renderizar a cada tique.
- **Lupa**: overlay `div` circular (~180px) posicionado no cursor via `pointermove`, com `background-image` apontando para o `toDataURL()` do canvas da página sob o cursor (gerado uma vez por render) e `background-position` calculada a partir da posição relativa do ponteiro, `background-size` = tamanho do canvas × fator da lente. Nenhuma dependência nova.
- **Wheel zoom**: listener nativo `wheel` com `{ passive: false }` em `useEffect` (o `onWheel` do React é passivo e não permite `preventDefault`), tratando `deltaMode` e usando escala exponencial `z * Math.exp(-dy * 0.0015)`, com `e.ctrlKey` cobrindo a pinça do trackpad; sem Ctrl, a rolagem normal do contêiner continua funcionando. Estado lido por `ref` para evitar closure obsoleta.
- **Ancoragem**: ajustar `scrollLeft/scrollTop` do contêiner após o zoom para manter o ponto sob o cursor estável.
- **Pan**: Pointer Events (`pointerdown/move/up` com `setPointerCapture`) alterando `scrollLeft/scrollTop`.
- **Rotação**: repassar `rotation` ao `page.getViewport({ scale, rotation })` do pdf.js (evita distorção de CSS transform).
- **Fit-to-width**: medir a largura do contêiner com `ResizeObserver` e derivar a escala a partir do viewport da primeira página.
- Limpeza correta de listeners, `ResizeObserver` e tarefas de render ao fechar/trocar arquivo; imagens (JPG/PNG) e o fallback de erro seguem como hoje.
