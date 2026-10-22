# Justificativa obrigatória + Log de alterações do registro de pesagem

## Objetivo

1. Nenhuma alteração de registro de pesagem pode ser salva sem uma justificativa escrita.
2. Toda alteração fica registrada com **nome do usuário, data e hora, campos alterados (antes → depois) e justificativa**.
3. Novo item no menu **Ações** do grid: **Logs do registro**, mostrando a linha do tempo das fases (entrada, saída, ocorrência, conclusão) e das edições.

## O que muda na tela

### Modal "Editar registro"

- Nova seção fixa no final do modal: **Justificativa da alteração \*** (campo de texto, mínimo 10 caracteres).
- O botão **Salvar** fica desabilitado enquanto a justificativa estiver vazia ou curta; a borda/label fica vermelha, no mesmo padrão já usado em "Salvar entrada".
- Aviso curto: "Esta alteração será registrada com seu nome, data e hora."
- Vale para qualquer perfil que tenha acesso à edição.

### Novo diálogo "Logs do registro"

Aberto pelo menu **Ações → Logs do registro** (visível para todos os perfis, somente leitura).

```text
Logs do registro · NF 12345 · Placa ABC1D23
------------------------------------------------
07/08/2026 14:12  Wagner Antunes   EDIÇÃO
  Justificativa: "Carta de traço identificada errada pelo sistema"
  Carta de traço: 12348 → 12401
  Peso esperado: 29.433,6 kg → 28.900,0 kg

07/08/2026 09:40  Maria Silva      SAÍDA REGISTRADA
  Status: aguardando_saida → concluida

07/08/2026 08:02  Maria Silva      ENTRADA SALVA
  Status: rascunho_entrada → aguardando_saida
```

- Ordem do mais recente para o mais antigo, com badge colorido por tipo de evento (entrada, saída, ocorrência, edição).
- Cada bloco de edição lista apenas os campos que realmente mudaram, com rótulos em português e valores formatados (kg, t, datas).
- Estado vazio: "Nenhum log registrado para este registro."

## Detalhes técnicos

**Banco (migração):** nova tabela `public.pesagem_logs`
- `id`, `pesagem_id` (FK), `evento` (texto: `entrada`, `saida`, `ocorrencia`, `edicao`), `justificativa` (texto, nulo para eventos automáticos), `alteracoes` (jsonb: `[{campo, de, para}]`), `usuario_id`, `usuario_nome`, `usuario_email`, `created_at`.
- GRANT `SELECT` para `authenticated` e `ALL` para `service_role`; RLS ativado com política de leitura para admin/operador (mesma regra de `pesagens`); inserção apenas pelo servidor.

**Servidor (`src/lib/admin.functions.ts`):**
- `pesagemEdicaoSchema` ganha `justificativa: z.string().trim().min(10).max(1000)` (obrigatório).
- `atualizarPesagemAdmin` passa a: ler o registro atual, calcular o diff campo a campo, aplicar o update e gravar uma linha em `pesagem_logs` com o diff, a justificativa e a identidade do usuário (via `context.claims` + `profiles.nome`). Se nada mudou de fato, não grava log e retorna aviso.
- Nova função `getLogsPesagem` (autenticada) que retorna os logs de um registro.

**Fases de entrada/saída (`src/routes/pesagem.tsx`):** ao salvar entrada, salvar saída ou registrar ocorrência, grava também o evento correspondente em `pesagem_logs` (sem justificativa), para a linha do tempo ficar completa. Registros anteriores à mudança não terão histórico retroativo — a linha do tempo começa a partir de agora.

**UI (`src/routes/pesagem.tsx`):** campo de justificativa + validação no modal de edição, novo item no `DropdownMenu` de ações e um novo componente de diálogo de logs alimentado por TanStack Query.
