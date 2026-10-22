# Visualização de notas em PDF sem bloqueios

## Diagnóstico (confirmado no código)

- Hoje a visualização da nota usa `window.open` com um blob URL (`abrirNotaEmNovaAba` em `src/routes/pesagem.tsx`, linhas 1127-1152). O navegador trata isso como pop-up e, no preview embutido/iframe, o bloqueio é silencioso ou cai no toast "Bloqueado pelo navegador" — resultado: o PDF não abre.
- As evidências já salvas no registro são renderizadas apenas como `<img>` (linhas 3772 e 4356). Um PDF nunca renderiza em `<img>`, então aparece quebrado/vazio no dialog de detalhes e na galeria de evidências.

## Correção

1. **Visualizador interno (sem pop-up)**: um dialog de visualização dentro do sistema, aberto ao clicar na miniatura da nota.
   - PDF: renderizado em tela cheia dentro do dialog (área grande, rolagem própria).
   - Imagem: exibida ampliada no mesmo dialog.
   - Rodapé do dialog com dois botões: **Abrir em nova aba** e **Baixar arquivo** — se o navegador bloquear a nova aba, o download continua funcionando, sem depender de pop-up.
2. **Nada de `window.open` como caminho principal**: só via botão explícito do usuário (clique direto = permitido pelo navegador). Sem toast de bloqueio no fluxo normal.
3. **Evidências salvas**: detectar PDF pelo nome/caminho do arquivo e mostrar cartão com ícone + nome (como já é feito na nota recém-importada) em vez de `<img>` quebrado. O clique abre o mesmo visualizador interno usando a URL assinada.
4. Aplicar o mesmo comportamento nos três pontos onde evidências/notas aparecem: card **Peso** (nota importada), galeria de evidências pendentes e dialog de detalhes do registro (entrada/saída).

## Detalhes técnicos

`src/components/visualizador-arquivo-dialog.tsx` (novo)
- Props: `open`, `onOpenChange`, `url` (blob/objectURL ou URL assinada), `nome`, `mimeOuExt`.
- PDF → `<iframe src={url} className="h-[75vh] w-full">` (mesma origem para blob; URL assinada do storage abre normalmente no iframe). Imagem → `<img>` com `max-h-[75vh] object-contain`.
- Botões: abrir em nova aba (`<a target="_blank" rel="noopener">`) e baixar (`<a download={nome}>`), ambos links reais para não sofrerem bloqueio de pop-up.
- Revogar objectURL criado ao fechar.

`src/routes/pesagem.tsx`
- Substituir `abrirNotaEmNovaAba` por `abrirVisualizador({ file?, dataUrl?, url?, nome })`, que cria o objectURL a partir do `File`/data URL quando necessário e abre o dialog.
- Miniatura da nota importada e miniaturas de evidências pendentes passam a chamar `abrirVisualizador`.
- Nos blocos de evidências salvas (linhas ~3772 e ~4356): helper `ehPdf(nome, storage_path)`; quando PDF, renderizar cartão com `FileText` + nome; clique abre o visualizador com a URL assinada.
- Renderizar o dialog uma única vez no fim do componente, controlado por estado.

Sem mudanças em banco de dados, OCR, tolerâncias ou cálculos.
