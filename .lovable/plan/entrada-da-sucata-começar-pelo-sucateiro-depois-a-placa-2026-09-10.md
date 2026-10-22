# Entrada da Sucata — começar pelo sucateiro, depois a placa

## O que existe hoje (analisado)

Na entrada só existe o campo Placa. Como um sucateiro pode ter vários caminhões, começar pela placa falha sempre que aquela placa não estiver cadastrada — e a tela apenas recusa, sem mostrar quem está chegando. Não há campo para procurar o sucateiro, nem modelo/tipo do caminhão.

## O que será entregue

### 1. A entrada passa a começar pelo sucateiro
- Primeiro campo: "Sucateiro", com pesquisa por nome/razão social, CNPJ ou CPF, listando somente sucateiros **ATIVOS** do cadastro já existente.
- Escolhido o sucateiro, aparecem os dados dele (documento, município/UF, inscrição estadual) como hoje.

### 2. Depois a placa do caminhão que está chegando
- Segundo campo: "Placa", com a lista dos veículos **ATIVOS** daquele sucateiro (placa — tipo/modelo — capacidade) e também digitação livre.
- Placa digitada que não está no cadastro daquele sucateiro: a tela oferece **cadastrar o caminhão na hora** (placa, tipo/modelo, capacidade em kg, motorista habitual), já vinculado ao sucateiro escolhido, e segue a pesagem. Nada é apagado ou renomeado no cadastro.
- Placa que já pertence a **outro** sucateiro é recusada com o aviso de a quem pertence.
- Placa com processo pendente de saída continua bloqueada, informando o número do processo.

### 3. Dados do caminhão visíveis
- Bloco "Veículo" com Placa, Tipo/modelo, Capacidade (kg) e Motorista habitual.
- Tipo/modelo e capacidade podem ser completados na hora quando estiverem vazios; a correção é salva no cadastro do veículo e registrada no histórico.
- Aviso quando a tara lida passa da capacidade cadastrada (só alerta, não bloqueia).

### 4. Motorista
- Motorista e documento pré-preenchidos com o motorista habitual do veículo; motorista passa a ser obrigatório para abrir o processo.

### 5. Registro do processo
- O snapshot da abertura passa a incluir placa, tipo/modelo, capacidade e motorista, além dos dados fiscais já gravados, para relatório e auditoria.

## Detalhes técnicos

- Sem migração: `sucata_veiculos` já tem `placa`, `tipo_veiculo`, `capacidade_kg`, `motorista_habitual`; o snapshot do processo é `jsonb`. Nenhuma tabela ou coluna alterada.
- `src/lib/sucata/sucata-queries.ts`: consulta de sucateiros ativos e veículos ativos por sucateiro (colunas explícitas, paginadas), verificação de placa já vinculada a outro sucateiro, e atualização dos dados do veículo — todas com evento em `sucata_eventos`.
- `src/components/sucata/painel-sucata.tsx`: nova ordem dos campos (sucateiro → placa), busca com Command/Popover do shadcn, cadastro rápido de veículo, bloco Veículo, motorista obrigatório e aviso de capacidade. O fluxo de saída e o recebimento de NF-e não são tocados.
- React Query com `staleTime`, números em fonte monoespaçada com `tabular-nums`, vermelho `#B0202E` apenas na ação primária.
