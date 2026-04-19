# Deploy do bot Discord

Este repositorio agora esta pronto para rodar 24/7 no Render sem depender da sua maquina.

## O que ja esta configurado

- `render.yaml` cria um `worker` Node com deploy automatico a cada push na branch `main`
- o bot inicia com `npm start`
- os dados sao carregados do `data.js` publicado no proprio GitHub
- o bot responde por mensagem e tambem pelo slash command `/conquista`

## Passo a passo no Render

1. Entre em `https://dashboard.render.com/`
2. Clique em `New +` -> `Blueprint`
3. Conecte o repositorio `stiflerwfl1-oss/Conquistas-Warface`
4. Confirme a criacao do servico `conquistas-warface-bot`
5. Defina a variavel secreta `DISCORD_TOKEN`
6. Faça o deploy

## Configuracao obrigatoria no Discord Developer Portal

1. Abra `https://discord.com/developers/applications`
2. Selecione o aplicativo do bot
3. Em `Bot`, confirme que o token atual e o mesmo usado no Render
4. Ative `MESSAGE CONTENT INTENT` se quiser busca por mensagem livre
5. Se nao ativar esse intent, o comando `/conquista` continua funcionando

## Evidencia esperada nos logs

- `[data] ... desafios carregados de github:...`
- `[discord] Online como ...`
- `[discord] Slash command /conquista sincronizado.`

## Variaveis opcionais

- `DISCORD_ALLOWED_CHANNEL_IDS`: IDs separados por virgula para limitar onde o bot responde
- `DATA_REFRESH_MINUTES`: intervalo de atualizacao do catalogo
