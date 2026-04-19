# 🚀 Deploy Rápido — Warface Bot

## ☁️ Plataformas Suportadas

| Plataforma | Tipo | Custo | Link |
|------------|------|-------|------|
| **Railway** | PaaS | Free tier (500h/mês) | [railway.app](https://railway.app) |
| **Render** | PaaS | Free (com sleep) | [render.com](https://render.com) |
| **Heroku** | PaaS | Free limitado | [heroku.com](https://heroku.com) |
| **Docker** | Container | Qualquer VPS | - |
| **VPS** | Bare metal | DigitalOcean, Linode, AWS EC2 | - |

---

## 📦 Railway (Recomendado — mais simples)

1. **Fork** este repositório no seu GitHub
2. Crie conta em [Railway.app](https://railway.app) (GitHub OAuth)
3. Clique **"New Project"** → **"Deploy from GitHub repo"**
4. Selecione seu fork
5. Configure variáveis de ambiente:
   - `DISCORD_TOKEN` → seu token do Discord
   - `DATA_REFRESH_MINUTES` → `10` (ou outro)
6. Clique **Deploy**

Pronto! O bot será implantado automaticamente a cada push no `main`.

---

## ⚡ Render

1. Fork no GitHub
2. Crie conta em [Render.com](https://render.com)
3. **New +** → **Web Service**
4. Conecte seu repositório
5. Configure:
   - **Name**: `warface-bot`
   - **Environment**: `Node`
   - **Build Command**: `npm ci --only=production`
   - **Start Command**: `node bot.js`
   - **Plan**: Free
6. **Environment Variables**:
   - `DISCORD_TOKEN` → seu token
   - `NODE_ENV` → `production`
7. Create Web Service

Deploy automático ativado.

---

## 🐳 Docker (VPS Local)

```bash
# Clone e entre no diretório
git clone https://github.com/stiflerwfl1-oss/Conquistas-Warface.git
cd Conquistas-Warface

# Configure .env
cp .env.example .env
nano .env  # adicione DISCORD_TOKEN

# Build e execute
docker-compose up -d

# Ver logs
docker logs -f warface-bot
```

---

## 🖥️ VPS (Ubuntu/Debian) — Install Automático

```bash
# Execute como root ou com sudo
curl -fsSL https://raw.githubusercontent.com/stiflerwfl1-oss/Conquistas-Warface/main/install.sh | bash

# Ou baixe e execute localmente:
wget https://raw.githubusercontent.com/stiflerwfl1-oss/Conquistas-Warface/main/install.sh
chmod +x install.sh
sudo ./install.sh
```

O instalador oferecerá opções:
1. Docker (recomendado)
2. PM2 (cluster mode)
3. Systemd (service nativo)

---

## 🔧 Configuração OBRIGATÓRIA (todas plataformas)

### 1. Discord Developer Portal

1. Acesse: https://discord.com/developers/applications
2. Crie app → Bot
3. Ative **Privileged Gateway Intents**:
   - ✅ `MESSAGE CONTENT INTENT`
4. Copie o **Token**
5. Gere invite URL com permissões:
   - `Send Messages`
   - `Embed Links`
   - `Read Message History`

### 2. Variável de Ambiente

```env
DISCORD_TOKEN=SEU_TOKEN_AQUI
DISCORD_ALLOWED_CHANNEL_IDS=  # vazio = todos os canais (opcional)
DATA_REFRESH_MINUTES=10       # (opcional)
```

No Railway/Render: painel → Environment Variables.

No Docker/VPS: arquivo `.env` ou `-e` no comando.

---

## 📡 Verificação

Após deploy:

```bash
# Ver logs (Docker)
docker logs -f warface-bot

# Ver logs (PM2)
pm2 logs warface-bot

# Ver logs (Systemd)
sudo journalctl -u warface-bot -f
```

No Discord, envie no canal:
```
marca
```
O bot deve responder com lista de conquistas.

---

## 🔄 CI/CD

Este repositório já contém GitHub Actions (`.github/workflows/deploy.yml`):

- ✅ Testa sintaxe automaticamente
- 🐳 Builda imagem Docker e sobe para GHCR
- 🚀 Trigger deploy no Railway/Render
- 📢 Notifica sucesso

Para ativar:
1. Fork o repo
2. No GitHub: Settings → Secrets → Actions
3. Adicione:
   - `RAILWAY_TOKEN` (se usar Railway)
   - `RAILWAY_DEPLOYMENT_ID`
   - `RENDER_API_KEY` (se usar Render)
   - `RENDER_SERVICE_ID`

Push em `main` dispara deploy automático.

---

## 📊 Monitoramento

### Healthcheck (Docker)
```bash
curl http://localhost:3000/health
# {"status":"ok","timestamp":...}
```

### Métricas
- Logs: ver comandos acima
- Status: `docker ps` / `pm2 status` / `systemctl status warface-bot`

### Backup
```bash
./backup.sh create   # cria backup
./backup.sh list     # lista
./backup.sh restore backup_20250419.tar.gz  # restaura
```

---

## ⚠️ Troubleshooting Rápido

| Problema | Causa | Solução |
|----------|-------|---------|
| Bot não responde | Token errado | Verifique `DISCORD_TOKEN` |
| | Intent desativada | Ative Message Content no Portal |
| | Canal sem permissão | Dê `Send Messages` ao bot |
| Erro 50013 | Missing Permissions | Adicione Embed Links |
| Container cai | Memória insuficiente | Aumente limite ou use plano maior |
| Dados desatualizados | GitHub API rate limit | Aumente `DATA_REFRESH_MINUTES` |

---

## 🛠️ Comandos Úteis

```bash
# Docker
docker restart warface-bot
docker logs -f warface-bot
docker exec warface-bot node -e "console.log('test')"

# PM2
pm2 restart warface-bot
pm2 logs warface-bot
pm2 monit

# Systemd
sudo systemctl restart warface-bot
sudo journalctl -u warface-bot -f

# Atualizar código (todos)
git pull origin main
npm ci --only=production

# Se Docker:
docker build -t warface-bot:latest .
docker stop warface-bot && docker rm warface-bot
docker run -d --name warface-bot --restart unless-stopped \
  -v $(pwd)/logs:/app/logs \
  --env-file .env warface-bot:latest
```

---

## 📁 Estrutura de Arquivos

```
Conquistas-Warface/
├── bot.js                    # Código principal (NÃO alterar sem testar)
├── data.js                   # Dados locais (fallback)
├── warbanner-filter-core.js  # Lógica de busca
├── warbanner-metadata.js     # Metadados de imagens
├── package.json              # Dependências
├── Dockerfile                # Imagem Docker
├── Procfile                  # Heroku/Railway
├── docker-compose.yml        # Orquestração
├── ecosystem.config.js       # PM2
├── warface-bot.service       # Systemd
├── .env.example              # Modelo de config
├── .github/workflows/        # CI/CD
├── README.md                 # Doc completa
└── SETUP.md                  # Guia detalhado
```

---

**Precisa de ajuda?** Abra uma [issue](https://github.com/stiflerwfl1-oss/Conquistas-Warface/issues) no GitHub.
