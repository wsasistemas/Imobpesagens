# Correção definitiva da Carta de Traço na edição do registro

## Causa confirmada

A seção foi implementada atrás da condição `f.fornecedor_concreto_id`, porém esse campo **não existe em `pesagens`**, não é retornado pela consulta do histórico e nunca chega ao `EditForm`. Portanto, a condição permanece falsa e todo o bloco fica oculto.

O vínculo válido já existente é `pesagens.traco_id`. A própria carta (`tracos_concreto`) contém `fornecedor_id`, permitindo localizar o fornecedor correto. Os registros verificados no banco têm esse vínculo e os dados técnicos; por exemplo, a NF 205454 está ligada à carta SUPERMIX `SL1235`, embora alguns campos derivados ainda estejam apenas em `resultado_afericao`.

## Correção

1. **Remover a dependência do campo inexistente**
   - Excluir `fornecedor_concreto_id` do estado de edição.
   - Exibir a seção quando houver `traco_id`, `resultado_afericao` ou campos técnicos persistidos da carta.

2. **Resolver a carta pelo vínculo real**
   - Localizar `traco_id` em todas as cartas carregadas e, a partir do `fornecedor_id` da carta, identificar a usina.
   - Mostrar fornecedor, código, FCK, slump e densidade da carta selecionada.
   - Enquanto o catálogo estiver carregando, mostrar estado de carregamento; se a carta tiver sido removida do cadastro, manter os valores históricos e informar que o cadastro atual não foi encontrado.

3. **Carregar todos os dados técnicos no formulário**
   - Levar ao `EditForm` também `peso_esperado`, `tolerancia_aplicada`, `status_afericao`, `volume_m3`, `diferenca_kg` e `diferenca_pct`, que já são retornados pela consulta.
   - Para cada valor, usar fallback entre `resultado_afericao`, colunas dedicadas e dados da própria carta. Assim, registros antigos com JSON parcial ou nulo continuam visíveis.

4. **Renderizar a apuração de forma resiliente**
   - Manter a seção logo abaixo de Pesos.
   - Exibir Peso esperado, Peso aferido/líquido, diferença em kg e %, tolerância, volume e status.
   - Tratar corretamente valores zero, sem testes por truthiness que hoje transformam `0` em “—”.

5. **Validar no fluxo real**
   - Abrir “Ações → Editar registro” em um registro com carta e confirmar visualmente a seção e seus valores.
   - Conferir também um registro antigo com `resultado_afericao` nulo e um registro sem carta, garantindo que não haja bloco técnico indevido nem erro no modal.

## Detalhes técnicos

- Alteração concentrada em `src/routes/pesagem.tsx`; não exige mudança de schema.
- A consulta do histórico já retorna `traco_id`, `resultado_afericao` e as colunas técnicas necessárias.
- A lista carregada por `getFornecedoresConcreto` já traz cada fornecedor com suas `tracos_concreto`, portanto o fornecedor deve ser derivado da carta, e não de uma coluna inexistente em `pesagens`.