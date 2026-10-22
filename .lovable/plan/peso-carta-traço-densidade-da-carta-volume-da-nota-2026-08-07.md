# Peso Carta Traço = densidade da carta × volume da nota

## Causa confirmada (dados do banco)

O volume usado hoje é a **soma de todos os itens em M3** da nota. Isso funciona na SUPERMIX (um único item em m³ = o concreto), mas erra na CONCREVIT, onde os itens em m³ são matérias-primas.

| Nota | Emissor | Itens em m³ | Volume gravado | Volume real da nota | Peso Carta Traço gravado | Correto (densidade 2.336) |
|---|---|---|---|---|---|---|
| 039938 | CONCREVIT | areia 4,81 + brita 7,79 | 12,6 m³ | 10 m³ (dados adicionais) | 29.433,6 kg | 23.360 kg |
| 039912 | CONCREVIT | areia 3,87 + brita 8,68 | 12,55 m³ | a confirmar | 29.316,8 kg | recalcular |
| 205438 | SUPERMIX | concreto 8 m³ | 8 m³ | 8 m³ | 18.743,36 kg | correto |

Também confirmei que o campo de texto dos dados adicionais (`dados_adicionais_nf`) está **vazio em todos os registros** — o leitor de nota nunca extraiu esse texto, então o volume da CONCREVIT nunca chegou ao sistema.

## O que será feito

### 1. Leitura da nota passa a capturar o volume do concreto
O leitor de nota (OCR) passa a devolver e gravar:
- o texto completo do quadro **Dados Adicionais / Informações Complementares**;
- o **volume de concreto em m³** declarado nesse texto (ex.: "…descarga de **10 m3** de FCK 35 MPa…").

### 2. Regra única de volume (ordem de prioridade)
1. Volume informado manualmente pelo usuário no registro (sempre vence);
2. Volume lido nos Dados Adicionais da nota;
3. Item da nota em m³ que seja **concreto** — itens de matéria-prima (cimento, areia, brita, pedra, pó de pedra, água, aditivo, fibra) são ignorados e nunca somados;
4. Sem nenhuma das opções: volume fica indefinido.

### 3. Cálculo e gravação
`Peso Carta Traço = densidade da carta de traço selecionada × volume (m³)`, gravado em cada salvamento (entrada, saída e fechamento com ocorrência), junto com tolerância, diferença em kg/%, status da aferição, volume utilizado e a **origem do volume** (manual, dados adicionais ou item da nota), para rastreabilidade na memória de cálculo.

### 4. Nota de concreto sem volume
A coluna **Peso Carta Traço** fica em branco e o card de apuração mostra um aviso claro ("Volume não identificado — informe o volume da nota"), com campo para digitar. Não bloqueia o salvamento.

### 5. Volume editável na edição do registro
No modal **Editar registro**, dentro do bloco de Apuração de Concreto, entra o campo **Volume (m³)**. Ao salvar (com justificativa obrigatória, como hoje), o sistema recalcula automaticamente Peso Carta Traço, diferença, % e status, e registra tudo no log do registro.

### 6. Atualização dos registros já gravados
- Registros cujo volume é confiável (um único item de concreto em m³, caso SUPERMIX/ENGEMIX): **recalcular** Peso Carta Traço = densidade × volume.
- Registros cujo volume veio da soma de matérias-primas (CONCREVIT): volume e Peso Carta Traço são **limpos** e o registro é marcado como "volume a confirmar", para o administrador informar o volume na edição — evita manter um número errado no dashboard.
- Notas futuras já entram corretas pela leitura dos dados adicionais.

## Detalhes técnicos

- `src/lib/ocr-nota.functions.ts`: adicionar ao schema/prompt `dados_adicionais` (texto) e `concreto.volume_m3` (regex de apoio: `/(\d+(?:[.,]\d+)?)\s*m(?:3|³)\b/i` sobre o texto adicional).
- `src/lib/concreto.ts`: nova função `derivarVolumeNota({ itens, dadosAdicionais, volumeManual })` retornando `{ volume, origem }` com a lista de palavras-chave de matéria-prima; usada tanto na tela quanto no recálculo.
- `src/routes/pesagem.tsx`: substituir o `reduce` de `volumeItens` (~linha 339) por `derivarVolumeNota`; gravar `dados_adicionais_nf`, `volume_m3` e `volume_derivado_detalhe` nos três payloads (~1229, ~1553 e fechamento com ocorrência); coluna "Peso Carta Traço" já retorna vazio sem traço — passa a retornar vazio também sem volume; campo Volume (m³) no bloco de apuração do modal de edição.
- `src/lib/admin.functions.ts` (`atualizarPesagemAdmin`): aceitar `volume_m3` manual e recalcular `peso_esperado`, `diferenca_kg`, `diferenca_pct`, `tolerancia_aplicada`, `status_afericao` e `resultado_afericao`; log com valores antes/depois.
- Backfill em SQL (sem mudança de schema): recalcular onde `itens_nf` tem exatamente um item em M3 não-matéria-prima; limpar `volume_m3`/`peso_esperado`/`diferenca_*`/`status_afericao` nos demais, marcando a origem como "a confirmar" em `volume_derivado_detalhe`.
