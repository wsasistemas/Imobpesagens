# Onde o sistema busca a densidade dos produtos sem carta de traço

## Resposta direta (verificado no código)

Hoje **não existe cadastro**. Para produtos sem carta de traço, a densidade vem de uma
**tabela fixa embutida no sistema** (`src/lib/unidades.ts`, linhas 41-66), usada quando o
item da NF está em M3, L ou SC:

| Regra (palavras na descrição) | Densidade |
|---|---|
| CONCRETO + MAGRO / LASTRO | 2.300 kg/m³ |
| CONCRETO + LEVE | 1.800 kg/m³ |
| CONCRETO | 2.400 kg/m³ |
| ARGAMASSA | 2.100 kg/m³ |
| AREIA | 1.500 kg/m³ |
| BRITA / PEDRA | 1.450 kg/m³ |
| SEIXO / RACHAO | 1.500 kg/m³ |
| CIMENTO | 1.400 kg/m³ |
| AGUA (litro) | 1,00 kg/L |
| ADITIVO (litro) | 1,15 kg/L |
| Saco: CIMENTO 50 kg · ARGAMASSA 20 kg · CAL 20 kg | — |

É exatamente essa regra "AREIA = 1.500 kg/m³ (genérica)" que aparece na memória de cálculo
da NF 14574 (14 M3 × 1.500 = 21.000 kg).

Ordem de precedência atual do peso declarado:
1. densidade técnica da **carta de traço** (quando o registro é concreto identificado);
2. tabela fixa acima, casada pela descrição do produto;
3. sem correspondência: o item não converte e o rateio cai no valor financeiro da NF.

O cadastro de **Tolerâncias por material** existe e é usado só para o percentual de
tolerância — ele não guarda densidade. O cadastro de concreto (fornecedor/traço) guarda
densidade, mas só para concreto.

## O que será feito

### 1. Novo submenu Configurações › Densidades
Tabela editável (a tabela hoje fixa no código passa a viver no banco), visível e editável
**somente para Administrador e Super Admin**; Coordenador e Operador não veem o submenu.

Colunas do cadastro:
- **Material** (nome, ex.: AREIA MEDIA LAVADA)
- **Palavras-chave** para casar com a descrição da NF (ex.: AREIA; AREIA MEDIA)
- **Unidade base**: M3 (kg/m³), L (kg/L) ou SC (kg por saco)
- **Densidade / peso** do saco
- **Ordem** (define qual regra vence quando mais de uma casa)
- **Ativo**

Ações: incluir, editar, ativar/inativar, excluir e busca por material. A carga inicial
já vem com os valores atuais (concreto magro/lastro 2.300, concreto leve 1.800, concreto
2.400, argamassa 2.100, areia 1.500, brita/pedra 1.450, seixo/rachão 1.500, cimento 1.400,
água 1 kg/L, aditivo 1,15 kg/L, sacos cimento 50 kg / argamassa 20 kg / cal 20 kg), para
nada mudar de resultado no dia da implantação.

### 2. Exceções de densidade por fornecedor
Dentro de cada material, um bloco **Exceções por fornecedor**: escolhe o fornecedor
cadastrado e informa a densidade específica dele (ex.: AREIA — D'ANGELOS AREAL = 1.480 kg/m³).
Aparece na lista com um selo indicando quantas exceções o material tem.

### 3. Regra de precedência (única em todo o sistema)

```text
1. Densidade da CARTA DE TRAÇO (concreto identificado)
2. Exceção de densidade do FORNECEDOR para o material
3. Densidade PADRÃO do material (cadastro Densidades)
4. Sem correspondência: item não converte -> rateio pelo valor financeiro da NF
```

### 4. Memória de cálculo mostra a origem
A linha do item deixa de dizer sempre "(genérica)" e passa a indicar a origem real:
"densidade 1.480 kg/m³ (fornecedor D'ANGELOS AREAL)", "densidade 1.500 kg/m³ (cadastro)"
ou "densidade 2.336 kg/m³ (carta de traço)". Serve para auditoria imediata na tela do anexo.

### 5. Análise de aderência (antes de mexer nos números)
Levantamento dos produtos em M3/L/SC já gravados: quais convertem pela tabela atual, quais
caem no rateio financeiro, agrupados por material e fornecedor, com o impacto em kg/% das
diferenças apuradas — para você ajustar as densidades no novo cadastro com base em dados reais.
Registros antigos não são recalculados automaticamente; o recálculo segue pela Manutenção,
quando você decidir.

## Detalhes técnicos

- Fonte atual a ser substituída: `DENSIDADES`, `DENSIDADES_L`, `PESO_SACO` em
  `src/lib/unidades.ts`; casamento por `casar()` (todas as palavras da regra contidas na
  descrição, sem acento, maiúsculas), primeira regra que casa vence — daí a coluna Ordem.
- `calcularPesoItem` (~linha 173) hoje faz `densidadeForcada ?? densidadePorDescricao(...)`;
  passa a receber um resolvedor injetado `resolverDensidade(descricao, fornecedor)` para
  cobrir a precedência acima, mantendo `densidadeForcada` (carta de traço) na frente.
- Migração: `public.densidades_material` (nome, palavras_chave text[], unidade_base,
  densidade numeric, ordem, ativo) e `public.densidades_fornecedor` (densidade_material_id,
  fornecedor_id, densidade), com GRANT para authenticated/service_role, RLS de leitura para
  os perfis do sistema e escrita apenas para admin/superadmin via `has_role`, mais seed com
  os valores atuais.
- Permissão de menu: nova chave `densidades` em `perfil_menu_permissoes` e no mapa de
  `src/lib/permissoes-menu.ts`; rota/submenu em `src/routes/configuracoes.tsx` +
  `src/components/app-sidebar.tsx`, seguindo o padrão de Tolerâncias.
- Novo componente `src/components/cadastro-densidades.tsx` no mesmo padrão visual de
  `dashboard-tolerancias.tsx` (tabela, diálogo de edição, exceções por fornecedor).
- Cache das densidades por React Query, consumido também pela estratificação e memória de
  cálculo (`src/components/estratificacao-dialog.tsx`), para não haver dois caminhos.

