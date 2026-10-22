# Sucata — nova ordem das fases e valor por quilo

A venda passa a ter esta sequência:

```text
Fase 1  Entrada do caminhão        Operador de balança
Fase 2  Saída do caminhão          Operador de balança
        -> peso aferido, valor calculado e pedido da nota enviado à Contabilidade
Fase 3  Nota Fiscal Avulsa         Contabilidade
        -> nota emitida, enviada ao sucateiro, avisos ao engenheiro e ao administrativo
Fase 4  Recibo do sucateiro        Administrativo da obra (última fase)
        -> recibo + comprovante de pagamento e encerramento com relatório
```

## Cadastro do sucateiro

- Campo novo **Valor por quilo da sucata (R$/kg)**, em destaque no formulário (bloco próprio, ao lado dos dados comerciais), com máscara em reais e até 4 casas.
- Obrigatório para sucateiro ativo. Ao alterar, o novo valor vale só para coletas futuras — processos já calculados guardam o valor usado.

## Fase 2 — saída, valor automático e pedido da nota

- Ao registrar o peso bruto, o sistema apura o peso aferido e calcula sozinho:
  - valor unitário = valor por quilo do sucateiro (copiado para o processo)
  - valor total = peso aferido (kg) x valor por quilo
- O card de saída mostra tara, bruto, aferido, valor unitário e valor total, com o valor total em destaque.
- Em seguida o pedido da Nota Fiscal Avulsa é enviado **automaticamente** por e-mail à Contabilidade, com todos os dados e fotos. Se o envio falhar, aparece o botão "Reenviar pedido à Contabilidade" e o processo não trava.
- Admin, SuperAdmin e Administrador podem ajustar o valor total ou o valor unitário informando justificativa; a alteração fica registrada na auditoria com autor, data e hora, e recalcula o outro campo.
- O sucateiro deixa de informar valor: nada de link externo de valor nesta fase.

## Fase 3 — Nota Fiscal Avulsa (Contabilidade)

- Ao entrar no sistema, a Contabilidade vê o processo na Fase 3 com a tela já preenchida: dados cadastrais do sucateiro (razão social/nome, documento, endereço, contato, dados bancários), obra, placa, data da coleta, descrição da sucata, peso aferido, valor unitário e valor total. Tudo somente leitura, com botão de copiar os dados.
- A Contabilidade lança número e data da nota e anexa o arquivo (posição 012).
- Duas saídas: **Enviar nota por e-mail ao sucateiro** e **Exportar PDF**.
- Ao enviar (ou registrar a exportação), o sistema avisa o **engenheiro responsável da obra** e o **administrativo da obra** por e-mail e por WhatsApp de que a nota foi emitida, e libera a Fase 4.

## Fase 4 — Recibo do sucateiro (última)

- Administrativo da obra, coordenador e admin lançam a foto do recibo (010) e do comprovante de pagamento (011), com a conferência de valor e a checagem de comprovante repetido que já existem.
- Concluída a fase, o sistema monta o relatório fotográfico (fotos 001, 004, 012, 010, 011 e a prévia da nota), envia aos destinatários e encerra o processo.

## Registro de cada fase

- Todas as quatro fases passam a exibir, no cabeçalho do card e no histórico: quem abriu, data/hora de abertura, quem concluiu e data/hora de conclusão.
- O histórico do processo segue a nova ordem das fases, com os marcos renomeados.

## Detalhes técnicos

- Migração aditiva: `sucata_sucateiros.valor_por_kg numeric(12,4)`; `sucata_processos` recebe `valor_unitario_kg`, `valor_ajustado_por`, `valor_ajustado_em`, `valor_ajuste_justificativa`, `nfa_exportada_em`, e `fase_1..4_aberta_em/aberta_por/fechada_em/fechada_por` (todas nulas, `IF NOT EXISTS`). A coluna gerada `valor_por_tonelada` continua como está (derivada de bruto − tara). Trigger de valor: gravação de `valor_total` fora do cálculo exige justificativa e papel admin/superadmin.
- `fecharProcessoSucata` (`sucata-queries.ts`) passa a gravar `valor_unitario_kg` e `valor_total` a partir do sucateiro e a chamar `solicitarNfa` na sequência (mesma transação lógica, com falha de e-mail tolerada).
- `coleta.functions.ts`: `registrarValorColeta` vira `ajustarValorColeta` (justificativa + papel), e `solicitarNfa` deixa de exigir valor digitado.
- `nfa.functions.ts`: `anexarNfa` mantém o anexo; `enviarNfaSucateiro` passa a disparar os avisos ao engenheiro (`obras.engenheiro_email` / WhatsApp do perfil) e ao administrativo, reutilizando `whatsapp/alerta-envio.server.ts`; nova ação `exportarNfaPdf` registra `nfa_exportada_em`.
- `fases-v2.ts` e `posicoes-evidencia.ts`: nota fiscal (012) vira fase 3; recibo (010) e comprovante (011) viram fase 4; marcos e ordem atualizados. `relatorio.functions.ts` continua exigindo as 5 fotos, agora na nova ordem.
- `passos-sucata.tsx`, `timeline-processo.tsx`, `lista-processos.tsx`, `form-sucateiro.tsx` e `docs/sucata.md` acompanham a nova ordem e os selos de autor/data por fase.
- Nada é removido: as colunas e fases antigas permanecem no banco para processos já existentes.

## Checklist de aceite

- [ ] Campo de valor por quilo em destaque no cadastro do sucateiro
- [ ] Saída calcula peso aferido, valor unitário e valor total sozinho
- [ ] Pedido da nota sai automaticamente na saída, com reenvio em caso de falha
- [ ] Ajuste de valor só por admin/superadmin/administrador, com justificativa auditada
- [ ] Fase 3 abre para a Contabilidade já preenchida, com envio por e-mail e exportação em PDF
- [ ] Nota emitida avisa engenheiro e administrativo por e-mail e WhatsApp
- [ ] Fase 4 recebe recibo e comprovante e encerra com relatório
- [ ] Cada fase mostra usuário e data/hora de abertura e de conclusão
