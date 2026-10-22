# Plano Visual: Gráfico de Contratantes (Versão Final)

O gráfico de contratantes será atualizado para uma visualização de barras horizontais com ordenação crescente.

## Alterações Propostas

### 1. Ordenação
- **Crescente:** As barras serão exibidas do menor peso (topo) para o maior peso (base), facilitando a visualização do ranking de evolução.

### 2. Formato de Barras Horizontais
- **Layout:** `layout="vertical"` no Recharts.
- **Eixo Y (Vertical):** Nomes dos contratantes.
- **Eixo X (Horizontal):** Peso em toneladas (escondido para focar nos valores das barras).

### 3. Exibição dos Valores
- **Rótulos Diretos:** Cada barra terá seu valor (ex: "125,5t") exibido à direita, eliminando a necessidade de interação para ver o dado básico.
- **Destaque:** O maior contratante (última barra) será destacado na cor vermelha institucional (#B0202E), enquanto os demais usarão o grafite neutro.

### 4. Refinamento Estético
- Remoção de linhas de eixo desnecessárias.
- Aumento da legibilidade das fontes (Inter/Graphite).
- Espaçamento otimizado para evitar cortes em nomes longos.

## Detalhes Técnicos
- Arquivo: `src/routes/dashboard.tsx`
- Componente: `DashConteudo`
- Hook: `useMemo` na função `agregar` (garantindo o `.sort((a, b) => a.peso - b.peso)`)

---
Plano atualizado. Posso aplicar as mudanças agora?