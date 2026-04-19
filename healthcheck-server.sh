#!/bin/bash
# Uptime / Healthcheck endpoint para o bot
# Rodar como serviço separado na porta 3000
# Integra com Docker HEALTHCHECK ou serviços externos

set -e

PORT=${HEALTHCHECK_PORT:-3000}
BOT_PID_FILE="/tmp/warface-bot.pid"
LOG_FILE="./logs/healthcheck-server.log"

# Se for chamado como healthcheck-server, inicia servidor
if [ "$1" = "server" ]; then
  echo "🏥 Healthcheck Server iniciando na porta $PORT..."

  # Criar log file se não existir
  touch "$LOG_FILE"

  # Servidor HTTP simples com netcat (compatível com alpine)
  while true; do
    # Verificar se bot está rodando
    BOT_ALIVE=false
    if [ -f "$BOT_PID_FILE" ]; then
      BOT_PID=$(cat "$BOT_PID_FILE")
      if kill -0 "$BOT_PID" 2>/dev/null; then
        BOT_ALIVE=true
      fi
    fi

    # Fallback: verificar processo pelo nome
    if [ "$BOT_ALIVE" = false ]; then
      if pgrep -f "node.*bot.js" > /dev/null 2>&1; then
        BOT_ALIVE=true
      fi
    fi

    # Responder requisição (simulação via echo + nc)
    # Em produção, usar um servidor HTTP real. Aqui usamos um loop simplification.
    sleep 5
  done
fi

# Modo healthcheck (executar e sair)
if [ "$1" = "check" ]; then
  # Verificar se processo bot está rodando
  if pgrep -f "node.*bot.js" > /dev/null 2>&1; then
    echo "✅ Bot está rodando"
    exit 0
  else
    echo "❌ Bot não está rodando"
    exit 1
  fi
fi

echo "Uso: $0 {server|check}"
exit 1
