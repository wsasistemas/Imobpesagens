# Plano de Implementação: Página Inicial com Cards Interativos

Este plano descreve a criação de uma nova "Página Inicial" que servirá como o ponto de entrada central do Portal de Pesagem Calper após o login.

## Alterações Propostas

### 1. Novo Menu e Roteamento
- Adicionar o item "Página Inicial" ao topo do menu lateral (Sidebar) com o ícone `Home`.
- Atualizar a rota raiz (`/`) para deixar de redirecionar automaticamente para `/pesagem` e passar a renderizar o novo componente da Página Inicial.
- Manter o redirecionamento automático para a Página Inicial após o login bem-sucedido.

### 2. Layout da Página Inicial
- **Mensagem de Boas-vindas:** Exibir uma saudação personalizada ("Bem-vindo, [Nome do Usuário]") no topo. O nome será formatado com a primeira letra maiúscula e espaços no lugar de pontos (ex: "helio.oliveira" vira "Hélio Oliveira").
- **Grid de Cards:** Implementar um layout responsivo (estilo UI/EX) com cards grandes e amigáveis.
- **Interatividade:** Cada card representará um módulo do sistema e levará o usuário diretamente para a respectiva tela ao ser clicado.

### 3. Cards por Perfil de Usuário
Os cards serão exibidos dinamicamente de acordo com as permissões do usuário logado:
- **Pesagem:** Ícone `Scale` (Balança).
- **Dashboard:** Ícone `LayoutDashboard`.
- **Ocorrências:** Ícone `AlertTriangle`.
- **Configurações:** Ícone `Settings`.
- **Manual do Sistema:** Ícone `BookOpen`.

### 4. Identidade Visual
- Utilizar ícones coloridos e vibrantes seguindo a paleta do projeto (Verde Esmeralda / Vermelho Calper).
- Estilo visual "Premium" com efeitos metálicos e sombras suaves nos cards.
- Responsividade total para diferentes tamanhos de tela (mobile e desktop).

## Detalhes Técnicos
- **Localização:** Modificações em `src/routes/index.tsx` e `src/components/app-sidebar.tsx`.
- **Lógica de Permissões:** Utilização do hook `useAuth` e da matriz de permissões existente.
- **Formatação de Texto:** Função auxiliar para normalizar o nome de exibição do usuário a partir do e-mail ou metadados.

---
Você aprova a implementação desta nova Página Inicial?