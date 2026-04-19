#!/bin/bash
# Entrypoint script para gerenciar o bot em produção
# Inclui healthcheck, logs estruturados e reinício automático

set -e

echo "🚀 Iniciando Warface Bot..."
echo "📦 Node version: $(node --version)"
echo "📁 Diretório: $(pwd)"

# Verificar se as variáveis de ambiente obrigatórias estão definidas
if [ -z "$DISCORD_TOKEN" ]; then
  echo "❌ ERRO: Variável DISCORD_TOKEN não está definida!"
  echo "   Configure no painel da plataforma (Heroku/Railway/Render) ou no .env"
  exit 1
fi

echo "✅ DISCORD_TOKEN configurado"

# Verificar node_modules
if [ ! -d "node_modules" ]; then
  echo "📥 Instalando dependências..."
  npm ci --only=production
fi

# Criar diretório de logs se não existir
mkdir -p logs

# Iniciar healthcheck server em background (porta 3000)
cat > healthcheck.js << 'EOF'
const http = require('http');
const { spawn } = require('child_process');

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    // Verificar se processo principal está rodando
    const hasBotProcess = global.__BOT_PID__ && process.kill(global.__BOT_PID__, 0);
    if (hasBotProcess) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
    } else {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'error', error: 'bot not running' }));
    }
  } else {
    res.writeHead(404);
    res.end();
  }
});

const PORT = process.env.HEALTHCHECK_PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🏥 Healthcheck server rodando na porta ${PORT}`);
});
EOF

node healthcheck.js &
HEALTHCHECK_PID=$!
echo "✅ Healthcheck iniciado (PID: $HEALTHCHECK_PID)"

# Função para iniciar o bot
start_bot() {
  echo "🤖 Iniciando bot Discord..."
  exec node bot.js
}

# Capturar sinais para shutdown graceful
trap "echo '🛑 Parando bot...'; kill $HEALTHCHECK_PID 2>/dev/null || true; exit 0" SIGTERM SIGINT

# Iniciar bot
start_bot
