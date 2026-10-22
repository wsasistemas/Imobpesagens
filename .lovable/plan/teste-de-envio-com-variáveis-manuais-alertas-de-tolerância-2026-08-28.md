# Teste de envio com variáveis manuais (Alertas de Tolerância)

Objetivo: dentro de **WhatsApp → Configurações → Alertas de Tolerância**, permitir que o Admin/SuperAdmin
inspecione o template aprovado pelo **Template ID**, preencha manualmente cada variável e envie a
mensagem de teste para um número de destino.

## Variáveis do alerta

O template de alerta de tolerância passa a suportar 4 variáveis, nesta ordem:

1. `{{placa}}` — placa do veículo
2. `{{data}}` — data da ocorrência (DD/MM/AAAA)
3. `{{empreendimento}}` — nome da obra/empreendimento
4. `{{fornecedor}}` — nome do fornecedor da pesagem

Na **Inspecionar** o sistema compara essas 4 variáveis esperadas com os campos reais do template
na Zenvia/Meta:
- se o template **já contém** `empreendimento` e `fornecedor`, eles vêm preenchidos como campos editáveis;
- se **não contém**, o sistema avisa quais variáveis faltam no template aprovado (o modelo precisa ser
  atualizado no provedor), mas ainda permite adicionar/preencher manualmente no teste;
- o envio só usa as variáveis que o template realmente possui, para não gerar erro do provedor.

O alerta automático (pesagem acima da tolerância) passa a enviar também empreendimento e fornecedor
quando o template os tiver.

## Layout (igual à referência anexada)

Novo bloco "Teste do template", abaixo dos campos atuais:

```text
┌────────────────────────────────────────────────────────────────┐
│  Sender deste template: +55 21 98993-0048        [Sincronizar] │  faixa verde
├────────────────────────────────────────────────────────────────┤
│  Template ID (Zenvia)                                          │
│  [ 921ff41e-f871-43d8-... ]     [Inspecionar]     [Testar]     │
├────────────────────────────────────────────────────────────────┤
│  Variáveis do template              [+ Adicionar variável]     │
│  [ placa          ]  {{placa}}                          🗑      │
│  [ data           ]  {{data}}                           🗑      │
│  [ empreendimento ]  {{empreendimento}}                 🗑      │
│  [ fornecedor     ]  {{fornecedor}}                     🗑      │
├────────────────────────────────────────────────────────────────┤
│  Número de destino  [ 5521999999999 ]        [Enviar teste]    │
└────────────────────────────────────────────────────────────────┘
```

- **Inspecionar / Sincronizar**: consulta o provedor pelo Template ID e traz nome, status,
  sender e a lista real de variáveis do modelo. Campos de valor gerados um por variável, com o
  rótulo `{{nome}}` ao lado (Meta: `{{1}}`, `{{2}}`…). Adicionar/remover variável manual é permitido.
- **Testar / Enviar teste**: envia com exatamente os valores digitados; campo vazio bloqueia o botão
  e é destacado.
- Resultado inline: sucesso com ID da mensagem ou erro do provedor.

## Regras

- Apenas Administrador e SuperAdmin; o token continua exclusivamente no servidor.
- Funciona nos dois provedores: Zenvia (variáveis nomeadas) e Meta oficial (posicionais).
- O teste não grava nada em `whatsapp_alertas`; apenas exibe o retorno.
- Alerta automático: envia empreendimento e fornecedor somente quando o template os possui;
  caso contrário mantém o comportamento atual (placa + data). Nenhuma outra alteração no fluxo.

## Detalhes técnicos

1. `src/lib/whatsapp/alerta-envio.server.ts`
   - `inspecionarTemplateAlerta(cfg)`: Zenvia → acha o template por ID em `listarTemplates` e
     devolve `{ nome, status, senderId, variaveis: fields[] }`; Meta → `resolverTemplatePorId`
     derivando as variáveis do corpo (`{{n}}`). Retorna também `faltantes` (esperadas ausentes).
   - `enviarAlertaTemplateCampos(...)`: aceita `Record<string,string>` pronto (Zenvia) ou array
     ordenado (Meta), sem re-mapear pela ordem fixa placa/data.
   - Fluxo automático: monta os campos conforme as variáveis reais do template
     (placa, data, empreendimento = obra.nome, fornecedor = pesagem.fornecedor).
2. `src/lib/whatsapp/alerta-tolerancia.functions.ts`
   - novo server fn `inspecionarTemplateAlerta` (POST, `requireSupabaseAuth` + `assertAdmin`).
   - `testarAlertaTolerancia` passa a aceitar `variaveis?: Record<string,string>` opcional;
     quando ausente, mantém o comportamento atual.
3. `src/components/whatsapp/alertas-tolerancia-config.tsx`
   - novo bloco com faixa do sender, Template ID + Inspecionar, lista dinâmica de variáveis
     (estado local, adicionar/remover), campo de destino, botão de envio e resultado inline,
     com estilo Calper.
