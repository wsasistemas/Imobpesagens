# Plano Visual — Nova Página Inicial (modelo da imagem anexada)

## Objetivo
Reprojetar a Página Inicial seguindo o layout da imagem de referência: cards brancos com cantos bem arredondados, borda sutil colorida por módulo, ícone em bloco suave colorido, título em negrito, descrição curta e uma linha/divisor sutil no rodapé do card. Distribuição em 2 linhas, centralizada, com larguras generosas.

## Layout proposto

### Cabeçalho (centralizado, como na imagem)
- Ícone pequeno em bloco vermelho-claro + título "Bem-vindo, [Nome]" em negrito, tudo centralizado.
- Subtítulo: "Selecione um módulo abaixo para começar a operar no Portal de Pesagem Calper."

### Primeira linha — 4 cards lado a lado (desktop)
1. **Pesagem** — ícone `Scale` (balança), tom verde-esmeralda → leva a `/pesagem`
2. **Ocorrências** — ícone `AlertTriangle`, tom âmbar → `/relatorios/ocorrencias`
3. **Dashboard** — ícone `LayoutDashboard`, tom azul → `/dashboard`
4. **WhatsApp (NOVO)** — ícone `MessageSquare`, tom verde WhatsApp, descrição "Central de conversas e alertas de tolerância." → `/whatsapp` (respeita a permissão do menu `whatsapp`)

### Segunda linha — demais cards (centralizados)
- **Configurações** — `Settings`, cinza → `/configuracoes`
- **Manual do Sistema** — `BookOpen`, vermelho Calper → `/documentacao`
- **Centro de Treinamento** — `GraduationCap`, roxo → `/treinamento`
- (Cards ocultos automaticamente conforme as permissões do usuário logado — regra atual mantida.)

## Estilo dos cards (conforme imagem)
- Fundo branco, `border-radius` grande (~16px), borda fina na cor suave do módulo (ex.: verde-claro para Pesagem) e sombra bem leve.
- Ícone dentro de um bloco arredondado com fundo pastel da cor do módulo.
- Título em negrito grafite, descrição em cinza, divisor sutil no rodapé.
- Hover: leve elevação + borda na cor Calper, sem exageros.
- Grid: 4 colunas no desktop largo, 2 no tablet, 1 no celular; segunda linha centralizada (cards não esticam até as bordas).

## Arquivos afetados
- `src/routes/index.tsx` — única alteração (estrutura do grid, novo card WhatsApp, cabeçalho centralizado e estilos dos cards).

## Observações
- Nenhuma regra de permissão, rota ou negócio muda — apenas apresentação e o novo card de atalho.
- O card WhatsApp só aparece para quem tem o menu `whatsapp` liberado (mesma regra dos demais).

Aprova este layout para eu implementar?
