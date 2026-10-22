# Fase 2 — Evidências fotográficas, travas e timeline

## Banco (migrações aditivas)

1. `sucata_evidencias`
   - `id`, `processo_id` (FK `sucata_processos`, not null), `posicao` int not null com check 1..12,
     `rotulo` text not null, `storage_path` text not null,
     `capturado_em` timestamptz not null default now(), `capturado_por` uuid not null,
     `lat numeric(9,6)`, `lng numeric(9,6)`, `versao` int not null default 1,
     `substituida_por` uuid null referenciando a própria tabela, `motivo_substituicao` text,
     `created_at` / `updated_at`.
   - Índice único parcial `(processo_id, posicao) where substituida_por is null`.
   - GRANT para `authenticated` (select/insert/update) e `service_role`; nada para `anon`.
   - RLS por coligada, reaproveitando `pode_ver_obra_coligada(obra_id)` via o processo pai;
     escrita conforme `sucata_pode_escrever()`. Sem política de DELETE — nada é apagado.

2. `sucata_processos`: `ADD COLUMN IF NOT EXISTS peso_deposito_kg numeric NULL`.
   Nenhuma coluna existente é alterada.

3. Função `sucata_sequencia_bloco_a_completa(_processo_id uuid)` e trigger `BEFORE UPDATE`
   em `sucata_processos`: se `bruto_kg` está sendo preenchido e faltam posições 001–004
   vigentes, a gravação é recusada com mensagem nomeando a posição faltante.

4. Storage: bucket privado `sucata-evidencias`, caminho `{processo_id}/{posicao}-v{versao}.jpg`,
   políticas em `storage.objects` só para papéis autenticados do módulo; leitura via signed URL curta.

## Arquivos de constantes compartilhados

- `src/lib/sucata/posicoes-evidencia.ts` — catálogo das 12 posições (número, rótulo, bloco A/B/C,
  responsável). Fonte única usada por captura, grade e travas.
- `src/lib/sucata/fases.ts` — mapa F00→F15 com nome da fase e responsável, reaproveitando os
  rótulos já criados na Fase 1.

## Telas

**T3 · `/sucata/:id/evidencias` — captura (celular primeiro)**
- Uma coluna, botões grandes, lista das posições do bloco atual com estado
  concluída / próxima / aguardando e barra de progresso do bloco.
- Só a próxima posição pendente é capturável; não é possível pular.
- Rótulo fixo gravado automaticamente; o usuário não digita descrição.
- Grava data, hora, usuário e geolocalização; permissão negada não bloqueia — grava sem
  coordenadas e registra o fato no evento.
- Compressão no client: lado maior 1600 px, JPEG 0,8.
- Fila offline em IndexedDB, indicador "N fotos aguardando envio" e reenvio automático ao
  voltar a conexão.
- Substituição exige motivo, cria versão nova e preenche `substituida_por` na anterior.
- No bloco B: campo "Peso lido na balança do depósito" gravando em `peso_deposito_kg`, com
  comparativo aferido CALPER × depósito e divergência percentual em tela.

**T2 · pesagem de saída (Sucata)**
- Verifica as posições 001–004: incompletas ⇒ botão de fechar pesagem desabilitado, com o nome
  da foto faltante e a legenda do motivo em caixa vinho "Sequência incompleta".

**T4 · `/sucata/:id` — processo**
- Cabeçalho: número, obra, badge de status, fase atual com responsável e tempo parado;
  ações Relatório fotográfico (desabilitado nesta fase) e Histórico.
- Coluna esquerda: card da coleta (placa, sucateiro, tipo, tara, bruto, aferido) e grade das 12
  evidências com miniatura (signed URL), número e rótulo, pendentes hachuradas, contador "N de 12".
- Coluna direita: timeline vertical F01→F15 montada a partir de `sucata_eventos` — cumpridas com
  data/hora/autor, atual em âmbar com tempo em aberto, futuras em cinza.

## Notas técnicas

- Novos arquivos: `src/routes/sucata.$id.tsx`, `src/routes/sucata.$id.evidencias.tsx`,
  `src/components/sucata/captura-evidencias.tsx`, `grade-evidencias.tsx`,
  `timeline-processo.tsx`, `src/lib/sucata/evidencias-queries.ts`,
  `src/lib/sucata/fila-offline.ts`, além dos dois arquivos de constantes.
- Alterações mínimas: `sucata-queries.ts` (consultas de evidências/eventos),
  `painel-sucata.tsx` (trava de fechamento) e `lista-processos.tsx` (link para o processo).
- Colunas sempre explícitas nas consultas, sem `select *`; toda ação registra evento em
  `sucata_eventos`.
- Fora desta fase: e-mails, Edge Functions, portal externo, conferência, NFA e geração do relatório.
