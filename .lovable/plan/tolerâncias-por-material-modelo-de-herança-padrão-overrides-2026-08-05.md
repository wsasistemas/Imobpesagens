# Tolerâncias por material — modelo de herança (Padrão + overrides por fornecedor)

Substituir a coluna "Fornecedor específico" da tabela de tolerâncias por um modelo de herança: uma tabela padrão única (Geral) e, por fornecedor, apenas as tolerâncias que diferem.

## Como vai funcionar

1. **Tela inicial: grid de cards**
   - Cabeçalho "Tolerâncias por material" + botão verde **Vincular fornecedor** (standalone, canto superior direito).
   - Card destacado **Padrão (Geral)**: "Base aplicada a todo fornecedor sem tabela própria" + contagem de materiais.
   - Um card por fornecedor vinculado: nome, CNPJ, badge "{n} específica(s)" (ou "herda tudo") e "{n} herdando". Hover eleva o card.
   - Clique em qualquer card abre a tabela correspondente.

2. **Modal Vincular fornecedor**
   - Seção "Já vistos nas pesagens": chips com os emissores/fornecedores que já apareceram nas pesagens e ainda não estão cadastrados; um clique cadastra e abre a tabela dele.
   - Seção "Cadastrar novo": campo de nome (+ CNPJ opcional) e botão Vincular.

3. **Tela de detalhe**
   - Link "← Voltar aos fornecedores" e combo compacto **Trocar** (com busca) para alternar entre Padrão e fornecedores sem voltar ao grid.
   - **Padrão:** tabela editável Categoria | Condição | Palavras-chave | Tolerância ±% | Ações, com botão Adicionar (igual à edição inline atual).
   - **Fornecedor:** uma linha por material da padrão — Categoria | Condição | Padrão (somente leitura) | Específica (input; vazio = herda) | Aplicada | Status (Herda / Sobrescrito). Preencher "Específica" cria/atualiza o override; o "×" remove e volta a herdar.
   - Botão **Desvincular** remove o fornecedor e seus overrides, sem afetar a padrão.
   - Autosave (blur/debounce), padrão visual atual (verde primário, lixeira vermelha, cards arredondados).

4. **Regra de aplicação na conferência de granel**
   `tolerância aplicada = override(fornecedor, material) ?? padrão(material)`.
   A aba Conferência por material passa a usar o fornecedor selecionado para resolver a tolerância; sem fornecedor vinculado, usa a padrão (comportamento de hoje).

## Detalhes técnicos

**Banco (uma migração):**
- `tolerancias_material` (tabela existente, já é a base geral, com 19 linhas e nenhuma linha específica de fornecedor) passa a ser a tabela padrão: remover a coluna `fornecedor`. Nenhuma migração de dados é necessária.
- Nova `public.fornecedores_material` (nome, cnpj, ativo) — GRANT + RLS: leitura para autenticados, escrita para admin (mesmo padrão de `tolerancias_material`).
- Nova `public.tolerancias_fornecedor` (fornecedor_id → fornecedores_material, tolerancia_material_id → tolerancias_material, tolerancia numeric, unique(fornecedor_id, tolerancia_material_id), ON DELETE CASCADE) — mesmos GRANT/RLS.
- Mantida a convenção atual de `condicao` (`seco` / `umido` / `na`) em vez de `Seco`/`Úmido`, para não quebrar a categorização existente.

**Código:**
- `src/lib/tolerancias-material.ts`: remover `fornecedor` de `Categoria`; adicionar hooks/queries para fornecedores de material, overrides e um helper `resolverTolerancia(fornecedor, categoria)` com a regra `override ?? padrão`.
- `src/components/dashboard-tolerancias.tsx`: reescrito em dois modos (grid de cards / detalhe), com o modal de vínculo; fornecedores "já vistos nas pesagens" derivados de `construirMapaFornecedores(pesagens)` menos os já cadastrados.
- `src/components/dashboard-conferencia-material.tsx`: usar `resolverTolerancia` com o fornecedor em foco.
