# Contratante vinculado ao Cadastro de Obras

## Objetivo
No card "Nota fiscal / Veículo", o campo **Contratante** passa a representar a **obra contratante** da nota. O sistema tenta identificar automaticamente pela nota escaneada; quando não conseguir, o usuário escolhe a obra em uma combo alimentada pelo Cadastro de Obras (menu Configurações).

## Comportamento

1. Campo Contratante deixa de ser texto livre e passa a ser um **seletor com busca** (combobox) com as obras ativas do cadastro, mostrando Nome/Razão social + CNPJ.
2. Identificação automática após o OCR, nesta ordem:
   - CNPJ do destinatário/tomador da nota igual ao CNPJ de uma obra → seleciona essa obra;
   - Razão social do contratante/destinatário/tomador correspondente ao nome de uma obra (comparação normalizada, sem acento/pontuação/sufixos como LTDA, S/A) → seleciona essa obra;
   - Sem correspondência → campo fica vazio, destacado em vermelho, com aviso "Não foi possível identificar a obra contratante — selecione na lista".
3. Quando identificado automaticamente, aparece um selo "identificado pela nota"; o usuário pode trocar manualmente a qualquer momento (a troca substitui o selo por "selecionado manualmente").
4. Salvar entrada continua exigindo Contratante preenchido — agora só aceita uma obra da lista.
5. O valor gravado permanece a razão social da obra (mesma coluna de hoje), então grid de histórico, filtros, dashboards, fechamento mensal e relatórios continuam funcionando sem migração de dados.
6. Modal de edição de registro (admin/superadmin) usa a mesma combo, mantendo a exigência de justificativa.

## Detalhes técnicos

- `src/lib/ocr-nota.functions.ts`: adicionar `destinatario_cnpj` e `tomador_cnpj` ao schema/tipo de extração (hoje só existe `emissor_cnpj`), para permitir casamento por CNPJ.
- `src/lib/contratante.ts`: nova função `identificarObraContratante(campos, obras)` reutilizando a normalização existente (`chaveContratante`) para o match por nome e comparação de CNPJ apenas por dígitos.
- `src/components/seletor-obra-contratante.tsx` (novo): combobox (Popover + Command do shadcn) com busca por nome/CNPJ, usado na tela de pesagem e no modal de edição.
- `src/routes/pesagem.tsx`: usa `obrasQueryOptions` (já carregado na tela) para alimentar a combo, aplica a identificação automática no retorno do OCR, guarda a origem (`auto` | `manual`) para o selo, e mantém `contratante` como texto ao persistir.
- Sem alteração de banco de dados.

## Fora de escopo
- Não há gravação de um novo campo de vínculo (id da obra) no registro de pesagem.
- Não altera a obra operacional selecionada no topo da tela.
