# Fase 1 — Sucata: cadastros, menu e pesagem reversa

Módulo novo, isolado, dentro do Portal. Nada do que já existe é alterado: as telas de pesagem atuais, o recebimento de NF-e, a balança, obras, fornecedores, usuários e coligadas permanecem exatamente como estão. O módulo apenas lê os cadastros existentes.

## Mecanismo de coligada reutilizado (verificado no banco)

O Portal já controla acesso por coligada com:
- `usuario_coligadas` (vínculo usuário × `codcoligada`)
- `pode_ver_coligada(_cod text)` — verdadeiro para admin/superadmin ou vínculo existente
- `user_roles` + `has_role` (admin, superadmin, coordenador, operador)

Todas as novas tabelas usam `pode_ver_coligada(coligada_origem)` nas políticas. Nenhuma política para acesso anônimo.

## O que será entregue

### 1. Menu "Sucata"
- Novo item na navegação, com submenu: **Processos** (lista) e **Cadastros** (sucateiros, veículos, tipos de sucata).
- Nova chave de permissão de menu `sucata`, integrada à tela de Perfis e Permissões por Menu. Padrão: liberado para SuperAdmin, Admin e Operador; Coordenador somente leitura conforme a matriz.

### 2. Cadastro de sucateiro (PJ e PF)
- Formulário único com alternância PJ/PF. Ao trocar o tipo, os campos que não se aplicam ficam **desabilitados e visíveis**, com o texto correspondente — nunca desaparecem.
- PJ exige razão social, CNPJ e inscrição estadual. PF exige nome completo, CPF e RG.
- Validação de dígito verificador de CNPJ e CPF na tela **e** no banco.
- Duplicidade de CNPJ/CPF recusada, com aviso e link para o cadastro já existente.
- Endereço completo, contatos (e-mail de coleta obrigatório, e-mail financeiro, telefone, responsável), dados bancários e chave PIX.
- Situação: Em homologação (padrão), Ativo, Bloqueado. Sem exclusão — apenas mudança de situação.
- Anexos de documentos (cartão CNPJ, contrato social, CPF, RG, comprovante de residência, licença ambiental, outro) com validade, guardados em pasta privada de arquivos. Substituição gera nova versão; nada é apagado.

### 3. Cadastro de veículos
- Vinculados ao sucateiro: placa, tipo, capacidade em kg, motorista habitual, situação Ativo/Bloqueado.
- Placa única entre veículos ativos, garantida pelo banco.

### 4. Tipos de sucata
- Tabela de apoio administrável (ativo/inativo), usada no select da saída.

### 5. Lista de processos
- Grid paginado com número do processo, data, obra/coligada, sucateiro, placa, tara, bruto, peso aferido, tipo de sucata e fase/situação.
- Situação sempre com cor + texto: âmbar = pendente, verde = concluído, vinho = bloqueado.
- Filtros por período, obra, sucateiro, placa e situação. Ordenação por coluna.

### 6. Pesagem reversa — botão "SUCATA" na própria tela de pesagem
- Na tela de pesagem atual entra um botão **SUCATA** ao lado das ações de operação. Ao ativá-lo, a tela entra em **modo sucata** (saída de material) com um selo visível "Modo Sucata — pesagem inversa"; desativando, tudo volta ao comportamento normal de recebimento.
- No modo sucata a ordem se inverte: a primeira pesagem é do caminhão **vazio** (tara) e a segunda do caminhão **carregado** (bruto). O fluxo padrão de recebimento continua intacto quando o botão está desligado.
- **Entrada (caminhão vazio):** leitura da balança grava a **tara**; identificação do sucateiro (só Ativos aparecem), veículo, motorista e documento. O campo "Tipo de sucata" aparece desabilitado com o texto "Informado na pesagem de saída". Ação "Registrar tara e abrir processo" cria o processo em F01, situação Pendente, com cópia dos dados fiscais do sucateiro no momento da abertura.
- Placa sem vínculo com sucateiro Ativo bloqueia a abertura, explicando o motivo.
- **Saída (caminhão carregado):** ao informar a placa, o sistema reconhece que existe processo de sucata pendente para aquela placa e abre a saída de sucata automaticamente — sem precisar clicar no botão nem escolher tipo de operação. A balança preenche o **bruto**; "Tipo de sucata" passa a ser obrigatório. Bloco de cálculo mostra Bruto − Tara = **Peso aferido**, destacado e somente leitura. "Fechar pesagem" grava e avança para F04. Nenhum e-mail nesta fase.
- Peso aferido é sempre calculado no banco; a tela nunca aceita digitação.
- Os campos de nota fiscal, carta de traço, tolerância e conferência do fluxo de recebimento não se aplicam no modo sucata e ficam ocultos, sem qualquer mudança na lógica existente desses blocos.


### 7. Numeração e auditoria
- Número do processo no formato `SUC-NNNN/AAAA`, sequencial por ano, gerado no banco de forma segura contra inserções simultâneas.
- Toda ação (criar/editar cadastro, mudar situação, abrir processo, fechar pesagem, anexar documento) grava linha em `sucata_eventos` com quem, quando, fase, ação e conteúdo.

## Fora desta fase
Sequência de fotos, trava por evidência, timeline visual, portal externo do sucateiro, e-mails, Edge Functions, relatório fotográfico, conferência e NFA. Onde a Fase 1 tocar esses pontos, fica um TODO comentado e eu aviso na entrega.

## Detalhes técnicos

**Migração aditiva** (prefixo `sucata_`, RLS + GRANTs no mesmo arquivo, tudo idempotente com `IF NOT EXISTS`):
- `sucata_sucateiros` — campos conforme especificado; checks de coerência PJ/PF; índices únicos parciais em `cnpj` e `cpf`; validação de dígito verificador por função `sucata_valida_cnpj`/`sucata_valida_cpf` aplicada em trigger; `coligada_origem` não nulo.
- `sucata_sucateiro_documentos` — tipo, caminho do arquivo, validade, versão, motivo da substituição.
- `sucata_veiculos` — índice único em `upper(placa)` onde `situacao = 'ATIVO'`.
- `sucata_tipos` — código, nome, ativo.
- `sucata_processos` — `numero` único, `ano`, obra_id, `coligada_origem`, sucateiro_id, veiculo_id, placa, motorista, documento, snapshot fiscal em `jsonb`, `tara_kg`, `bruto_kg`, `peso_aferido_kg` gerado por `GENERATED ALWAYS AS (bruto_kg - tara_kg) STORED`, tipo_sucata_id, `fase` (F01…F04), `situacao` (PENDENTE/CONCLUIDO/BLOQUEADO), timestamps e autores.
- `sucata_numeracao` + função `sucata_proximo_numero(_ano int)` com `SECURITY DEFINER`, `search_path` fixo e trava por linha para evitar colisão.
- `sucata_eventos` — processo_id (nulo para eventos de cadastro), entidade, entidade_id, fase, acao, payload jsonb, usuário, timestamp; sem UPDATE/DELETE por policy.
- RLS: SELECT/INSERT/UPDATE separados por operação, todos com `pode_ver_coligada(coligada_origem)`; escrita restrita a admin/superadmin/operador; coordenador só leitura. Nenhum DELETE liberado. GRANTs para `authenticated` e `service_role`; nada para `anon`.
- Índices em todas as FKs e em `placa`, `situacao`, `coligada_origem`, `created_at`.

**Arquivos previstos**:
- Novos: `src/lib/sucata/tipos.ts`, `sucata-queries.ts`, `sucata.functions.ts` (server functions com `requireSupabaseAuth`), `validadores.ts` (CPF/CNPJ)
- Novos: `src/routes/sucata.index.tsx` (processos), `src/routes/sucata.cadastros.tsx`
- Novos: `src/components/sucata/` — `form-sucateiro.tsx`, `documentos-sucateiro.tsx`, `form-veiculo.tsx`, `cadastro-tipos-sucata.tsx`, `lista-processos.tsx`, `painel-sucata-entrada.tsx`, `painel-sucata-saida.tsx`, `status-badge.tsx`
- Alterados: `src/routes/pesagem.tsx` — apenas o botão "SUCATA", o estado do modo e a renderização condicional dos painéis novos; nenhuma regra do fluxo de recebimento é tocada. `src/lib/permissoes-menu.ts` (nova chave `sucata`) e `src/components/app-sidebar.tsx` (item de navegação).

**Consultas**: colunas explícitas (sem `select *`), listagens paginadas por range, React Query com `staleTime` definido. Números com fonte monoespaçada e `tabular-nums`; títulos em Space Grotesk, interface em Inter; vermelho `#B0202E` só em ação primária.

**Reuso da balança**: a leitura usa o hook Web Serial já existente (`useCelmiScale`), sem alterá-lo.

## Premissas assumidas
- O botão "SUCATA" fica visível para quem tem permissão no menu Sucata; para os demais, a tela de pesagem continua idêntica ao que é hoje.
- Na saída, o reconhecimento pela placa tem prioridade: se houver processo de sucata pendente para a placa, o sistema abre a saída de sucata mesmo sem o botão acionado.

