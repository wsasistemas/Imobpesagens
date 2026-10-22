# Plano — Ordenação e filtro por coluna no grid "Detalhamento" (Relatório de Ocorrências)

## Objetivo
Replicar no grid **Detalhamento** (`/relatorios/ocorrencias`) o padrão de cabeçalho já aprovado no histórico de pesagens: título em **linha única**, ícone de **ordenação** (⇅/↑/↓) e ícone de **filtro** (funil) em todas as colunas, com as cores do projeto (vermelho Calper `--primary` para estados ativos).

## Antes → Depois (visual)

```text
ANTES:
| Data | Obra | Etapa | Tipo | Placa | Nota | Contratante | Transportadora | Registrado por | Fotos | Relato |
(texto puro, sem interação)

DEPOIS (cada coluna):
| Data        ⇅ ⧩ | Tipo     ⇅ ⧩(2) | ...
                ↑ ↑
        ordenar   filtrar
```

- Hover na coluna revela os ícones (cinza); ao ativar ordenação/filtro ficam **vermelhos** com fundo `bg-primary/10`.
- Filtro de lista mostra **badge** com a quantidade de valores marcados.
- Título sempre em uma linha, com truncamento + tooltip.

## Cobertura por coluna

| Coluna | Ordenação | Filtro |
|---|---|---|
| Data | sim (cronológica) | período (de/até) |
| Obra (visão consolidada) | sim | lista (obras) |
| Etapa | sim | lista (Entrada/Saída) |
| Tipo | sim | lista (tipos de ocorrência) |
| Placa | sim | lista |
| Nota | sim | texto (contém) |
| Contratante | sim | lista |
| Transportadora | sim | lista |
| Registrado por | sim | lista (e-mails) |
| Fotos | sim (numérica) | faixa numérica (de/até) |
| Relato | sim | texto (contém) |

## Implementação técnica

Arquivo: `src/routes/relatorios.ocorrencias.tsx` (único).

1. **Estado novo**: `ordenacao: { coluna, dir }` e `filtrosCol` (listas, textos, faixas) — padrão idêntico ao de `pesagem.tsx`.
2. **Cabeçalho**: substituir os `<th>` estáticos por `<ColunaFiltro>` (componente `src/components/grid-filtro-coluna.tsx` já existente), com `onOrdenar`/`ordenacao` em todas as colunas.
3. **Opções de lista**: derivadas das próprias linhas (com contagem), reaproveitando `tiposDisponiveis`/`contratantesDisponiveis` e criando equivalentes para obra, etapa, placa, transportadora e registrado por.
4. **Filtro + ordenação** no memo `filtradas`: filtros de página (topo) continuam valendo e **somam** com os filtros de coluna; ordenação com comparador que mantém valores vazios sempre no fim.
5. **Acessibilidade**: `title` nos botões, foco visível, transições suaves.

Nada muda no banco de dados nem em outros menus.
