# Sucata — Fase 3 da Contabilidade: menos cliques e formulário da Nota Fiscal Avulsa

## O que muda, em resumo

1. O botão "Emitir nota no sistema" do e-mail leva a Contabilidade direto à tela de
   emissão — mesmo quando ela ainda precisa fazer login.
2. Ao lado dos dados do processo aparece o **formulário da Nota Fiscal Avulsa** no
  mesmo desenho do modelo anexado, já preenchido e com todos os campos editáveis.
3. A **natureza da operação** e o **CFOP** vêm sugeridos automaticamente, o CFOP
  conforme o endereço do sucateiro (mesmo estado da obra ou outro estado).
4. O **número da nota** inicia com `00001` quando a Contabilidade ainda não digitou
  o número real emitido no portal oficial.

## Respondendo à pergunta do CFOP e da natureza da operação

- **CFOP: sim, é possível automatizar.** O código depende da UF do sucateiro
  comparada à UF da obra: operação dentro do estado usa a faixa 5.xxx, para outro
  estado usa 6.xxx. Vamos guardar a tabela oficial de CFOP no sistema e o sistema
  escolhe o código; a Contabilidade pode trocar por outro da lista.
- **Natureza da operação: não existe consulta on-line da SEFAZ para isso.** A SEFAZ
  publica a tabela de CFOP (Ajuste SINIEF) em documento oficial, não em serviço de
  consulta. Então a natureza da operação vem da descrição oficial do CFOP escolhido
  (ex.: "Venda de mercadoria adquirida ou recebida de terceiros"), sempre editável.
  O sistema fica com essa tabela cadastrada e atualizável nas configurações da sucata.

## Tela nova (Fase 3 — Contabilidade)

```text
+------------------------------+  +-------------------------------------------+
| Dados do processo (leitura)  |  | NOTA FISCAL AVULSA  Nº [____]  [SAÍDA]    |
| Obra / Coligada / Processo   |  | Natureza da operação [Venda de sucata...] |
| Destinatário + CNPJ/CPF      |  | CFOP [5.102 v]  (sugerido pelo endereço)  |
| Endereço do sucateiro        |  |-------------------------------------------|
| Peso aferido (kg)            |  | REMETENTE/EMITENTE (obra CALPER)          |
| Valor por quilo              |  | nome, CNPJ, endereço, município, IE, fone |
| Valor total                  |  |-------------------------------------------|
| Placa / Data da coleta       |  | DESTINATÁRIO (sucateiro do cadastro)      |
|                              |  |-------------------------------------------|
| [Copiar dados]               |  | PRODUTO: descrição, NCM, CST, UN, qtd,    |
+------------------------------+  | valor unitário, valor total               |
                                  |-------------------------------------------|
                                  | TOTAIS / ICMS / frete / valor da nota     |
                                  | TRANSPORTE: placa, UF, peso bruto/líquido |
                                  | INFORMAÇÕES COMPLEMENTARES                |
                                  |  [Certificado Digital]  (estampa aqui)    |
                                  |-------------------------------------------|
                                  | [Salvar rascunho] [Exportar PDF]          |
                                  | [Anexar a nota] [Enviar ao sucateiro]     |
                                  +-------------------------------------------+
```

- Todos os campos do formulário são editáveis; o que o sistema já sabe vem preenchido
  (obra, sucateiro, peso aferido, valor unitário, valor total, placa, datas).
- Rascunho é salvo no processo, então a Contabilidade pode voltar depois sem redigitar.
- "Exportar PDF" gera o formulário no layout do modelo anexado; o envio ao sucateiro e
  os avisos ao engenheiro e ao administrativo da obra continuam como hoje, abrindo a
  Fase 4.

## Botão "Certificado Digital"

Fica dentro do quadro **Informações complementares**. Ao clicar, a Contabilidade
escolhe o certificado da própria máquina e o sistema estampa nesse quadro a
identificação do assinante (nome, CNPJ/CPF, emissor do certificado, validade e
data/hora da assinatura), que sai impressa no PDF da nota.

Como o navegador não consegue ler sozinho o repositório de certificados do
Windows, o botão abre a seleção do arquivo do certificado (A1, extensão `.pfx`
ou `.p12`) e pede a senha. A senha e o arquivo são usados só naquele momento,
apenas para ler os dados do titular e assinar o documento — nada disso fica
guardado no sistema. Se a empresa usar certificado em token/cartão (A3), o
arquivo não existe; nesse caso o botão permite anexar a nota já assinada pelo
programa do próprio token, e o quadro registra que a assinatura veio de fora.

## Menos cliques

- Link do e-mail → login (se preciso) → cai na tela de emissão da nota do processo,
  rolada até o formulário e com o cursor no número da nota.
- Perfil Contabilidade passa a ter as ações da tela de emissão (hoje liberadas só para
  administrador e TI).
- Contabilidade que entra sem link vê a lista de sucata já filtrada em "aguardando nota".

## Detalhes técnicos

- `src/components/app-shell.tsx`: redirecionamento para `/auth` passa `next` com o
  caminho atual (hoje envia `undefined`, por isso o destino se perde no login);
  `src/routes/auth.tsx` já valida e consome `next`.
- `src/lib/sucata/coleta.functions.ts` (e o e-mail de teste): botão aponta para
  `${PORTAL_URL}/sucata/${p.id}/nfa?foco=emissao`.
- `src/routes/sucata.$id.nfa.tsx`: `validateSearch` para `foco`; `podeEmitir` inclui
  `isContador`; `scrollIntoView` + foco no número; o campo número da nota inicia com
  `00001` quando vazio. Novo componente `src/components/sucata/formulario-nfa.tsx` com
  o layout do modelo.
- `src/lib/sucata/nfa.functions.ts` / `nfa.server.ts`: `dadosNfa` devolve também os
  dados do emitente (obra) e a sugestão de CFOP/natureza; novas funções
  `salvarFormularioNfa` e `sugerirCfop` (compara UF da obra × UF do sucateiro).
- Migração aditiva:
  - `CREATE TABLE IF NOT EXISTS public.sucata_cfop` (codigo, descricao, escopo
    `INTERNO|INTERESTADUAL`, ativo, ordem) + GRANTs (`SELECT` a `authenticated`,
    `ALL` a `service_role`), RLS com `sucata_pode_ler()` para leitura e
    `sucata_pode_escrever()`/admin para escrita; seed com os CFOP de venda usados
    (5.101/5.102/5.949 e 6.101/6.102/6.949).
  - `ALTER TABLE public.sucata_processos ADD COLUMN IF NOT EXISTS nfa_natureza_operacao text`,
    `nfa_cfop text`, `nfa_formulario jsonb NOT NULL DEFAULT '{}'`.
- PDF do formulário gerado no navegador com o `jspdf`/`html2canvas-pro` já usados no
  relatório fotográfico. Nenhuma tela fora do módulo Sucata é alterada.
- Certificado digital: leitura do `.pfx`/`.p12` no próprio navegador (`node-forge`),
  extraindo apenas titular, emissor e validade para a estampa; arquivo e senha ficam
  em memória e nunca são enviados nem gravados. O que é salvo no processo é só o texto
  da estampa (`nfa_formulario.certificado`), com registro em `sucata_eventos`.
- O modelo em PDF anexado é referência de layout; não vai para dentro do app como arquivo.

## Checklist de aceite

- [ ] Clique no botão do e-mail sem sessão → login → cai na emissão da nota do processo
- [ ] Formulário da NFA abre ao lado dos dados, preenchido e editável
- [ ] CFOP sugerido muda conforme a UF do sucateiro (mesmo estado × outro estado)
- [ ] Natureza da operação vem da descrição do CFOP e aceita correção
- [ ] Número da nota começa em 00001 e aceita correção
- [ ] Botão "Certificado Digital" estampa o assinante em Informações complementares
- [ ] Rascunho do formulário é salvo e recuperado
- [ ] Exportar PDF gera o formulário no layout do modelo, com a estampa
- [ ] Perfil Contabilidade consegue anexar, enviar ao sucateiro e exportar
- [ ] Anexo/envio segue avisando engenheiro e administrativo e abrindo a Fase 4

## Premissas e pendências

- CFOP padrão sugerido: 5.102 (mesmo estado) e 6.102 (outro estado). Se a Contabilidade
  usar outro código para sucata, basta indicar e eu ajusto o padrão.
- Inscrição estadual, CST/NCM e alíquotas de ICMS não estão hoje no cadastro; entram
  como campos do formulário, em branco para a Contabilidade preencher, e ficam salvos
  no rascunho.
- A nota continua sendo emitida no portal oficial; o formulário do sistema é o
  espelho preenchido para conferência, exportação e anexo.
