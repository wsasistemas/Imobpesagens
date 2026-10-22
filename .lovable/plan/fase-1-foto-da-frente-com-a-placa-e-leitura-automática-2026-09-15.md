# Fase 1 — foto da frente com a placa e leitura automática

## O que muda para o operador

Na entrada do caminhão na balança, a Fase 1 passa a exigir **duas fotos**:

1. Foto 001 — caminhão vazio (como já é hoje).
2. Foto 002 — **frente do caminhão com a placa visível** (nova, obrigatória).

Ao tirar a foto da frente, o sistema lê a placa da imagem e **preenche o campo Placa
automaticamente**. O campo continua editável: o operador pode corrigir ou digitar a placa
quando a leitura não sair (foto escura, placa suja, chuva).

Se a placa digitada for **diferente** da placa lida na foto, o sistema **não deixa salvar a
entrada** — aparece um aviso comparando as duas e o operador precisa corrigir a placa ou
tirar novamente a foto da frente. A leitura e a divergência ficam registradas no histórico
do processo.

## Regras

- Sem a foto da frente não é possível registrar a tara nem abrir o processo.
- Sem a foto da frente o peso bruto (Fase 2) continua bloqueado, igual à foto 001 hoje.
- A exigência da foto 002 vale para processos abertos a partir da entrada em vigor.
  Processos já abertos ou já concluídos seguem válidos com as fotos que têm.
- A placa gravada no processo é sempre a que está no campo, confirmada pelo operador.
- Leitura indisponível (internet ou serviço fora) não bloqueia: o operador digita a placa e
  segue, com registro de "placa não lida" no histórico.

## Relatório fotográfico

O relatório passa de 5 para 6 fotos, mantendo 2 páginas:

```text
Página 1: 001 caminhão vazio | 002 frente com a placa
          004 caçamba cheia  | 010 recibo do sucateiro
Página 2: 011 comprovante de pagamento
          012 Nota Fiscal Avulsa (quadro grande, modelo oficial)
```

## Detalhes técnicos

- `posicoes-evidencia.ts`: nova posição 2 ("Frente do caminhão com a placa", bloco A,
  fase 1); `POSICOES_BLOCO_A = [1, 2]`; novo `POSICAO_FRENTE_PLACA`.
- `fases-v2.ts`: resumo da Fase 1 e novo marco "Foto 002 — frente com a placa".
- `painel-sucata.tsx`: segundo campo de foto na entrada, leitura da placa ao anexar,
  comparação com o campo Placa, bloqueio do botão salvar em caso de divergência e envio da
  evidência 002 junto da 001 na criação do processo.
- Nova função de servidor `ler-placa.functions.ts`: envia a imagem ao modelo de visão já
  usado no módulo (mesmo gateway da leitura da NFA), devolve `{ placa, confianca }`
  normalizada; imagem não é armazenada fora do bucket de evidências.
- Auditoria em `sucata_eventos`: `placa_lida_ocr` (placa lida, confiança) e
  `placa_divergente` (lida x digitada).
- `relatorio-fotografico.tsx` e `relatorio-pdf.ts`: nova distribuição dos quadros.
- Migração aditiva: `sucata_posicao_faltante_bloco_a` passa a cobrir as posições 1 e 2, e
  `sucata_encerramento_trg` exige a 002 apenas para processos criados a partir da data de
  vigência. Nenhuma coluna ou dado é removido.

## Fora do escopo

Nenhuma alteração nas Fases 2, 3 e 4, no fluxo da NFA, no relatório já emitido (continua
imutável) ou em telas fora do módulo de sucata.
