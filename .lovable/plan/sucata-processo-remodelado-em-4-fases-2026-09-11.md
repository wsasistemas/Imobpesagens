# Sucata — processo remodelado em 4 fases

## Resumo

O processo de sucata passa a ter 4 fases visíveis, sem o link externo de aceite do sucateiro e sem a etapa separada de conferência. A Fase 1 é só coleta de dados na entrada; o pedido da nota fiscal avulsa acontece exclusivamente na Fase 4. A tela do processo vira um passo a passo (uma fase por vez), e o **Relatório técnico** com a timeline fica acessível a qualquer momento para administradores e para o novo perfil **Contador**.

```text
FASE 1 · Entrada             FASE 2 · Saída           FASE 3 · Recibo            FASE 4 · Nota avulsa
Operador de balança          Operador de balança      Coordenador / Admin        Contabilidade
---------------------------  -----------------------  -------------------------  --------------------------
1 Sucateiro + placa          1 Digita a placa         1 Foto do recibo           1 Botão "Solicitar nota
2 Dados complementares       2 Pesa o bruto             + valor da coleta (R$)     fiscal avulsa"
  (caminhão e motorista)     3 Foto da caçamba        2 Foto do comprovante        -> e-mail à Contabilidade
3 Foto do caminhão vazio       cheia + descrição        bancário                     com fotos e dados
4 Pesa a tara                                                                    2 Contador emite e anexa
[Entrada liberada]           [Aferido calculado]      [Pronto p/ solicitar]        -> nota vai ao sucateiro
                                                                                 -> processo concluído
```

Status sempre na tríade com texto: âmbar = em andamento, verde = concluída, vinho = bloqueada.

## Telas

### Balança — modo Sucata (aba Entrada) — Fase 1
- Ordem da tela, igual à referência: **Sucateiro (cadastro ativo)** → **Placa do caminhão que está chegando** → **Dados complementares do sucateiro/caminhão** (tipo/modelo, capacidade, motorista habitual, motorista da viagem, documento, tipo de sucata previsto) → **Foto do caminhão vazio com a placa visível** → **Peso da tara**.
- A foto fica no próprio card da entrada, botão grande **Tirar foto do caminhão vazio**, com selo verde quando registrada. Não há mais "capturar evidências" em tela separada nesta fase.
- **Salvar entrada (tara)** exige: sucateiro, placa, motorista, foto do caminhão vazio e peso (balança ou peso manual do administrador). Ao salvar: faixa verde **"Processo SUC-0000/2026 aberto — entrada liberada"**.
- Nesta fase não existe nenhum botão de nota fiscal, valor, recibo ou envio de e-mail.

### Balança — modo Sucata (aba Saída) — Fase 2
- Digita a placa, o sistema localiza o processo e mostra sucateiro, tara e o andamento da Fase 1.
- Salvar o bruto fica bloqueado (caixa vinho) enquanto faltar a foto da Fase 1.
- Após salvar o bruto: botão **Foto da caçamba cheia** e campo **Breve descrição da carga** (ex.: "vergalhão e perfis"). Aferido exibido em destaque.


### Tela do processo `/sucata/:id` — passo a passo
- Cabeçalho: número, obra, sucateiro, placa, situação e **fase atual com responsável**.
- Barra de 4 etapas no topo (1 Entrada · 2 Saída · 3 Recibo · 4 Nota avulsa), cada uma com ícone e cor da tríade.
- Só a fase atual aparece expandida com sua ação; fases concluídas ficam recolhidas com data/hora e autor; fases futuras aparecem em cinza e sem botões.
- Fase 3: dois botões de anexo (recibo e comprovante), campo **Valor total da coleta (R$)** com o valor por tonelada calculado ao lado e alerta se sair da faixa do tipo de sucata.
- Fase 4 — único lugar com pedido de nota: botão **Solicitar nota fiscal avulsa à Contabilidade** (coordenador/admin), habilitado só com valor e as fotos da Fase 3. Depois do envio, mostra "Solicitada em … para marco.aurelio@calper.com.br". Para o Contador, o mesmo bloco mostra o formulário de emissão (número da NFA, data, arquivo original, impedimento) igual à tela de referência.
- Rodapé: botão **Relatório técnico**; painel de teste manual só para superadmin, recolhido por padrão.
- Somem da tela principal: botões "Conferência e aprovação", "Enviar aferido ao sucateiro", "Capturar evidências" e a grade de 12 posições.

### Relatório técnico `/sucata/:id/relatorio`
- Sempre acessível (não depende de conclusão): dados da coleta, as 5 fotos em ordem, valores, dados da nota e a **timeline completa** das 4 fases com quem/quando.
- Botões **Imprimir / Gerar PDF** (versão arquivada, como hoje) e histórico de versões.
- Menu Sucata ganha a aba **Relatórios**: lista de processos com filtros por obra, sucateiro e período, abrindo o relatório de cada um.

### E-mails
1. **Solicitação de nota** (só na Fase 4) → marco.aurelio@calper.com.br: todos os dados necessários para emitir a nota (obra, coligada, processo, destinatário, CNPJ/CPF, endereço, natureza da operação, produto, quantidade em kg, valor total, data da coleta, placa), as fotos do processo em anexo e botão **Emitir nota no sistema** apontando para `/sucata/:id`.
2. **Nota emitida** → e-mail do sucateiro com a nota anexada; o mesmo arquivo vira a última foto do relatório e o processo é concluído automaticamente.


### Perfil Contador
- Novo perfil em Configurações › Perfis, com o menu **Sucata** liberado e os demais bloqueados por padrão.
- No módulo, o Contador vê a lista de processos, o passo a passo (somente leitura, exceto a Fase 4) e os relatórios técnicos. Não pesa, não cadastra sucateiro e não solicita nota.

## O que deixa de existir no fluxo (fica no código, sem uso)
- Link externo de aceite/valor/recibo do sucateiro e a tela "Enviar aferido ao sucateiro".
- Etapa separada de conferência/aprovação: o botão **Solicitar nota** registra a aprovação.
- Fotos do depósito (005–008) e comprovante de pesagem do sucateiro (009).

## Detalhes técnicos

**Banco (somente aditivo, com RLS já existente)**
- `ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'contador'`; linha em `perfil_descricoes`; linhas em `perfil_menu_permissoes` (só `sucata` permitido).
- `sucata_processos`: `ADD COLUMN IF NOT EXISTS descricao_carga text`.
- `sucata_parametros`: `contabilidade_emails = marco.aurelio@calper.com.br`.
- Ajuste de regras em funções de gatilho (CREATE OR REPLACE, sem tocar em dados):
  - `sucata_valida_bruto_trg` / `sucata_posicao_faltante_bloco_a`: exigir só a posição 1 (foto do caminhão vazio) para liberar o bruto.
  - `sucata_encerramento_trg`: exigir as 5 posições vigentes (1, 4, 10, 11, 12) em vez de 12.
  - `sucata_nfa_exige_aprovacao_trg`: aprovação exige `valor_total`, não mais `aceite_em`.
- Posições de foto reutilizam os números atuais (1 caminhão vazio com a placa, 4 caçamba cheia, 10 recibo, 11 comprovante, 12 NFA); processos antigos continuam válidos.


**Servidor (server functions autenticadas, gravação com papel de serviço)**
- `registrarValorColeta` (coordenador/admin): grava `valor_total`, `recibo_modo = 'PROPRIO'`, evento `valor_informado`.
- `solicitarNfa` (coordenador/admin): exige fotos 10 e 11 e valor; grava `aprovado_em/por`, `nfa_solicitada_em`, fase F12; envia o e-mail com anexos e botão; evento `nfa_solicitada`.
- `anexarNfa` passa a aceitar o papel `contador` e, ao anexar, envia a nota ao sucateiro, grava foto 12, `concluido_em`, situação CONCLUIDO e evento `processo_encerrado`.
- `has_role`, `useAuth` e `permissoes-menu` ganham o papel `contador`; RLS do módulo (`sucata_pode_ler`) passa a incluí-lo.

**Frontend**
- Novo `src/lib/sucata/fases-v2.ts` (4 fases, posições por fase, responsável) e `stepper-processo.tsx`, `fase-entrada.tsx`, `fase-saida.tsx`, `fase-recibo.tsx`, `fase-nfa.tsx`.
- `painel-sucata.tsx`: Fase 1 completa dentro do card de entrada (dados complementares + foto do caminhão vazio + tara); Fase 2 com foto da caçamba cheia e descrição após o bruto.
- `sucata.$id.index.tsx` reescrita como passo a passo; `relatorio-fotografico.tsx` reduzido a 5 fotos + timeline de 4 fases; nova aba Relatórios em `/sucata`.
- `timeline-processo.tsx` e `posicoes-evidencia.ts` passam a ler o catálogo novo.

- Colunas explícitas em toda consulta; toda ação gera `sucata_eventos`.

## Entrega
Fase única com checklist de aceite ao final: (a) arquivos, (b) SQL aplicado, (c) checklist OK/PENDENTE por item, (d) decisões assumidas.
