# Alerta WhatsApp (Meta) para divergência acima da tolerância

## O que muda

Quando uma pesagem é fechada (entrada + saída, status concluída ou fechada c/ ocorrência) e a regra técnica já existente do **Sinal Tolerância** retorna a chave `acima`, o sistema:

1. Registra/complementa a ocorrência automática na própria pesagem (tipo **Outro**, descrição **TOLERANCIA ACIMA DO PERMITIDO**, placa, data do fechamento e relato padrão) — sem sobrescrever ocorrência manual e sem mudar o status da pesagem.
2. Resolve a coligada da obra e localiza **um único engenheiro responsável** dessa coligada no cadastro de usuários, usando o telefone do perfil normalizado em E.164 (ex.: 5511999999999).
3. Envia **um template aprovado pela Meta** (`alerta_pesagem_acima_tolerancia`, variáveis: placa e data DD/MM/AAAA) pela WhatsApp Business Platform oficial. Canal unidirecional, sem central de conversas.
4. Grava um log de alerta com status (pendente/enviado/entregue/lido/falhou), ID da Meta e detalhe de erro, com **disparo único por pesagem** garantido por restrição no banco.

O e-mail automático de tolerância que já existe continua funcionando; o WhatsApp é um canal adicional, exclusivo para o engenheiro responsável.

## Como o engenheiro responsável é definido

O cadastro de usuários por coligada ganha uma marcação **"Engenheiro responsável"**. Apenas um usuário por coligada pode ficar marcado. O telefone usado é o do perfil desse usuário (Meu Perfil / cadastro de usuários), validado no formato internacional.

Sem responsável marcado, ou com telefone inválido, o alerta **não** é enviado: fica registrado no log como pendência, e o operador vê a mensagem correspondente.
