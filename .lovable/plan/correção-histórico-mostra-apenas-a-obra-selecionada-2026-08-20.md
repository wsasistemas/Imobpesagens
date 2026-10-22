# Correção: histórico mostra apenas a obra selecionada

## O que foi verificado no banco

Os registros das outras obras existem e estão vinculados corretamente:

| Coligada | Obra | Registros |
| --- | --- | --- |
| 127 | CONDOMINIO ARTE WAVE (CONECTA) | 68 |
| 125 | CONDOMINIO ARTE BOTANICA | 49 |
| 124 | CONDOMINIO ARTE JARDIM | 17 |
| 126 | CONDOMINIO ARTE DESIGN | 12 |
| 01 | INFRAESTRUTURA | 5 |

O grid da tela de Pesagem consulta sempre **uma única obra** — a obra escolhida no seletor do topo. Como o seletor está em ARTE BOTANICA, o cabeçalho mostra "Histórico (49)", que é exatamente o total dessa obra. Não há dado perdido: as demais obras só aparecem trocando a obra no topo.

Também foi encontrada **1 divergência real**: um registro gravado na obra 125 (ARTE BOTANICA) com Contratante "CONDOMINIO ARTE JARDIM" — é por isso que a combo de contratantes da tela mostra duas opções.

## O que será feito

1. **Opção "Todas as obras" no seletor do topo** — ao escolher essa opção, o histórico passa a listar os registros de todas as obras/coligadas liberadas para o usuário (151 no total), sem filtro por obra.
2. **Nova coluna "Obra"** no grid (logo após Data), visível quando "Todas as obras" está ativo, com filtro próprio na mesma linha dos demais filtros de coluna, para o usuário saber a qual obra cada registro pertence.
3. **Registro de nova pesagem continua exigindo uma obra específica**: no modo "Todas as obras" o formulário de entrada/saída fica em modo somente-consulta, com aviso "Selecione uma obra para registrar pesagens". Isso evita gravar registro sem obra.
4. **Contador do cabeçalho** passa a indicar o escopo: "Histórico (151) — todas as obras" ou "Histórico (49) — ARTE BOTANICA".
5. **Correção do registro divergente**: reapontar o registro com Contratante ARTE JARDIM que está na obra 125 para a obra 124, com log de alteração e justificativa "Normalização de contratante — vínculo ao Cadastro de Obras".

## Detalhes técnicos

- `src/lib/pesagem-queries.ts`: `pesagensQueryOptions(null)` já ignora o filtro de obra (a RLS por coligada continua valendo); ajustar apenas o limite/ordem para o modo agregado.
- `src/components/app-shell.tsx`: item `__todas__` no `Select` de obra; o valor vazio deixa de ser tratado como "sem obra" e passa a significar "todas", mantendo a persistência em localStorage.
- `src/routes/pesagem.tsx`: `PesagemInner` aceita `obraId: string | null`; adicionar coluna Obra + filtro, desabilitar ações de gravação quando não houver obra selecionada e ajustar o rótulo do histórico.
- Migração de dados: `UPDATE public.pesagens SET obra_id = <124>` no registro divergente + `INSERT` correspondente em `public.pesagem_logs`.
- Sem mudança de políticas de acesso: a visibilidade continua controlada pelas coligadas do usuário.
