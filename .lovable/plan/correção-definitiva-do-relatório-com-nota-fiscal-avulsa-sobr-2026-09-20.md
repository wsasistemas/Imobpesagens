# Correção definitiva do relatório com Nota Fiscal Avulsa sobreposta

## Diagnóstico confirmado

O print corresponde ao **relatório fotográfico já emitido**, não à prévia atual da nota.

- O processo **SUC-0007/2026** possui somente o relatório **versão 1**, gerado em **15/09/2026**, antes da correção visual da Nota Fiscal Avulsa.
- Os reenvios realizados em **20/09/2026** anexaram exatamente esse arquivo antigo: `v1.pdf`. O sistema hoje preserva o relatório emitido e, ao reenviar, baixa o PDF salvo em vez de reconstruí-lo; por isso a correção feita na tela não altera o anexo antigo.
- Existe ainda um segundo caminho de geração no encerramento da Fase 4. Ele carrega a evidência 012 antiga e monta o relatório sem criar e fornecer a nova imagem da folha oficial. Assim, um relatório novo gerado por esse caminho pode continuar usando uma origem diferente daquela já corrigida na tela de relatório.

## Resultado visual esperado

A Nota Fiscal Avulsa deve aparecer no quadro reservado do relatório com:

- folha completa, centralizada e proporcional;
- brasão, título, número e todas as bordas preservados;
- rótulos e valores dentro de suas respectivas células;
- nenhuma sobreposição, corte ou esticamento;
- a mesma aparência na conferência, no PDF salvo, na reimpressão e no anexo do e-mail.

## Correção proposta

### 1. Unificar os dois caminhos de geração

Criar uma única preparação visual do relatório para ser usada tanto:

- na tela **Relatório fotográfico**;
- quanto no botão de encerramento da **Fase 4**.

Nos dois casos, a Nota Fiscal Avulsa será desenhada novamente pela folha oficial corrigida e convertida pela mesma rotina. A evidência 012 antiga não será usada como imagem de reserva para compor um PDF novo.

### 2. Bloquear PDF incompleto ou visualmente inválido

Antes de permitir gerar, encerrar ou enviar:

- aguardar fontes, brasão, fotos e imagem da nota terminarem de carregar;
- exigir a imagem nova da nota quando houver NFA emitida;
- validar tamanho e proporção A4 da imagem gerada;
- interromper o processo com mensagem clara se a nota não puder ser desenhada, em vez de salvar ou enviar um PDF defeituoso.

### 3. Corrigir o relatório já emitido do SUC-0007/2026

- Gerar uma **versão 2 corretiva** a partir do layout atual validado.
- Preservar a versão 1 para auditoria, sem sobrescrever nem apagar o arquivo antigo.
- Registrar a correção técnica com versão anterior, nova versão, responsável, data e motivo.
- Fazer reimpressões e reenvios seguintes utilizarem a versão 2.
- Não enviar automaticamente durante a correção: primeiro apresentar a prévia interna da versão 2 para conferência; o envio ocorrerá somente após ação explícita.

### 4. Tornar o reenvio seguro

Ao clicar em **Reenviar relatório emitido**:

1. abrir a prévia interna do PDF exato que será anexado;
2. mostrar claramente o número da versão;
3. exigir confirmação do usuário;
4. anexar os mesmos bytes exibidos na prévia, sem regeneração e sem escolher silenciosamente uma versão antiga.

### 5. Validação visual obrigatória

Validar o fluxo completo no **SUC-0007/2026**:

- conferir cada página do PDF em imagem;
- verificar especificamente a página/quadro da NFA em tamanho ampliado;
- confirmar ausência de sobreposição de rótulos e valores;
- comparar prévia interna e arquivo armazenado;
- reenviar somente para o endereço de teste autorizado e conferir que o anexo recebido é a versão 2;
- confirmar que reimpressão e reenvio usam exatamente o mesmo arquivo.

## Arquivos previstos

- `src/components/sucata/passos-sucata.tsx` — corrigir o caminho automático de encerramento da Fase 4.
- `src/routes/sucata.$id.relatorio.tsx` — prévia obrigatória antes do reenvio e uso explícito da versão conferida.
- `src/lib/sucata/nfa-pdf.ts` — reforçar espera e validação da imagem A4 da nota.
- `src/lib/sucata/relatorio-pdf.ts` — bloquear geração quando recursos ou nota não estiverem prontos.
- `src/components/sucata/relatorio-fotografico.tsx` — manter a nota proporcional e impedir qualquer origem antiga durante nova geração.
- `src/lib/sucata/relatorio.functions.ts` — vincular correção/reenvio à versão exata validada e preservar auditoria.

Não haverá alteração destrutiva nem nova tabela. A versão antiga continuará guardada.

## Checklist de aceite

- [ ] Os dois caminhos de geração usam a mesma folha oficial da NFA
- [ ] Nenhum PDF novo usa a evidência 012 antiga como substituta da nota renderizada
- [ ] Geração e envio são bloqueados se a nota não estiver pronta ou não tiver proporção A4 válida
- [ ] SUC-0007/2026 possui versão 2 corrigida, mantendo a versão 1 no histórico
- [ ] Prévia da versão 2 mostra bordas, rótulos e valores sem sobreposição
- [ ] Reenvio exige prévia e confirmação da versão exata
- [ ] Anexo recebido por e-mail é idêntico à prévia e à reimpressão
- [ ] Registros de correção e reenvio preservam versão, responsável, data e destinatários
- [ ] Verificação de tipos, compilação e teste visual concluídos sem erros
