# Sucata: timeline em 4 fases e encerramento automático com o relatório fotográfico

## O que está acontecendo hoje

- A caixa "Histórico do processo" e o selo de fase no topo da tela do processo ainda usam a lista antiga de 15 fases (F01–F15). Por isso aparecem etapas que não existem mais (Carregamento monitorado, Aceite do peso, Entrega no depósito etc.) e a fase "atual" fica errada.
- Quando a Contabilidade clica em "Anexar, enviar ao sucateiro e encerrar", o sistema já anexa a nota, envia o e-mail ao sucateiro e marca o processo como concluído — mas não gera o relatório fotográfico. A tela de relatório, por sua vez, ainda exige "12 evidências" e recusa processos já concluídos, ou seja, o relatório final nunca é produzido no fluxo remodelado.
- O relatório (2 páginas) traz o rodapé "Página X de 3" e mostra a foto 012 apenas quando a nota é imagem; se a nota for PDF, o quadro fica em branco.

## O que será feito

### 1. Timeline em 4 fases (tela do processo)

- "Histórico do processo" passa a listar as 4 fases: Entrada do caminhão, Saída do caminhão, Recibo do sucateiro e Nota Fiscal Avulsa.
- Cada fase mostra os marcos que a compõem, com data/hora e quem fez, vindos da auditoria:
  - Fase 1: entrada registrada · foto 001
  - Fase 2: saída registrada · foto 004
  - Fase 3: valor informado · foto 010 · foto 011
  - Fase 4: pedido enviado à Contabilidade · nota anexada · nota enviada ao sucateiro · relatório fotográfico gerado e processo encerrado
- Cores na tríade: verde concluída, âmbar em andamento (com "em aberto há X"), cinza aguardando.
- O selo no topo da página passa a mostrar "FASE N · nome — responsável" com base nas mesmas 4 fases.

### 2. Fase 4 encerra com o relatório fotográfico

Novo fluxo do botão da Contabilidade, renomeado para "Anexar nota, enviar ao sucateiro e encerrar":

1. Anexa a nota (foto 012) e envia o e-mail ao sucateiro, como hoje.
2. Se o e-mail ao sucateiro sair, o sistema monta o relatório fotográfico (mesmo padrão CALPER da tela de relatório) com as 5 fotos, incluindo o preview da nota enviada, gera o PDF, guarda a versão no processo e envia aos destinatários ativos da coligada (Sucata › Cadastros › Destinatários do relatório).
3. Encerra o processo. O encerramento acontece mesmo que a lista de destinatários esteja vazia ou algum e-mail falhe: o PDF fica guardado no processo e o envio pode ser refeito na tela de relatório.
4. Se o e-mail ao sucateiro falhar (sem e-mail cadastrado ou erro de envio), o processo fica aberto na Fase 4 com um botão "Reenviar nota e encerrar" para tentar de novo.

Na Fase 4 aparece um novo campo "Relatório fotográfico" com a versão gerada, data e link para abrir o PDF.

### 3. Preview da nota no relatório

- Se a nota anexada for imagem, entra direto no quadro 012.
- Se for PDF, a primeira página é convertida em imagem (com a mesma biblioteca já usada no visualizador de notas do portal) e entra no quadro 012.
- Rodapé corrigido para "Página X de 2" (calculado, não fixo).

### 4. Tela de relatório alinhada ao processo remodelado

- Passa a exigir as 5 fotos (não 12) e permite reenviar o relatório de um processo já concluído, gerando nova versão, sem alterar o encerramento.
- Texto "12 evidências" atualizado.

## Detalhes técnicos

Arquivos a alterar:

- `src/lib/sucata/fases-v2.ts` — adicionar, por fase, a lista de marcos (`acoes`/posições de foto) usados pela timeline.
- `src/components/sucata/timeline-processo.tsx` — reescrever sobre `FASES_V2` + marcos, recebendo eventos, evidências e o processo.
- `src/routes/sucata.$id.index.tsx` — selo de fase atual via `estadoDasFases`/`faseAtual`; passar evidências e processo à timeline.
- `src/components/sucata/relatorio-fotografico.tsx` — total de páginas calculado a partir dos blocos renderizados.
- `src/lib/sucata/relatorio-pdf.ts` (novo, client) — extrair de `sucata.$id.relatorio.tsx` a montagem das fotos em base64, o preview da 1ª página de PDF via `pdfjs-dist` e a geração do PDF (`html2canvas-pro` + `jspdf`), para reutilizar na Fase 4 e na tela de relatório.
- `src/components/sucata/passos-sucata.tsx` — após `anexarNfa` com envio ao sucateiro OK, renderizar o relatório oculto, gerar o PDF e chamar `encerrarComRelatorio`; botão "Reenviar nota e encerrar" quando `nfa_numero` existe e `nfa_enviada_em` está vazio; bloco "Relatório fotográfico" com versão/link.
- `src/lib/sucata/nfa.functions.ts` — `anexarNfa` deixa de marcar `situacao = CONCLUIDO`; passa a retornar `envioOk` e o encerramento fica com o relatório. Nova função `reenviarNfaSucateiro` (ou reaproveitar `enviarNfaSucateiro`) para o retry.
- `src/lib/sucata/relatorio.functions.ts` — exigência de 5 evidências (posições 1, 4, 10, 11, 12) em vez de 12; nova função `encerrarComRelatorio` (perfis contador/admin/superadmin) que busca os destinatários ativos da coligada no servidor, guarda o PDF versionado, envia e-mails, registra `sucata_relatorios`, encerra o processo (`situacao = CONCLUIDO`, `concluido_em`, `relatorio_versao`) e audita `processo_encerrado` com `{ versao, enviados, falhas }`. `enviarRelatorioConcluir` passa a aceitar processo concluído (gera nova versão, não altera o encerramento).
- `src/routes/sucata.$id.relatorio.tsx` — usar o helper compartilhado; textos e trava de 5 fotos.
- `docs/sucata.md` — atualizar a seção de fases e encerramento.

Regras mantidas:

- Nenhuma migração: colunas `relatorio_versao`, `concluido_em`, `nfa_enviada_em` e tabela `sucata_relatorios` já existem; o gatilho do banco continua exigindo as 5 fotos para encerrar.
- Autorização no servidor (papel e acesso ao processo pela RLS); segredos de e-mail continuam no servidor.
- Processos antigos com a coluna `fase` em códigos F01–F15 continuam válidos; a timeline é derivada de dados e eventos, não do código da fase.

## Checklist de aceite

- [ ] Histórico do processo mostra apenas 4 fases, com marcos, datas e responsáveis corretos.
- [ ] Selo do topo mostra a fase atual das 4.
- [ ] Anexar a nota com e-mail ao sucateiro OK gera o PDF do relatório com o preview da nota, envia aos destinatários da coligada e encerra o processo.
- [ ] Lista de destinatários vazia ou falha de e-mail do relatório: PDF guardado e processo encerrado mesmo assim.
- [ ] Falha no e-mail ao sucateiro: processo fica aberto com botão de reenvio.
- [ ] Nota em PDF aparece como imagem no quadro 012; rodapé "Página X de 2".
- [ ] Tela de relatório exige 5 fotos e permite nova versão em processo concluído.
