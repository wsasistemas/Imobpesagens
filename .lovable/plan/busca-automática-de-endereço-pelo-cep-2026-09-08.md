# Busca automática de endereço pelo CEP

No cadastro do sucateiro, ao digitar o CEP o sistema preenche logradouro, bairro, município e UF automaticamente, deixando o usuário digitar só o número e o complemento.

## Como vai funcionar na tela

1. O usuário digita o CEP. O campo passa a mostrar a máscara `00000-000`.
2. Assim que os 8 dígitos estiverem completos, a busca dispara sozinha (sem precisar clicar). Também há um botão de lupa ao lado do CEP para tentar de novo.
3. Enquanto busca, aparece "Buscando endereço..." e os campos de endereço ficam bloqueados por um instante.
4. Com o CEP encontrado: logradouro, bairro, município e UF são preenchidos e o foco vai direto para o campo Número.
5. CEP não encontrado ou serviço fora do ar: aviso discreto "CEP não encontrado — preencha o endereço manualmente" e os campos seguem editáveis. Nada travado, nada apagado.
6. O usuário sempre pode corrigir qualquer campo preenchido; ao trocar o CEP a busca roda de novo.
7. Ao abrir um sucateiro já cadastrado, nada é sobrescrito — a busca só acontece quando o usuário altera o CEP.

O mesmo comportamento fica disponível para reuso em outros cadastros de endereço, mas nesta entrega será aplicado apenas ao cadastro do sucateiro (tela do anexo).

## Detalhes técnicos

- Consulta de CEP no servidor, nunca do navegador para o serviço externo: nova função de servidor autenticada (`requireSupabaseAuth`) em `src/lib/sucata/cep.functions.ts`, validando o CEP com Zod (8 dígitos) antes de sair.
- Provedor: BrasilAPI (`/api/cep/v2/{cep}`) com fallback para ViaCEP quando a primeira falhar. Ambos são públicos e não exigem chave nem segredo.
- Timeout de 6 s por provedor (`AbortSignal.timeout`) e uma única retentativa; erro tratado e devolvido como `{ encontrado: false }` — a tela nunca fica em carregamento infinito.
- Cache em memória do worker por CEP (TTL de 24 h, limite de entradas) para evitar chamadas repetidas. Sem Redis nesta entrega: o padrão do workspace pede Redis para integrações externas, e ficará registrado como pendência em `docs/sucata.md` junto às outras.
- Retorno enxuto: `{ encontrado, logradouro, bairro, municipio, uf }` — nenhum dado pessoal envolvido, nada sensível em log (registro apenas do CEP e do status).
- Hook `src/hooks/useBuscaCep.ts` com React Query (`staleTime` longo, `enabled` só com 8 dígitos) para reuso em outros formulários.
- Alterações de tela restritas a `src/components/sucata/form-sucateiro.tsx`: máscara do CEP, disparo automático, botão de lupa, mensagem de estado e foco no campo Número.
- Sem mudança de banco, sem mudança de regra de negócio, sem alteração em telas existentes fora do formulário do sucateiro.

## Arquivos

- Novo: `src/lib/sucata/cep.functions.ts`, `src/hooks/useBuscaCep.ts`
- Alterado: `src/components/sucata/form-sucateiro.tsx`, `src/lib/sucata/validadores.ts` (formatador de CEP), `docs/sucata.md` (pendência de cache em Redis)

## Checklist de aceite

- [ ] CEP com 8 dígitos preenche logradouro, bairro, município e UF
- [ ] Máscara `00000-000` e fonte monoespaçada no campo
- [ ] Foco vai para Número após o preenchimento
- [ ] CEP inexistente mostra aviso e mantém tudo editável
- [ ] Serviço fora do ar não trava a tela nem impede salvar manualmente
- [ ] Edição de sucateiro existente não sobrescreve endereço sem o usuário mexer no CEP
- [ ] Consulta sai do servidor, autenticada, e nenhuma chamada externa parte do navegador
- [ ] Nada pré-existente do Portal quebrou
