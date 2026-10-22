# Plano — PRD do System Design do Portal de Pesagem (Calper)

## Objetivo
Gerar um documento PRD (Product Requirements Document) completo do system design do projeto, entregue como arquivo markdown baixável, consolidando tudo o que já foi construído até hoje.

## Entregável
Arquivo `PRD-Portal-de-Pesagem-Calper.md` (documento para download/visualização), sem alterar nenhum código do projeto.

## Estrutura do documento

1. **Visão Geral e Propósito** — Portal de Pesagem da Calper Construtora: controle de entrada/saída de caminhões, conferência de notas fiscais via OCR e governança de registros.

2. **Perfis e Permissões (RBAC)**
   - Admin, SuperAdmin, Coordenador (somente leitura), Operador
   - Matriz de permissões por menu
   - Restrição de acesso por domínio @calper.com.br e por Coligada (codcoligada) com RLS

3. **Módulos Funcionais**
   - Autenticação e troca de senha temporária (Meu Perfil)
   - Página Inicial com cards interativos por permissão
   - Pesagem (Web Serial / balança Celmi, fluxo Entrada e Saída/TARA, OCR de NF em imagem e PDF, validação anti-duplicidade, Carta de Traço com fallback CALPER PADRÃO)
   - Dashboard (KPIs, Conferência Pesagem × NF, Fechamento Mensal, Ranking de Diferenças, gráfico de Contratantes horizontal)
   - Relatórios de Ocorrências (com disparo de e-mail via Resend, incluindo engenheiro da obra e destinatário fixo)
   - Configurações (Obras, Usuários, Perfis, Permissões por Menu, Tolerâncias por material/umidade)
   - Treinamento, Manual do Sistema, Conectar Assistente (MCP)

4. **Regras de Negócio**
   - Herança de tolerância: Carta de Traço > Material por Fornecedor > Padrão (NBR 6120)
   - Peso calculado em toneladas, umidade (seco/úmido), justificativa obrigatória em edições com log de auditoria (usuário, data/hora)
   - Exclusão por flag com aprovação Admin

5. **Arquitetura Técnica**
   - Frontend: TanStack Start (interface web)
   - Backend: Lovable Cloud (banco Postgres com RLS, auth, storage) + server functions
   - Integrações: Web Serial API, OCR, e-mail, MCP (assistentes), endpoint público de varredura DistNSU
   - Backups diários automáticos

6. **Design System** — Referência ao DESIGN_SYSTEM.md: Vermelho Calper #B3282D, neutros grafite, Inter/Poppins, radius 14px, cards metálicos, animações (scanner, shimmer, pulse-glow).

7. **Diagramas** — ASCII: fluxo de pesagem (entrada → saída → conferência) e arquitetura em camadas.

8. **Roadmap / Próximos passos sugeridos**

## Verificação
- Revisar o documento gerado quanto a fidelidade com o código real (rotas, componentes, libs em `src/lib/`) antes de entregar.
