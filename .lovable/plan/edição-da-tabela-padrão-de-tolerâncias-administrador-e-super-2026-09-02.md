# Edição da Tabela Padrão de Tolerâncias (Administrador e Super Admin)

## Situação atual
- A Tabela Padrão (Geral) já possui campos de edição inline (categoria, condição, palavras-chave, tolerância) e botões de adicionar/excluir, porém liberados apenas para o perfil **administrador**.
- No banco, a regra de acesso da tabela padrão exige o papel **admin**; quem tem apenas o perfil **superadmin** consegue ver, mas qualquer alteração é bloqueada (a tela parece editável e a gravação falha).
- Na tela, "super admin" hoje é reconhecido por e-mail fixo, e não pelo perfil cadastrado do usuário.

## O que será feito

1. **Liberar o perfil Super Admin no banco**
   - Atualizar a regra de acesso da tabela padrão de tolerâncias para permitir criar, editar e excluir tanto para **administrador** quanto para **super admin**.
   - Leitura continua liberada para todos os usuários autenticados (coordenador/operador seguem somente leitura).

2. **Ajustar a permissão na tela**
   - Passar a considerar o perfil real do usuário (admin ou superadmin) em vez do e-mail fixo.
   - Com isso, ambos os perfis terão: edição inline de Categoria, Condição, Palavras-chave e Tolerância ±%, botão "Adicionar Material" e exclusão de linha.
   - Demais perfis continuam com os campos bloqueados e o rótulo "somente leitura".

3. **Feedback de gravação**
   - Confirmação visual (toast) de sucesso ao salvar cada alteração e mensagem clara de erro caso a permissão seja negada, evitando alterações "silenciosas" que não persistem.

## Fora do escopo
- Nenhuma mudança nas regras de cálculo, na herança de tolerâncias (carta traço > fornecedor > material padrão) ou nas tabelas por fornecedor.
- Registros já existentes não são recalculados automaticamente; a aba Manutenção continua disponível para isso.

## Detalhes técnicos
- Migração ajustando a policy `Admin pode editar padrão` em `public.tolerancias_padrao` para `has_role(auth.uid(),'admin') OR has_role(auth.uid(),'superadmin')` (USING e WITH CHECK).
- Em `src/components/dashboard-tolerancias.tsx`, substituir `isSuperAdmin = user?.email === ...` pela verificação de papel vinda de `useAuth`, e usar `podeEditar = isAdmin || isSuperAdmin` em todos os controles da Tabela Padrão.
