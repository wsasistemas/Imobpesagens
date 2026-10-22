# Entrada de sucata: placa livre, sem crítica de cadastro

## Como fica

1. O operador escolhe o sucateiro ativo (como hoje).
2. Digita a placa do caminhão que chegou. A placa é aceita como está — sem exigir que ela já esteja no cadastro do sucateiro e sem bloquear se estiver em outro cadastro.
3. Se a placa já existir entre os caminhões daquele sucateiro, os dados conhecidos (tipo/modelo, capacidade, motorista habitual) são preenchidos como sugestão.
4. Se não existir, a placa é gravada e vinculada ao sucateiro escolhido automaticamente, sem passo extra de "Cadastrar caminhão".
5. Motorista continua obrigatório, pois é quem identifica o caminhão na entrada.
6. Única trava mantida: placa que já tem processo aguardando saída não abre novo processo (evita duplicidade).

## O que sai da tela

- Botão "Confirmar" e o aviso "A placa não está no cadastro deste sucateiro".
- Bloco "Cadastrar caminhão deste sucateiro" como etapa obrigatória. Os campos tipo/modelo, capacidade e motorista habitual ficam opcionais e, se preenchidos, são salvos junto.
- Mensagem de erro quando a placa pertence a outro sucateiro.

## Detalhes técnicos

- `src/components/sucata/painel-sucata.tsx`: remover `verificarPlaca` como pré-requisito e o estado `placaNova`/`avisoPlaca`; a placa digitada passa a alimentar direto o salvamento da entrada. Manter a lista de placas ativas do sucateiro como atalho de seleção.
- No salvar entrada: normalizar a placa, procurar veículo ativo do sucateiro com essa placa; se não houver, criar via `salvarVeiculo` (`sucateiro_id` do sucateiro escolhido, `situacao: 'ATIVO'`, demais campos opcionais) e usar o `id` retornado como `veiculoId`. Se houver e o operador tiver preenchido tipo/capacidade/motorista habitual, atualizar via `atualizarDadosVeiculo`.
- Manter `buscarProcessoPendentePorPlaca` antes de abrir o processo; remover o uso de `buscarDonoDaPlaca` como bloqueio.
- Snapshot do processo continua gravando sucateiro, placa, tipo/capacidade do veículo e motorista informado.
- Aviso de tara acima da capacidade só aparece quando houver capacidade cadastrada.
- Sem migração de banco. Fluxo de saída (bruto) e demais telas do Portal inalterados.

## Ponto de atenção

Se a mesma placa já estiver cadastrada para outro sucateiro, hoje existe restrição de placa única entre veículos ativos no banco. Nesse caso a placa não pode ser criada de novo para o sucateiro atual; a entrada será aberta reaproveitando o veículo existente, apenas com o vínculo do processo apontando para o sucateiro escolhido na tela — sem mensagem de erro para o operador.
