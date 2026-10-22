# Plano visual — Processo de Sucata dentro do Centro de Treinamento

## Objetivo
Mover o conteúdo **Processo de Sucata** do menu **Manual do Sistema** para o **Centro de Treinamento**, com uma explicação mais didática para o usuário final e um botão claro de retorno ao menu principal.

## Como ficará para o usuário

```text
Menu principal
└── Centro de Treinamento
    ├── Como usar o Portal de Pesagem
    └── Processo de Sucata
        ├── Visão geral do fluxo
        ├── Fase 1 — Entrada do caminhão vazio
        ├── Fase 2 — Saída do caminhão carregado
        ├── Fase 3 — Emissão da NFA
        ├── Fase 4 — Recibo, comprovante e encerramento
        ├── Reimprimir / reenviar relatório
        └── Botão: Voltar para o Menu Principal
```

## Alterações visuais propostas

- Retirar **Processo de Sucata** da lateral do **Manual do Sistema** mostrada na imagem.
- Criar a entrada **Processo de Sucata** dentro do **Centro de Treinamento**.
- Transformar o treinamento em uma área mais didática, com cards grandes, ícones e linguagem operacional.
- Criar uma página específica de treinamento de sucata com:
  - resumo do objetivo do processo;
  - bloco “Quem faz o quê” em linguagem simples;
  - passo a passo por fase;
  - avisos de atenção para fotos obrigatórias, placa, peso, nota e encerramento;
  - área final sobre consulta, reimpressão e reenvio do relatório;
  - botão **Voltar para o Menu Principal**.

## Conteúdo didático do Processo de Sucata

### Fase 1 — Entrada
- Selecionar obra e sucateiro.
- Informar ou confirmar a placa do caminhão.
- Registrar foto do caminhão vazio.
- Registrar foto da frente do caminhão com a placa.
- Capturar a tara na balança.
- Salvar a entrada e gerar o número oficial do processo.

### Fase 2 — Saída
- Abrir o processo iniciado.
- Registrar foto da caçamba carregada.
- Capturar o peso bruto.
- Conferir peso aferido, valor por kg, valor total e dados bancários.
- Clicar em **SOLICITAR NOTA FISCAL** somente depois da revisão.

### Fase 3 — NFA
- A Contabilidade revisa os dados da nota.
- A NFA é emitida no modelo oficial.
- O sistema registra a nota e libera a fase final.

### Fase 4 — Encerramento
- Anexar recibo assinado.
- Anexar comprovante de depósito.
- Conferir a nota anexada automaticamente.
- Gerar o relatório fotográfico e encerrar o processo.

## Arquivos que serão alterados

- `src/routes/documentacao/route.tsx` — remover o item **Processo de Sucata** do Manual do Sistema.
- `src/routes/treinamento.tsx` — transformar em estrutura de treinamento com acesso ao processo de sucata.
- `src/routes/treinamento.index.tsx` — manter a tela principal do Centro de Treinamento.
- `src/routes/treinamento.sucata.tsx` — criar a página didática do Processo de Sucata.

## Detalhes técnicos

- Não haverá alteração no banco de dados.
- Não haverá mudança nas permissões de acesso.
- A alteração será apenas visual e de organização do conteúdo.
- A rota `/documentacao/sucata` será removida do menu do Manual do Sistema; o treinamento ficará em `/treinamento/sucata`.
- A navegação usará rotas internas do sistema, sem links externos.

## Checklist de entrega

- [ ] Item **Processo de Sucata** removido do Manual do Sistema.
- [ ] Item **Processo de Sucata** disponível dentro do Centro de Treinamento.
- [ ] Página didática criada com as 4 fases do processo.
- [ ] Botão **Voltar para o Menu Principal** criado.
- [ ] Tela validada no navegador.
