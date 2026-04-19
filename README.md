# 🤖 Bot Warface - Conquistas

Bot Discord automatizado para buscar e exibir conquistas (marcas, insígnias, fitas) do Warface.

![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)
![Discord.js](https://img.shields.io/badge/discord.js-v14.21.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Status](https://img.shields.io/badge/status-active-success.svg)

## 🚀 Funcionalidades

- 🔍 **Busca inteligente** de conquistas com filtros por tipo, cor, tags
- 🖼️ **Resolução automática de imagens** com fallback múltiplo
- 🔄 **Atualização automática** de dados (padrão: 10 min)
- 📦 **Containerizado** com Docker (imagem otimizada Alpine)
- 🛡️ **Resiliência**: Healthcheck, restart automático, logs estruturados
- ☁️ **Pronto para nuvem**: Heroku, Railway, Render, VPS

## ⚙️ Configuração Rápida

### 1. Discord Developer Portal

Crie uma aplicação no [Discord Developer Portal](https://discord.com/developers/applications):

1. **New Application** → Dê um nome
2. Vá em **Bot** → **Add Bot**
3. Ative **Privileged Gateway Intents**:
   - ✅ **MESSAGE CONTENT INTENT** (obrigatório)
   - ✅ **SERVER MEMBERS INTENT** (opcional)
4. Copie o **TOKEN** (`DISCORD_TOKEN`)
5. Gere URL de invite (OAuth2 → URL Generator):
   - Scopes: `bot`
   - Permissões: `Send Messages`, `Embed Links`, `Read Message History`

### 2. Variáveis de Ambiente

Crie `.env`:

```env
DISCORD_TOKEN=seu_token_aqui

# Opcional: IDs de canais permitidos (separados por vírgula)
DISCORD_ALLOWED_CHANNEL_IDS=

# Atualização de dados em minutos
DATA_REFRESH_MINUTES=10

# Fonte remota dos dados (opcional)
GITHUB_DATA_URL=https://raw.githubusercontent.com/SEU_USUARIO/REPO/main/data.js
GITHUB_OWNER=
GITHUB_REPO=
GITHUB_BRANCH=main
GITHUB_DATA_PATH=data.js
```

### 3. Execução Local

```bash
git clone https://github.com/stiflerwfl1-oss/Conquistas-Warface.git
cd Conquistas-Warface
npm install
cp .env.example .env
# edite .env com seu token
npm start
```

## 🐳 Docker (Recomendado)

```bash
# Build
docker build -t warface-bot .

# Run
docker run -d \
  --name warface-bot \
  --restart unless-stopped \
  -v $(pwd)/logs:/app/logs \
  -e DISCORD_TOKEN="${DISCORD_TOKEN}" \
  warface-bot

# Docker Compose
docker-compose up -d
```

## ☁️ Deploy em Plataformas

### Heroku

```bash
# Via CLI
heroku create warface-bot
heroku addons:add papertrail  # logs
heroku config:set DISCORD_TOKEN=seu_token
git push heroku main
```

**Importante**: Heroku requer `Procfile` (já incluído) e `engines.node` no package.json.

### Railway

1. Conecte seu repositório no [Railway](https://railway.app)
2. Adicione variável `DISCORD_TOKEN`
3. Deploy automático em cada push

### Render

1. Crie novo Web Service no [Render](https://render.com)
2. Conecte GitHub repo
3. Configure:
   - Runtime: Node
   - Build Command: `npm ci --only=production`
   - Start Command: `node bot.js`
4. Adicione Environment Variables

### VPS (Linux)

```bash
# Com PM2 (recomendado)
npm install -g pm2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup  # reinicia após reboot

# Com systemd
sudo nano /etc/systemd/system/warface-bot.service
# (conteúdo no arquivo warface-bot.service)
sudo systemctl enable warface-bot
sudo systemctl start warface-bot
```

## 🔄 CI/CD (Deploy Automático)

O repositório inclui GitHub Actions (`.github/workflows/deploy.yml`) que:

1. ✅ Testa sintaxe e instala dependências
2. 🐳 Build e push da imagem Docker para GHCR
3. 🚀 Trigger deploy em Railway/Render
4. 📢 Notifica sucesso

**Configurar secrets no GitHub**:
- `RAILWAY_TOKEN` e `RAILWAY_DEPLOYMENT_ID` (se usar Railway)
- `RENDER_API_KEY` e `RENDER_SERVICE_ID` (se usar Render)

## 📊 Comandos do Bot

O bot responde automaticamente a mensagens contendo termos de busca:

| Exemplo | Resultado |
|---------|-----------|
| `marca` | Lista conquistas do tipo marca |
| `insignia` | Lista insígnias |
| `fita` | Lista fitas |
| `elimine 100` | Busca conquistas com "eliminar 100" |
| `pvp` | Filtra conquistas PvP |
| `gold` | Destaca conquistas especiais (999 eliminações) |

**Limite**: até 10 resultados, com contador de remainder.

## 📁 Estrutura

```
Conquistas-Warface/
├── bot.js                    # Entrada principal do bot Discord
├── data.js                   # Dados locais das conquistas (fallback)
├── warbanner-filter-core.js  # Motor de busca e filtros
├── warbanner-metadata.js     # Metadados (nomes, cores, URLs)
├── app.js                    # Frontend web (Discord Activity)
├── discord.js                # SDK do Discord
├── index.html                # Interface web
├── package.json              # Dependências Node.js
├── Dockerfile                # Imagem Docker multi-stage
├── Procfile                  # Heroku/Railway/Render proc type
├── docker-compose.yml        # Orquestração local
├── entrypoint.sh             # Script de inicialização
├── monitor.js                # Monitor e auto-restart
├── ecosystem.config.js       # Config PM2
├── .env.example              # Modelo de variáveis
├── .dockerignore             # Otimiza build Docker
├── .github/
│   └── workflows/
│       └── deploy.yml        # CI/CD GitHub Actions
└── logs/                     # Diretório criado em runtime
```

## 🔍 Logs e Monitoramento

O bot gera logs com prefixos:

- `[discord]` – eventos e erros do Discord
- `[data]` – carregamento/atualização de dados
- `[metadata]` – metadados e imagens
- `[config]` – configuração
- `[fatal]` – erros fatais

### Ver logs

**Docker**:
```bash
docker logs -f warface-bot
```

**PM2**:
```bash
pm2 logs warface-bot
```

**Systemd**:
```bash
sudo journalctl -u warface-bot -f
```

**Healthcheck**:
```bash
curl http://localhost:3000/health
# Retorna: {"status":"ok","timestamp":...}
```

## 🛠️ Manutenção

### Atualizar dados manualmente
```bash
# Reiniciar bot para forçar reload
pm2 restart warface-bot
# ou
docker restart warface-bot
```

### Limpar logs
```bash
# Docker
docker exec warface-bot sh -c "truncate -s 0 logs/*.log"

# PM2
pm2 flush warface-bot

#manual
rm -f logs/*.log
```

### Backup de configuração
```bash
# Salvar .env e logs
tar -czf backup-$(date +%Y%m%d).tar.gz .env logs/
```

## ⚠️ Troubleshooting

### Bot não responde
- Verifique `DISCORD_TOKEN` nas variáveis da plataforma
- Confirme **Message Content Intent** ativada no Discord Portal
- Reinvite bot com nova URL (se alterou permissões)
- Verifique logs: `pm2 logs` ou `docker logs`

### Erro 50013 (Missing Permissions)
- Bot precisa de `Send Messages` e `Embed Links` no canal
- Verifique roles e permissões do canal

### Imagens não carregam
- Algumas imagens podem estar offline no servidor original
- `warbanner-metadata.js` contém mapeamento manual – verifique se está válido

### Rate limit GitHub
- Padrão: 10min entre atualizações (6 req/h)
- Aumente `DATA_REFRESH_MINUTES` se necessário

### Container reinicia sem parar
- Verifique logs para exception não tratada
- Ajuste `max_restarts` no `ecosystem.config.js`
- Teste localmente: `node bot.js`

## 📚 API & Arquitetura

### Fluxo de dados
```
[Discord Message] → searchChallenges() → filterCore.filterItems()
→ resolveBestImageResult() → message.channel.send()
```

### Cache de imagens
- Validade: 1 hora (TTL)
- Armazenamento: Map em memória
- Fallback: múltiplas URLs (metadata, image, fallbackOriginalUrl)

### Atualização de dados
- Fonte primária: `GITHUB_DATA_URL` (raw)
- Fallback: `data.js` local
- Intervalo configurável (min)

## 🤝 Contribuindo

Contribuições são bem-vindas! Abra uma issue ou PR.

1. Fork o repo
2. Crie branch: `git checkout -b feat/nova-feature`
3. Commit: `git commit -m "feat: adicionafeature"`
4. Push: `git push origin feat/nova-feature`
5. Abra Pull Request

## 📄 Licença

MIT – veja `LICENSE` para detalhes.

## 🙏 Agradecimentos

- [discord.js](https://discord.js.org) – API Discord
- [Warface/Warbanner](https://warbanner.com.br) – dados das conquistas
- Comunidade Warface Brasil

---

**Desenvolvido por**: @stiflerwfl1-oss  
**Repositório**: https://github.com/stiflerwfl1-oss/Conquistas-Warface
