# Reimprimir com pré-visualização dentro do sistema

## Problema
O botão "Reimprimir relatório emitido" abre o arquivo em uma nova aba, num endereço externo de armazenamento. O navegador (extensão/bloqueador) bloqueia esse endereço e mostra "está bloqueado — ERR_BLOCKED_BY_CLIENT". Resultado: o usuário não vê nem imprime o relatório.

## Correção
1. Nenhuma ação de reimpressão abrirá endereço externo nem nova aba.
2. Ao clicar em "Reimprimir relatório emitido", o sistema baixa o arquivo definitivo já enviado por e-mail e mostra a pré-visualização em uma janela dentro do próprio sistema, com as páginas exatamente como no anexo do e-mail.
3. Dentro dessa janela ficam dois botões: "Imprimir" (abre a impressão do arquivo pré-visualizado) e "Baixar".
4. A lista "Versões geradas" passa a usar a mesma pré-visualização interna, em vez de abrir aba nova.
5. Continua valendo a regra da Fase 4: o arquivo é somente leitura, sem gerar versão nova; reimprimir e reenviar usam sempre o mesmo arquivo salvo.
6. Se o download falhar, aparece aviso claro em português com opção de tentar de novo — nunca tela em branco.

## Detalhes técnicos
- `sucata.$id.relatorio.tsx`: remover `window.open` de `abrirEmitido` e da lista de versões; buscar o PDF via `urlRelatorio` + `fetch` e criar `blob:` local.
- Novo componente de diálogo (shadcn `Dialog`) com `<iframe src={blobUrl}>` em proporção A4 e botões Imprimir (`iframe.contentWindow.print()`) e Baixar (`<a download>`).
- `URL.revokeObjectURL` ao fechar o diálogo.
- Sem migração de banco, sem alteração no gerador do PDF nem no envio por e-mail.

## Checklist de aceite
- [ ] Reimprimir mostra a pré-visualização dentro do sistema, sem nova aba
- [ ] Pré-visualização idêntica ao anexo do e-mail (2 páginas A4)
- [ ] Botão Imprimir funciona a partir da pré-visualização
- [ ] Nenhum bloqueio do navegador (ERR_BLOCKED_BY_CLIENT)
- [ ] Versões geradas abrem na mesma pré-visualização interna
- [ ] Arquivo permanece imutável e o mesmo em reimprimir/reenviar
