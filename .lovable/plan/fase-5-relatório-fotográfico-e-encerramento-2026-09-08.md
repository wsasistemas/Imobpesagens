# Fase 5 — Relatório fotográfico e encerramento

## O que será entregue

O sistema passa a montar sozinho o relatório fotográfico no padrão CALPER a partir das 12 fotos do processo, com pré-visualização fiel na tela, impressão em A4 e envio por e-mail aos responsáveis. Enviar encerra o processo, que fica somente leitura. Reabrir é exclusivo do perfil TI, exige motivo e gera uma nova versão do relatório sem apagar a anterior.

## Banco (migração aditiva)

1. `sucata_processos` — colunas novas: `concluido_em`, `concluido_por`, `relatorio_versao` (padrão 0), `reaberto_em`, `reaberto_por`, `reabertura_motivo`.
2. `sucata_relatorios` — `processo_id`, `versao`, `storage_path`, `gerado_em`, `gerado_por`, `enviado_para` (jsonb), `enviado_em`. Índice único por processo + versão. Sem exclusão física.
3. `sucata_destinatarios_relatorio` — `coligada`, `nome`, `email`, `papel`, `ativo`. Cadastro por coligada.
4. RLS por coligada nas duas tabelas novas (mesmas funções `sucata_pode_ler` / `sucata_pode_escrever` + `pode_ver_coligada`), GRANTs para `authenticated` e `service_role`, nada para `anon`.
5. Trava de somente leitura no banco: gatilho em `sucata_processos` que recusa qualquer alteração quando `situacao = 'CONCLUIDO'`, exceto quando a alteração é a própria reabertura feita por TI (`superadmin`). Gatilho equivalente bloqueia novas evidências em processo concluído.
6. Gatilho que exige as 12 evidências vigentes antes de gravar `concluido_em` — a trava não fica só na tela.

Não haverá DROP, RENAME nem ALTER destrutivo. Se a checagem de fase precisar aceitar F15, ela já aceita (F01–F15).

## Telas

**T10 · `/sucata/:id/relatorio`**
- Contador "N de 12 evidências". Faltando alguma, o botão de gerar fica desabilitado e a tela nomeia cada posição faltante (código e rótulo do catálogo).
- Pré-visualização em A4 retrato, três páginas: Bloco A (001–004), Bloco B (005–008), Bloco C (009–012). Cabeçalho com logo à esquerda e as duas linhas emolduradas; tabela de duas colunas com obra/data e descrição/relator; grade de 2 colunas com foto emoldurada e as linhas "Foto NNN" e "Descrição: {rótulo}"; rodapé "Página N de 3 — …".
- Numeração e descrições sempre do catálogo `posicoes-evidencia.ts`. Nada digitado.
- Lista de destinatários da coligada, com marcação individual e campo para acrescentar um destinatário pontual (nome + e-mail) só naquele envio.
- Ações: **Imprimir** (CSS de impressão, A4, sem cabeçalho do navegador) e **Enviar e concluir processo**.
- Processo concluído: banner verde, botões de edição escondidos, apenas visualizar/baixar versões do relatório. Para TI, botão "Reabrir processo" com motivo obrigatório.

**Cadastros** — nova aba "Destinatários do relatório" em `/sucata/cadastros`, por coligada, com inativação (sem excluir).

**T1 · lista** — badge verde "Concluído" para `situacao = 'CONCLUIDO'`, e filtro por essa situação.

## Geração do PDF — caminho escolhido

**Gerado no cliente e enviado ao servidor.** O ambiente de servidor deste projeto roda em Worker, sem navegador headless nem Chromium, então não há como converter HTML em PDF no servidor com fidelidade ao que aparece na tela. Vou renderizar as três páginas da própria pré-visualização com `html2canvas-pro` + `jspdf` (A4 retrato, 3 páginas), enviar o arquivo para a função de servidor, que valida perfil, evidências e situação, grava no bucket privado `sucata-relatorios` com o caminho `{processo}/v{versao}.pdf`, registra em `sucata_relatorios`, envia o e-mail com o PDF anexado, grava em `sucata_notificacoes` e um evento em `sucata_eventos`, e só então marca F15 / CONCLUIDO. O arquivo enviado é exatamente o que o usuário vê.

Observação: o módulo continua usando funções de servidor do TanStack (padrão já aprovado nas Fases 3 e 4) em vez de Edge Functions Deno, com service role e validação no servidor.

## Fechamento do módulo

- Matriz final de permissões conferida ação por ação e entregue em tabela na resposta (perfil TI = `superadmin`).
- `docs/sucata.md` com modelo de dados, mapa das fases F01–F15, funções de servidor, buckets, parâmetros configuráveis e a lista de TODO (agendamento automático de varredura, limite de tentativas por Redis, e-mails da Contabilidade a preencher).

## Detalhes técnicos

- Novo bucket privado `sucata-relatorios` criado pela ferramenta de storage; política de leitura só por usuário com acesso à coligada, gravação apenas pelo servidor.
- Arquivos novos: `src/lib/sucata/relatorio.server.ts`, `src/lib/sucata/relatorio.functions.ts`, `src/lib/sucata/relatorio-queries.ts`, `src/components/sucata/relatorio-fotografico.tsx` (documento imprimível), `src/components/sucata/cadastro-destinatarios-relatorio.tsx`, `src/routes/sucata.$id.relatorio.tsx`, `docs/sucata.md`.
- Arquivos alterados: `sucata-queries.ts` e `tipos.ts` (campos e tipos novos), `sucata.index.tsx` (badge e filtro), `sucata.$id.index.tsx` (link do relatório, estado somente leitura, reabertura), `sucata.cadastros.tsx` (nova aba), `evidencias-queries.ts` (bloqueio de captura em processo concluído e ajuste da fase registrada nos eventos das posições 009–012).
- Dependências novas: `jspdf` e `html2canvas-pro`. Nenhuma biblioteca de UI paralela ao shadcn/ui.
- Imagens do relatório carregadas por URL assinada; conversão para base64 antes de renderizar o PDF para evitar falha de canvas.
- Nada fora do módulo Sucata é alterado.

## Fora desta fase

Nada — esta é a última fase. Itens não implementados ficam listados como TODO no README.
