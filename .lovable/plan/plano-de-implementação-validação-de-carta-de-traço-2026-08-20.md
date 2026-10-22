# Plano de Implementação - Validação de Carta de Traço

Este plano estabelece as regras para garantir que todos os registros de concreto possuam uma carta de traço vinculada antes de serem salvos, prevenindo erros de cálculo e garantindo a aplicação correta das tolerâncias.

## Mudanças Propostas

### 1. Lógica de Validação na Pesagem
- **Bloqueio de Salvamento**: Impedir a conclusão do registro ("Salvar entrada") se o fornecedor for identificado como de concreto mas nenhuma carta de traço for selecionada (automaticamente ou manualmente).
- **Fallback Automático**: Se o sistema não identificar o fornecedor ou a carta de traço, vinculará automaticamente à carta **CALPER PADRÃO**.

### 2. Interface de Usuário (UX)
- **Alerta Visual**: Exibir uma mensagem de aviso no card de peso quando um fornecedor de concreto for detectado sem uma carta de traço.
- **Destaque de Campo**: Destacar o seletor de carta de traço quando a escolha for obrigatória.

## Detalhes Técnicos
- Local: `src/routes/pesagem.tsx`
- Função afetada: `salvarMut` (verificação de `camposObrigatoriosPendentes`).
- Lógica: 
  - Detectar se o fornecedor está na lista de `fornecedoresConcreto`.
  - Se estiver e `tracoIdentificado` for nulo, adicionar "Carta de Traço" à lista de erros impeditivos.
  - Se o OCR falhar em capturar o fornecedor, acionar o fallback para o fornecedor "CALPER PADRAO" e seu traço correspondente.

---
Você aprova este plano para prosseguirmos com a implementação?
