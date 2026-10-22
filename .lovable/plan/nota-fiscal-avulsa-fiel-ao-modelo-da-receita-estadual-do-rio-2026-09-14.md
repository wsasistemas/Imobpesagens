# Nota Fiscal Avulsa fiel ao modelo da Receita Estadual do Rio de Janeiro

## Objetivo

Refazer a pré-visualização e o PDF da Nota Fiscal Avulsa para reproduzir visualmente o modelo anexado, incluindo o símbolo da Receita Fazendária do Estado do Rio de Janeiro na posição indicada.

## Referência visual obrigatória

- Usar o primeiro anexo como referência de composição, proporções, linhas, divisões, títulos e posicionamento.
- Usar o segundo anexo como a imagem do símbolo oficial a ser exibida na nota.
- O símbolo ficará no cabeçalho, entre o texto de responsabilidade do emitente e o título “NOTA FISCAL AVULSA”, mantendo a proporção do modelo.
- A imagem será incorporada ao projeto como ativo próprio, sem depender de link externo.

## Nova composição da folha

```text
┌───────────────────────────────────────────────────────────────────────┐
│ Texto de responsabilidade │ Símbolo RJ       │ NOTA FISCAL AVULSA   │
│                           │                   │ Nº 00001              │
│                           │                   │ SAÍDA / ENTRADA / VIA │
│                           │                   │ Natureza       CFOP   │
├───────────────────────────────────────────────────────────────────────┤
│ REMETENTE / EMITENTE                              │ datas laterais     │
├───────────────────────────────────────────────────┤                    │
│ DESTINATÁRIO                                      │                    │
├───────────────────────────────────────────────────────────────────────┤
│ DADOS DOS PRODUTOS                                                     │
├───────────────────────────────────────────────────────────────────────┤
│ CÁLCULO DO IMPOSTO                                                      │
├───────────────────────────────────────────────────────────────────────┤
│ TRANSPORTADOR / VOLUMES TRANSPORTADOS                                  │
├───────────────────────────────────────────────────────────────────────┤
│ INFORMAÇÕES COMPLEMENTARES / CERTIFICADO │ RESERVADO AO FISCO         │
├───────────────────────────────────────────────────────────────────────┤
│ CANHOTO DE RECEBIMENTO                         │ NFA Nº 00001          │
└───────────────────────────────────────────────────────────────────────┘
```

## Alterações visuais

1. **Cabeçalho fiel ao anexo**
   - Reproduzir a caixa do aviso legal no lado esquerdo.
   - Posicionar e dimensionar o símbolo oficial imediatamente à direita do aviso.
   - Manter o título e a numeração da nota no lado direito.
   - Recriar os campos SAÍDA, ENTRADA, 1ª VIA DEST./REMET., Natureza da Operação e CFOP nas posições do modelo.

2. **Estrutura do formulário**
   - Substituir a grade genérica atual pelas divisões e larguras observadas no modelo.
   - Reproduzir a coluna lateral de datas e horários.
   - Preservar todos os dados já preenchidos no sistema, reorganizando-os nas células correspondentes.
   - Manter a numeração iniciando em `00001`.

3. **Identidade tipográfica e linhas**
   - Usar texto preto para conteúdo e azul para títulos/rótulos, conforme o modelo.
   - Ajustar espessuras de borda, alturas de linha, alinhamentos e espaços internos para a folha A4.
   - Manter números alinhados e legíveis no preview e no PDF.

4. **Certificado digital**
   - Preservar a estampa do certificado dentro de “INFORMAÇÕES COMPLEMENTARES”.
   - Garantir que o texto do certificado não ultrapasse a área nem altere a paginação.

## Pré-visualização, PDF e relatório

- A tela de pré-visualização mostrará exatamente a nova folha.
- O PDF anexado ao e-mail será gerado a partir dessa mesma folha, sem uma versão visual diferente.
- O documento 012 salvo no processo usará o mesmo PDF.
- O relatório fotográfico continuará exibindo a primeira página dessa NFA, portanto receberá automaticamente o novo layout com o símbolo.

## Arquivos previstos

- `src/components/sucata/nfa-folha.tsx` — reconstrução completa da folha.
- `src/components/sucata/nfa-preview-dialog.tsx` — apenas ajustes necessários para enquadrar a nova folha sem cortes.
- Novo ativo do símbolo oficial, criado a partir do segundo anexo.

Não haverá alteração de banco de dados, regras das fases, destinatários de e-mail ou permissões.

## Validação visual

- Comparar o preview lado a lado com o anexo em tela grande.
- Verificar o símbolo na posição e proporção indicadas.
- Gerar o PDF e conferir a página A4 inteira, sem cortes, sobreposições ou campos fora das bordas.
- Conferir a NFA dentro do relatório fotográfico.
- Testar com textos longos, CFOP com descrição extensa e certificado digital preenchido.

## Checklist de aceite

- [ ] Layout do preview reproduz a composição do modelo anexado.
- [ ] Símbolo da Receita Fazendária do Rio de Janeiro aparece na posição correta.
- [ ] Número da nota aparece com cinco dígitos, começando em `00001`.
- [ ] Todos os campos permanecem preenchidos com os dados do processo.
- [ ] Certificado digital aparece em Informações Complementares.
- [ ] PDF do e-mail é idêntico ao preview.
- [ ] Documento salvo no processo é idêntico ao preview.
- [ ] Relatório fotográfico mostra a NFA nesse mesmo formato.
- [ ] Página A4 não apresenta cortes, sobreposições ou perda de legibilidade.

## Premissa

O símbolo fornecido no segundo anexo será usado exatamente como enviado. A marcação vermelha do primeiro anexo é apenas uma indicação de posição e não aparecerá na nota final.