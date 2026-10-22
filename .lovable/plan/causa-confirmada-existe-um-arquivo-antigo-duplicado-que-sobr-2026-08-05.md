## Causa confirmada: existe um arquivo antigo duplicado que sobrepõe as correções

Ao inspecionar a tela ao vivo, o registro atual está com:

```text
Emissor (NF)  : SUPERMIX CONCRETO S/A
Fornecedor    : CONCREVIT   (nenhum selo AUTOMÁTICO / CONFIRMADO MANUALMENTE)
```

Como não há selo de confirmação manual, quem escolheu CONCREVIT foi o motor automático — ou seja, minhas correções em `src/lib/concreto.ts` não estão sendo executadas.

O motivo: além de `src/lib/concreto.ts` existe um `src/lib/concreto.js` antigo (versão anterior do motor, que só compara `emissor_keywords`). O empacotador resolve `@/lib/concreto` para o `.js` antes do `.ts`, então o app roda a versão velha. O mesmo padrão de arquivo duplicado existe em `src/lib/unidades.js` e `src/lib/ocr-nota.functions.js`.

Além disso, o cadastro do fornecedor SUPERMIX tem as palavras-chave gravadas como um único texto `"SUPERMIX SUPERMIX CONCRETO"` em vez de duas entradas separadas, o que também atrapalha o casamento por palavra-chave.

## Plano

### 1. Remover os arquivos antigos duplicados
Excluir `src/lib/concreto.js`, `src/lib/unidades.js` e `src/lib/ocr-nota.functions.js`, mantendo apenas as versões TypeScript. Isso faz o sistema passar a executar o motor de identificação já corrigido (nome completo, nome parcial e primeiro nome significativo).

### 2. Regra oficial: primeiro nome do Emissor = nome do Fornecedor
O vínculo automático passa a seguir esta ordem de prioridade, sempre a partir do campo **Emissor** da nota:

```text
1. Primeiro nome do emissor  ==  primeiro nome do fornecedor cadastrado
   ("SUPERMIX CONCRETO S/A"  ->  "SUPERMIX")            <-- regra principal
2. Nome do fornecedor contido no emissor (ou vice-versa)
3. Palavras-chave do emissor cadastradas no fornecedor
```

A comparação ignora acentos, pontuação, espaços extras e sufixos societários (LTDA, S/A, ME, EIRELI). Se nada casar, o seletor fica vazio com o aviso atual — nunca com um fornecedor errado. A regra roda tanto ao ler a nota por OCR quanto a cada alteração manual do campo Emissor.

### 3. Corrigir as palavras-chave do fornecedor SUPERMIX
Separar em `SUPERMIX` e `SUPERMIX CONCRETO`, para o casamento por palavra-chave funcionar como nos outros fornecedores.

### 4. Atualizar a nota já lida na tela (validação real)
Com o motor correto ativo, revalidar o registro em tela (NF 204679, emissor SUPERMIX CONCRETO S/A) e confirmar visualmente que o campo **Fornecedor** passa a exibir **SUPERMIX** com selo automático. Se o traço não for identificado, o passo da carta de traço continua pedindo seleção manual — comportamento esperado.

### 5. Botão "Revincular fornecedor"
Ação discreta no bloco *Traço identificado* que reexecuta a identificação a partir do emissor atual e limpa a confirmação manual — útil quando o operador trocou o fornecedor por engano ou a nota foi relida.

## Detalhes técnicos
- Remoção dos `.js` órfãos evita que o alias `@/lib/*` resolva versões pré-compiladas desatualizadas (raiz do problema recorrente).
- `identificarConcreto` em `src/lib/concreto.ts`: reordenar o casamento de fornecedor para priorizar o primeiro nome significativo e remover sufixos societários antes de comparar; mesma função usada pelo `useEffect` e pelo retorno do OCR em `src/routes/pesagem.tsx` (elimina a lógica duplicada de fallback).
- Nenhuma mudança de schema.
- Validação com Playwright na tela `/pesagem`, comparando emissor × fornecedor selecionado (incluindo casos SUPERMIX, ENGEMIX, CONCREVIT e um emissor sem cadastro), antes de reportar como corrigido.
