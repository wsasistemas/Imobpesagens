# Documento não fiscal de ÁGUA — formulário simplificado

Quando o scanner identificar que o documento **não é uma nota fiscal oficial** (ex.: "Comprovante de Abastecimento de Água através de Caminhões-Pipa" da Iguá — sem chave de NF-e, sem valor, sem quadro de produtos) e o produto for **ÁGUA**, o formulário de entrada passa a exigir apenas os campos essenciais.

## Comportamento para o usuário

Ao detectar esse caso, o card **Nota** mostra um selo **"Documento não fiscal — ÁGUA"** e o formulário fica com **somente estes campos habilitados e obrigatórios**:

1. Contratante (obra)
2. Nº nota (nº do protocolo/documento)
3. Emissor
4. Transportadora
5. Placa (cavalo)
6. UF
7. Motorista
8. Peso da NF (kg)

Ficam **ocultos/desabilitados e não obrigatórios**: Chave da NF-e + botão SEFAZ, Data de emissão, Modelo, Marca, Carreta, Tara, Valor total da NF, Itens da NF e todo o bloco de Carta de Traço / concreto.

Complementos:
- O operador pode **ligar/desligar manualmente** o modo por um botão "Documento não fiscal (água)" no card Nota, caso o OCR erre a classificação.
- Ao desligar, os campos normais voltam com as regras atuais.
- Peso capturado na balança, fotos/evidências, fluxo de saída (tara) e cálculo de líquido continuam iguais.
- A validação de duplicidade continua por **Nº nota + Emissor**.

## Regras

- Detecção automática = documento **sem chave de NF-e de 44 dígitos** (ou classificado como não fiscal) **E** conteúdo indicando água (ex.: "ÁGUA", "CAMINHÃO-PIPA", "ABASTECIMENTO DE ÁGUA").
- Registro é salvo sem itens e sem valor da NF; a aferição usa o Peso da NF informado como referência, com a tolerância padrão de material (água) — nunca carta de traço.
- Documentos de água que venham como NF-e oficial (com chave) seguem o fluxo normal de hoje.

## Detalhes técnicos

`src/lib/ocr-nota.functions.ts`
- Acrescentar ao enum `tipo_nota` o valor `nao_fiscal` e um campo booleano `documento_nao_fiscal`, com instrução no prompt descrevendo comprovantes de abastecimento/entrega sem validade fiscal (sem chave, sem ICMS, sem quadro de produtos), extraindo protocolo → `numero_nota`, empresa emissora → `emissor`, empresa proprietária do veículo → `transportadora`, placa, motorista, data e volume.
- Novo campo opcional `produto_categoria` (ex.: `agua`) preenchido quando o documento tratar de fornecimento de água.

`src/routes/pesagem.tsx`
- Novo estado `docNaoFiscalAgua` (auto pelo OCR + toggle manual), derivado em `onSuccess` do OCR pela combinação: sem `chave_nfe` válida (44 dígitos) e indício de água em `descricao`/`itens`/`produto_categoria`/`tipo_nota === "nao_fiscal"`.
- Renderização condicional no card Nota: esconder chave/SEFAZ, emissão, modelo, marca, carreta, tara, valor total, bloco de itens e bloco de carta de traço.
- Em `camposObrigatoriosPendentes`, quando `docNaoFiscalAgua` estiver ativo, forçar `false` para emissão, modelo, marca, carreta, valor total, itens e carta de traço, mantendo apenas os 8 campos listados.
- No `salvarMut`, gravar `itens_nf: null`, `valor_total_nf: null`, `qtd_total: null`, `traco_id: null`, `chave_nfe: null` nesse modo, e `base_calculo` como peso da NF.
- Limpar o estado no `limparFormulario()` e ao trocar de modo entrada/saída.
