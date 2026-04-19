# Configuração do Bot Warface

## ⚙️ Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto(baseado no `.env.example`):

```env
DISCORD_TOKEN=seu_token_do_bot_aqui

# Opcional: IDs dos canais permitidos separados por vírgula.
# Se vazio, o bot responde em todos os canais onde tiver permissão.
DISCORD_ALLOWED_CHANNEL_IDS=

# Atualização automática dos desafios em minutos
DATA_REFRESH_MINUTES=10

# URL raw do data.js no GitHub (opcional - se vazio usa data.js local)
GITHUB_DATA_URL=https://raw.githubusercontent.com/SEU_USUARIO/SEU_REPO/main/data.js

# Alternativa: montar URL por partes (se GITHUB_DATA_URL estiver vazio)
GITHUB_OWNER=
GITHUB_REPO=
GITHUB_BRANCH=main
GITHUB_DATA_PATH=data.js
```

## 🔧 Passos de Configuração

### 1. Criar aplicação no Discord Developer Portal
1. Acesse https://discord.com/developers/applications
2. Clique em **"New Application"** → Dê um nome → Create
3. Vá em **"Bot"** à esquerda → **"Add Bot"** → Yes, do it!
4. **Copie o Token** (revelar com "Reset Token" se necessário)

### 2. Habilitar Intents (Permissões Privilegiadas)
No mesmo painel "Bot",Role** até **"Privileged Gateway Intents"**:
- ✅ **MESSAGE CONTENT INTENT** (obrigatória)
- ✅ **SERVER MEMBERS INTENT** (opcional, não usada atualmente)

Clique em **"Save Changes"**.

### 3. Gerar URL de Convite
1. Vá em **"OAuth2"** → **"URL Generator"**
2. Em **"Scopes"**, marque:
   - `bot`
3. Em **"Bot Permissions"**, marque:
   - ✅ **Send Messages**
   - ✅ **Read Message History**
   - ✅ **Embed Links** (para exibir imagens nos embeds)
   - ✅ **Use Slash Commands** (opcional)
4. Copie a URL gerada e abra no navegador para adicionar o bot ao seu servidor.

### 4. Instalar dependências
```bash
npm install
```

### 5. Executar o bot
```bash
npm start
```

ou

```bash
node bot.js
```

## 🐛 Solução de Problemas

### Bot não responde mensagens
- Verifique se `DISCORD_TOKEN` está correto no `.env`
- Confirme que **Message Content Intent** está ativada no portal
- Reinvite o bot com a nova URL de convite (se alterou permissões)
- Verifique se o bot tem permissão de **Send Messages** no canal
- Se `DISCORD_ALLOWED_CHANNEL_IDS` estiver configurada, o canal deve estar na lista

### Erro "Missing Permissions"
- O bot precisa da permissão **Embed Links** se for usar embeds com imagem
- Verifique as permissões do cargo/bot no canal (Config. de Canal → Permissões)

### Imagens não aparecem
- O bot tenta múltiplas URLs para cada imagem; se todas falharem, mostra ícone de fallback
- Verifique se `warbanner-metadata.js` está presente e contém as entradas corretas
- Algumas imagens podem estar quebradas no servidor original

### Dados desatualizados
- O bot recarrega dados a cada `DATA_REFRESH_MINUTES` (padrão: 10 min)
- Logs no console mostram fonte de dados: `local:data.js` ou `github:URL`
- Para forçar recarregamento, reinicie o bot

### Rate limit do GitHub
- Se usar `GITHUB_DATA_URL`, o bot faz ~6 requisições/hora (padrão 10min)
- Aumente `DATA_REFRESH_MINUTES` para 30 ou 60 se necessário

## 📁 Estrutura do Projeto

```
Conquistas-Warface/
├── bot.js                 # Ponto de entrada do bot Discord
├── app.js                 # Frontend (browser) - busca interativa
├── data.js                # Dados locais das conquistas (fallback)
├── warbanner-filter-core.js   # Lógica de filtros e busca
├── warbanner-metadata.js      # Metadados de imagens
├── discord.js             # SDK de Discord Activity (para app web)
├── index.html             # Página web principal
├── styles.css             # Estilos
├── package.json           # Dependências
├── .env.example           # Modelo de variáveis de ambiente
└── .env                   # <-- Crie este com suas configurações
```

## 🚀 Comandos do Bot

O bot responde automaticamente a mensagens que contêm termos de busca:

- `marca` → mostra conquistas de marcas
- `insignia` → mostra insígnias
- `fita` → mostra fitas
- `elimine 100` → busca conquistas que envolvem eliminar 100 inimigos
- `gold` → destaca conquistas gold (999 eliminações)

**Limite**: Busca retorna até 10 resultados. Se houver mais, o bot informa a quantidade restante.

## 📊 Logs

O bot usa `console.log` / `console.error` com prefixos:

- `[discord]` – eventos do Discord
- `[data]` – carregamento/atualização de dados
- `[metadata]` – metadados de imagens
- `[config]` – configuração
- `[fatal]` – erros fatais que encerram o bot

## 🛠️ Tecnologias

- **Node.js** >= 16.9.0
- **discord.js** v14.21.0
- **API Discord** Gateway (WebSocket)
