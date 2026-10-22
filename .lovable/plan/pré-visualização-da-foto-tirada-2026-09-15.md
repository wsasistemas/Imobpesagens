# Pré-visualização da foto tirada

## O que muda

Hoje, depois de tirar a foto, a tela só mostra o selo verde "Foto registrada" — não é possível ver o que foi fotografado. Passa a aparecer, exatamente no espaço marcado em vermelho no print (à direita do bloco da foto), uma miniatura da foto tirada.

- A miniatura é clicável: abre a foto grande, para o usuário conferir a qualidade (nitidez, placa legível, enquadramento).
- Na janela ampliada: botões "Tirar outra foto" e "Fechar".
- Se a foto ficou ruim, "Tirar outra foto" substitui na hora, sem sair da tela.
- Enquanto não houver foto, o espaço mostra um quadro tracejado com "Sem foto".

## Onde aparece

1. Tela de pesagem — modo Sucata, entrada do caminhão: foto 001 (caminhão vazio com a placa), local do print.
2. Tela de pesagem — saída do caminhão: foto 004 (caçamba cheia), mesmo comportamento.
3. Tela do processo (fases 1, 2 e 4): cada linha de foto (001, 004, 010 recibo, 011 comprovante) ganha a mesma miniatura clicável, mostrando a foto já guardada no processo.

## Detalhes técnicos

- `src/components/sucata/painel-sucata.tsx` → `BlocoFoto`: gerar `URL.createObjectURL(arquivo)` em `useEffect` com revogação na limpeza; miniatura ~96px à direita (`ml-auto`), botão de imagem abrindo `Dialog` do shadcn/ui com a imagem em tamanho máximo e as ações Tirar outra foto / Fechar.
- `src/components/sucata/passos-sucata.tsx` → `ItemFoto`: recebe a evidência vigente da posição (já disponível em `evidencias`), busca a URL curta com `urlAssinada(storage_path)` (padrão já usado em `grade-evidencias.tsx`) e mostra a mesma miniatura + diálogo; sem foto, quadro tracejado.
- Novo componente compartilhado `src/components/sucata/miniatura-foto.tsx` com a miniatura e o diálogo, usado pelos dois arquivos (evita duplicação).
- Somente apresentação: nenhuma alteração em banco, RLS, upload, compressão ou regras de fase. Nenhuma tela fora do módulo Sucata é tocada.
- Em pt-BR, shadcn/ui, `loading="lazy"` na miniatura, `alt` com o rótulo da posição.

## Checklist de aceite

- [ ] Miniatura da foto aparece no local marcado, logo após tirar a foto
- [ ] Clique na miniatura abre a foto grande para conferir a qualidade
- [ ] Botão "Tirar outra foto" dentro da janela substitui a foto
- [ ] Sem foto: quadro tracejado "Sem foto"
- [ ] Mesmo comportamento na entrada, na saída e nas fotos das fases do processo
