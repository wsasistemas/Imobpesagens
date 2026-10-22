# Leitura de notas em PDF (OCR)

Sim, é possível. O modelo de IA usado hoje na leitura da nota aceita PDF como anexo nativo — só falta o sistema enviar o arquivo no formato correto. Hoje o botão "Enviar arquivo" já permite escolher um PDF, mas o servidor recusa com a mensagem "PDFs ainda não são processados automaticamente".

## O que muda para o usuário

- Escolher um PDF da DANFE / NFS-e / DACTE em "Enviar arquivo" passa a extrair os dados normalmente (mesmos campos de hoje: chave, número, emissor, placa, itens, peso, dados adicionais, concreto).
- Mensagens claras quando o PDF não puder ser lido: arquivo vazio/corrompido, protegido por senha, ou acima do limite de tamanho — com orientação de enviar foto/print como alternativa.
- A miniatura no card **Peso** mostra um selo de PDF (com o nome do arquivo) em vez da imagem, já que PDF não renderiza como foto.
- O PDF continua sendo anexado como evidência do registro, como já acontece com as fotos.

## Regras

- Limite de tamanho: PDFs de até ~10 MB e até 5 páginas são enviados diretamente; acima disso o sistema avisa e pede um recorte/print.
- PDF apenas digitalizado (imagem) continua funcionando, pois o modelo faz OCR do conteúdo.
- Nenhuma alteração nas regras de duplicidade de nota, tolerâncias, carta de traço ou cálculo — apenas a origem do arquivo lido.

## Detalhes técnicos

`src/lib/ocr-nota.functions.ts`
- Remover o bloqueio de PDF (`isPdf` → retorno de erro).
- Quando o mimeType for `application/pdf`, montar o conteúdo do usuário com um bloco `{ type: "file", file: { filename, file_data: "data:application/pdf;base64,..." } }` em vez de `image_url`; imagens seguem no bloco `image_url` atual.
- Validar que o base64 não está vazio antes de chamar o gateway e ampliar o tratamento de erro: 400 com "no pages"/"cannot be fetched" → mensagem específica; 429/402/5xx mantêm o tratamento atual.
- Aceitar `filename` opcional no `inputValidator` para nomear o anexo.

`src/routes/pesagem.tsx`
- Em `onNotaArquivo`, aceitar PDF: validar tamanho antes de ler, gerar o data URL e enviar `mimeType` + nome do arquivo para a função de OCR.
- Na pré-visualização dentro do card **Peso**, renderizar um bloco com ícone de arquivo + nome quando o tipo for PDF (a `<img>` atual só cobre imagens).
- Ajustar o texto de ajuda e manter o mesmo indicador visual de "processando".
