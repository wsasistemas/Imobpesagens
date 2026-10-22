# Correção do PDF da Nota Fiscal Avulsa — idêntico à prévia

## Objetivo
Garantir que a Nota Fiscal Avulsa baixada, anexada ao e-mail e inserida no relatório fotográfico mantenha **exatamente o mesmo layout A4 exibido na prévia**, incluindo símbolo da Receita Estadual do RJ, quadros, posições, cores, textos e estampa do certificado digital.

## Diagnóstico confirmado
A prévia usa a folha A4 completa, mas o PDF é criado capturando essa folha dentro da janela de visualização. Essa captura pode herdar escala, área de rolagem e condições da tela. O resultado anexado mostra a estrutura comprimida na margem esquerda, com perda das colunas e grande área vazia.

Hoje o certificado já integra os dados da própria folha, no quadro **Informações complementares**. A correção preservará esse conteúdo na mesma posição no PDF.

## Fluxo visual corrigido

```text
Dados preenchidos + certificado digital
                 │
                 ▼
       Folha A4 oficial única
       210 × 297 mm, escala 100%
                 │
       ┌─────────┼─────────┐
       ▼         ▼         ▼
     Prévia   PDF emitido  PDF baixado
       │         │         │
       └─────────┴─────────┘
            MESMO LAYOUT
                 │
       ┌─────────┴─────────┐
       ▼                   ▼
 Anexo do e-mail     Relatório fotográfico
```

## Alterações

### 1. Criar uma geração A4 isolada e estável
- Retirar a dependência da área visível, rolagem e largura da janela de prévia.
- Renderizar uma cópia técnica da mesma folha em uma área isolada, sempre com **210 × 297 mm**, fundo branco e escala fixa.
- Aguardar o símbolo da Receita Estadual, demais imagens e fontes terminarem de carregar antes da captura.
- Gerar o PDF sem margens adicionais, cortes, achatamento lateral ou mudança de proporção.
- Usar imagem interna em alta qualidade para preservar linhas finas, textos pequenos e o símbolo.

### 2. Manter uma única fonte visual
- A prévia e a geração do PDF continuarão usando o mesmo componente da folha oficial.
- Não haverá um segundo desenho simplificado para download.
- O certificado será lido do mesmo campo usado na prévia e permanecerá estampado em **Informações complementares**.
- Fixar no documento os estilos essenciais de impressão para que tema, tamanho da tela ou janela não alterem o resultado.

### 3. Usar exatamente o mesmo PDF em todos os destinos
Ao confirmar **Emitir definitivamente**, o sistema gerará o PDF uma única vez e reutilizará os mesmos bytes para:
- guardar a Nota Fiscal Avulsa como documento 012;
- anexar ao e-mail dos coordenadores e do administrativo da obra;
- permitir o download;
- inserir a primeira página no relatório fotográfico.

Assim, não haverá diferença entre a nota baixada, enviada e arquivada.

### 4. Download após a emissão
- O botão de download da nota emitida utilizará o PDF definitivo já guardado no processo, sem recriar o documento.
- Antes da emissão, o botão **Baixar PDF** da prévia usará o mesmo gerador A4 da emissão definitiva.

## Arquivos previstos
- `src/components/sucata/nfa-preview-dialog.tsx` — substituir a captura dependente da janela pelo gerador A4 estável.
- `src/components/sucata/nfa-folha.tsx` — consolidar os estilos fixos de impressão e garantir a estampa integral do certificado.
- `src/lib/sucata/nfa-pdf.ts` — novo utilitário único para renderizar e gerar o PDF A4.
- `src/lib/sucata/relatorio-pdf.ts` — assegurar que o relatório use a página do PDF definitivo sem deformação.
- Componente que oferece o download da nota emitida, se necessário após confirmar o ponto atual durante a implementação.

## Banco de dados e segurança
- Sem migração de banco.
- Sem alteração de permissões, papéis ou fluxo de emissão.
- O arquivo e a senha do certificado continuam somente na memória do navegador; não serão armazenados.
- Apenas a estampa já aprovada no formulário integra o PDF definitivo.

## Validação obrigatória
- Comparar lado a lado a prévia e a primeira página do PDF baixado.
- Verificar: símbolo, cabeçalho, número, CFOP/natureza, emitente, destinatário, produtos, impostos, transporte, certificado, rodapé e proporção A4.
- Confirmar que não existe área vazia causada por compressão lateral.
- Confirmar que o PDF guardado como documento 012 é igual ao baixado.
- Confirmar que o e-mail usa esse mesmo arquivo.
- Gerar o relatório fotográfico e validar que a nota aparece com a mesma visualização.
- Testar em tela ampla e celular, sem a dimensão da tela alterar o PDF.
- Renderizar o PDF final como imagem para inspeção visual antes de considerar a correção concluída.

## Checklist de aceite
- [ ] PDF baixado idêntico à prévia, em A4 retrato.
- [ ] Símbolo da Receita Estadual do RJ na mesma posição e proporção.
- [ ] Certificado visível integralmente em Informações complementares.
- [ ] Nenhum campo empilhado ou comprimido na margem esquerda.
- [ ] Mesmo PDF usado no download, armazenamento e e-mail da obra.
- [ ] Relatório fotográfico exibe a mesma página, sem deformação.
- [ ] Nenhuma mudança no fluxo irreversível de emissão.

## Premissa
“Idêntico à prévia” significa que a prévia atual da folha oficial é a referência visual; a tela anexada representa o PDF incorreto que será substituído.
