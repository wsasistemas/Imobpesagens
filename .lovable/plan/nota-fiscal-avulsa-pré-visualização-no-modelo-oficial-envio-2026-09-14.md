# Nota Fiscal Avulsa: pré-visualização no modelo oficial, envio em PDF e entrada no relatório

## O que muda para a Contabilidade

Depois de preencher o formulário da nota e estampar o certificado digital, a
Contabilidade ganha um botão **Pré-visualizar nota**. Ele abre a nota montada
exatamente no desenho do modelo oficial (folha A4, cabeçalho com o aviso de
responsabilidade, Remetente/Emitente, Destinatário, Dados do produto, Cálculo
do imposto, Transportador/volumes, Informações complementares com a estampa do
certificado, Reservado ao fisco e o rodapé "Recebemos de…").

Na pré-visualização há três ações:

- **Baixar PDF** — só salva no computador, nada muda no processo.
- **Confirmar e enviar ao administrativo da obra** — gera o PDF da folha, guarda
  a nota no processo (documento 012) e envia por e-mail, com o PDF em anexo,
  para o administrativo e o engenheiro responsável da obra; segue avisando por
  WhatsApp como já acontece hoje.
- **Fechar** — volta ao formulário para corrigir.

Ao confirmar, a Fase 3 é encerrada e a Fase 4 (Recibo do sucateiro) abre — o
mesmo efeito de hoje, sem precisar anexar um arquivo externo à mão. Anexar um
PDF vindo de fora continua disponível para quem emitir a nota em outro sistema.

## Relatório fotográfico

A nota confirmada passa a ser o documento 012 do processo, então ela entra
automaticamente no relatório fotográfico, na página de documentos do
fechamento, no mesmo desenho da pré-visualização (a primeira página do PDF é
usada como imagem, como já é feito hoje com notas em PDF). Nenhuma mudança de
formato do relatório é necessária.

## Regras

- Só perfis Contabilidade, Administrador e TI podem pré-visualizar e confirmar.
- O processo precisa estar aprovado pelo administrativo da obra, e a nota precisa
  ter número e data de emissão.
- Confirmar de novo gera uma nova versão do documento 012 (o anterior fica
  registrado como substituído, com motivo), sem apagar nada.
- Toda confirmação, envio e falha de e-mail fica registrada no histórico do
  processo.
- Números em pt-BR (kg com separador de milhar, valores em reais).

## Detalhes técnicos

Novos arquivos:

- `src/components/sucata/nfa-folha.tsx` — folha A4 somente leitura no layout do
  modelo (`210mm`, grade de tabelas com bordas), recebendo `campos`, `cfop`,
  `natureza`, `numero`, `emissao` e o texto do certificado. Serve tanto para a
  pré-visualização em tela quanto para a captura do PDF.
- `src/components/sucata/nfa-preview-dialog.tsx` — Dialog do shadcn/ui com a
  folha, rolagem, e os botões Baixar PDF / Confirmar e enviar / Fechar. Geração
  do PDF com `html2canvas-pro` + `jspdf` (mesmo caminho já usado no relatório),
  A4 retrato, imagem JPEG 0.92.

Alterações:

- `src/components/sucata/formulario-nfa.tsx` — troca "Exportar PDF" por
  "Pré-visualizar nota" (mantendo "Salvar rascunho"); antes de abrir, salva o
  rascunho para o preview refletir o que está em tela.
- `src/lib/sucata/nfa.functions.ts` — nova server fn
  `confirmarPreviewNfa({ processoId, numero, emissao, pdfBase64 })`:
  `requireSupabaseAuth`, `exigirAcesso`, `exigirPapel(["contador","admin","superadmin"])`,
  limite de 15 MB, upload em `sucata-evidencias` (`{id}/012-nfa-preview-{ts}.pdf`),
  gravação de `nfa_numero`, `nfa_emissao`, `nfa_storage_path`, inserção da
  evidência 012 (versão nova marcando a anterior como substituída),
  `marcarFases` fechando a fase 3 e abrindo a 4, evento `nfa_preview_confirmada`,
  e chamada do aviso à obra reaproveitando `avisarEmissao`.
- `src/lib/sucata/avisos.server.ts` — `avisarNotaEmitida` passa a aceitar um
  anexo opcional (o PDF da nota) para o e-mail do administrativo/engenheiro;
  quando ausente, comportamento atual.
- `src/routes/sucata.$id.nfa.tsx` — repassa o retorno da confirmação (toast de
  sucesso, avisos de e-mail) e invalida `["sucata"]`.

Sem migração de banco: `nfa_formulario`, `nfa_numero`, `nfa_emissao`,
`nfa_storage_path`, `nfa_enviada_em` e `fases_registro` já existem, e o
documento 012 já é a posição da Nota Fiscal Avulsa.

## Checklist de aceite

- Pré-visualização abre no desenho do modelo oficial, com certificado estampado.
- Baixar PDF funciona sem alterar o processo.
- Confirmar envia o PDF por e-mail ao administrativo e ao engenheiro da obra.
- Nota confirmada aparece como documento 012 e no relatório fotográfico.
- Fase 3 fecha e Fase 4 abre com nome do usuário e data/hora.
- Perfis sem permissão não veem as ações.
