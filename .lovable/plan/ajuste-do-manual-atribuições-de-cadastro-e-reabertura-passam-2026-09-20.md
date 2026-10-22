# Ajuste do manual: atribuições de cadastro e reabertura passam para Coordenador / Engenheiro

## Contexto

No Manual do Processo de Sucata (`/documentacao/sucata`), a seção "Quem faz o quê" atribui a SuperAdmin / TI o texto: "Cadastros (sucateiros, valor por quilo, veículos, contas da obra) e reaberturas com auditoria." O usuário indicou que essas atribuições pertencem aos perfis Coordenador / Engenheiro.

## O que mudar

Arquivo único: `src/routes/documentacao/sucata.tsx` (constante `PERFIS`).

- **Coordenador / Engenheiro** — passa a ter as atribuições atuais de cadastro e reabertura, somadas ao acompanhamento que já tinha:
  "Acompanha o histórico do processo e recebe o relatório fotográfico final por e-mail. Responsável pelos cadastros (sucateiros, valor por quilo, veículos, contas da obra) e pelas reaberturas com auditoria."
- **SuperAdmin / TI** — mantém a linha, mas com nova descrição focada no papel de TI:
  "Acesso total ao sistema, correções técnicas de relatório emitido, auditoria e suporte aos demais perfis."

Nenhuma outra seção, tela ou regra do sistema é alterada — é apenas ajuste de texto no manual.

## Checklist

- [ ] Texto das duas linhas atualizado na tabela "Quem faz o quê"
- [ ] Build OK e página `/documentacao/sucata` exibindo o novo texto
