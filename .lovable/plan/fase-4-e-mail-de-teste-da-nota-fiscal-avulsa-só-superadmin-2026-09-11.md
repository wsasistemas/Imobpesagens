# Fase 4 — e-mail de teste da Nota Fiscal Avulsa (só superadmin)

Sim, é possível. A ideia é ter, dentro da Fase 4 da tela do processo, um campo de e-mail que só o perfil superadmin vê, para disparar exatamente o mesmo e-mail de solicitação da nota (com todos os dados e as fotos) para um endereço escolhido na hora, sem envolver a Contabilidade.

## Como fica na tela

Dentro do card da Fase 4, abaixo do bloco "Solicitar Nota Fiscal Avulsa", aparece uma caixa discreta com borda pontilhada e o selo "Somente TI / teste":

```text
┌──────────────────────────────────────────────────────────┐
│ Teste de envio  ·  visível apenas para superadmin        │
│                                                          │
│ E-mail para teste                                        │
│ [ wagner@calper.com.br            ]  [ Enviar teste ]    │
│                                                          │
│ Envia uma cópia do mesmo e-mail da Contabilidade, com    │
│ todos os dados e as fotos. Não altera a fase do processo.│
└──────────────────────────────────────────────────────────┘
```

Comportamento:
- Campo vazio por padrão; o botão só habilita com um e-mail válido.
- Ao enviar: aviso de sucesso com o endereço, ou aviso em âmbar com o motivo da falha.
- O assunto sai com o prefixo `[TESTE]` para não ser confundido com um pedido real.
- Aparece tanto antes quanto depois do pedido real ter sido feito, para permitir reenvio de teste a qualquer momento.
- Nenhum outro perfil vê essa caixa.

## Regras de segurança

- O envio de teste **não** grava aprovação, não muda a fase, não marca a nota como solicitada e não notifica a Contabilidade.
- A verificação do perfil superadmin é feita no servidor, não só escondendo o campo na tela.
- O e-mail de teste continua exigindo que o processo já tenha valor, recibo e comprovante — assim o conteúdo do e-mail é o real.
- O envio de teste fica registrado na auditoria do processo, com o endereço usado.

## Detalhes técnicos

- `src/lib/sucata/coleta.functions.ts`: nova server function autenticada `enviarNfaTeste` (processoId + email validado por Zod), com `exigirAcesso` e `exigirPapel([...,"superadmin"])` restrito a superadmin. Reaproveita `PROCESSO_NFA_SELECT`, `anexosDoProcesso`, `assuntoSolicitacaoNfa` (com prefixo `[TESTE]`), `htmlSolicitacaoNfa` e `textoSolicitacaoNfa`; envia via `notificar` com `tipo: "SOLICITACAO_NFA"` e registra evento `nfa_teste_enviado` por `registrarEventoServidor`. Sem `UPDATE` em `sucata_processos`.
- `src/components/sucata/passos-sucata.tsx`: estado local `emailTeste`, mutation `enviarTeste`, bloco condicionado a `isSuperAdmin` do `useAuth()` dentro do card da Fase 4.
- Sem migração de banco e sem alteração no fluxo existente de `solicitarNfa`.

## Checklist de aceite

- [ ] Campo de e-mail de teste visível apenas para superadmin
- [ ] Envio dispara o mesmo e-mail da Contabilidade, com dados e fotos
- [ ] Assunto marcado como `[TESTE]`
- [ ] Fase, aprovação e status do processo permanecem inalterados
- [ ] Perfil não superadmin recebe recusa no servidor
- [ ] Envio de teste registrado na auditoria do processo
