#!/bin/bash
# Deploy automatizado do Warface Bot
# Suporta: VPS, Docker, PM2, systemd

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

check_command() {
  if command -v "$1" &> /dev/null; then
    return 0
  else
    return 1
  fi
}

# Verificar prerequisites
check_prerequisites() {
  log_info "Verificando pré-requisitos..."

  local missing=0

  if ! check_command node; then
    log_error "Node.js não encontrado. Instale: https://nodejs.org/"
    missing=1
  else
    local node_version=$(node --version | cut -d'v' -f2)
    log_ok "Node.js $node_version"
  fi

  if ! check_command npm; then
    log_error "npm não encontrado."
    missing=1
  else
    log_ok "npm $(npm --version)"
  fi

  if [ $missing -eq 1 ]; then
    exit 1
  fi
}

# Instalar dependências
install_deps() {
  log_info "Instalando dependências..."
  if [ -f "package-lock.json" ]; then
    npm ci --only=production
  else
    npm install --only=production
  fi
  log_ok "Dependências instaladas"
}

# Verificar configuração
check_config() {
  log_info "Verificando configuração..."

  if [ ! -f ".env" ]; then
    log_warn "Arquivo .env não encontrado."
    if [ -f ".env.example" ]; then
      log_info "Copiando .env.example para .env"
      cp .env.example .env
      log_warn "IMPORTANTE: Edite .env e adicione seu DISCORD_TOKEN!"
    fi
  else
    log_ok ".env encontrado"
  fi

  # Verificar token
  if [ -z "$DISCORD_TOKEN" ]; then
    if [ -f ".env" ]; then
      source .env 2>/dev/null || true
    fi
  fi

  if [ -z "$DISCORD_TOKEN" ]; then
    log_error "DISCORD_TOKEN não definido!"
    log_info "Configure no .env ou nas variáveis de ambiente da plataforma"
    return 1
  fi

  log_ok "DISCORD_TOKEN configurado"
}

# Testar bot localmente
test_bot() {
  log_info "Testando bot (2 segundos)..."
  timeout 2 node bot.js 2>&1 | head -5 || true
  log_ok "Teste concluído"
}

# Build Docker
build_docker() {
  if ! check_command docker; then
    log_warn "Docker não instalado, pulando build"
    return 0
  fi

  log_info "Construindo imagem Docker..."
  docker build -t warface-bot:latest .
  log_ok "Imagem construída"

  # Parar container existente
  if docker ps -a --format '{{.Names}}' | grep -q "^warface-bot$"; then
    log_info "Parando container warface-bot existente..."
    docker stop warface-bot 2>/dev/null || true
    docker rm warface-bot 2>/dev/null || true
  fi

  log_info "Iniciando container..."
  docker run -d \
    --name warface-bot \
    --restart unless-stopped \
    -v "$(pwd)/logs:/app/logs" \
    --env-file .env \
    warface-bot:latest

  log_ok "Container rodando"
  docker ps --filter "name=warface-bot"
}

# Deploy com PM2
deploy_pm2() {
  if ! check_command pm2; then
    log_warn "PM2 não instalado. Instalando..."
    npm install -g pm2
  fi

  log_info "Deploy com PM2..."

  # Parar instância anterior
  pm2 delete warface-bot 2>/dev/null || true

  # Start
  pm2 start ecosystem.config.js --env production

  # Salvar
  pm2 save

  # Configurar startup (se ainda não configurado)
  pm2 startup | head -5

  log_ok "Bot iniciado com PM2"
  pm2 status warface-bot
}

# Deploy com systemd
deploy_systemd() {
  log_info "Deploy com systemd..."

  sudo cp warface-bot.service /etc/systemd/system/
  sudo systemctl daemon-reload
  sudo systemctl enable warface-bot
  sudo systemctl start warface-bot

  log_ok "Serviço iniciado"
  sudo systemctl status warface-bot --no-pager -l
}

# Mostrar status
show_status() {
  echo ""
  log_info "=== STATUS ==="

  if check_command docker && docker ps --format '{{.Names}}' | grep -q "^warface-bot$"; then
    echo "🐳 Docker:"
    docker ps --filter "name=warface-bot" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
  fi

  if check_command pm2; then
    echo ""
    echo "📊 PM2:"
    pm2 status warface-bot 2>/dev/null || echo "  (não encontrado)"
  fi

  if check_command systemctl; then
    echo ""
    echo "🔧 Systemd:"
    sudo systemctl status warface-bot --no-pager -l 2>/dev/null || echo "  (não encontrado)"
  fi

  echo ""
  log_info "Logs:"
  echo "  Docker:  docker logs -f warface-bot"
  echo "  PM2:     pm2 logs warface-bot"
  echo "  Systemd: sudo journalctl -u warface-bot -f"
}

# Menu interativo
show_menu() {
  clear
  echo "================================================"
  echo "    🤖 Warface Bot - Deploy Manager"
  echo "================================================"
  echo ""
  echo "1) 📦 Instalar dependências"
  echo "2) 🐳 Deploy com Docker"
  echo "3) 🚀 Deploy com PM2"
  echo "4) 🔧 Deploy com Systemd (VPS)"
  echo "5) 🧪 Testar bot localmente"
  echo "6) 📊 Mostrar status"
  echo "7) 📋 Criar backup"
  echo "8) 🛑 Parar bot"
  echo "9) ❌ Sair"
  echo ""
  read -p "Escolha uma opção [1-9]: " choice

  case $choice in
    1) check_prerequisites && install_deps && check_config ;;
    2) check_prerequisites && install_deps && build_docker ;;
    3) check_prerequisites && install_deps && check_config && deploy_pm2 ;;
    4) check_prerequisites && install_deps && check_config && deploy_systemd ;;
    5) check_prerequisites && install_deps && check_config && test_bot ;;
    6) show_status ;;
    7) ./backup.sh create ;;
    8)
      if docker ps --format '{{.Names}}' | grep -q "^warface-bot$"; then
        docker stop warface-bot && docker rm warface-bot
      fi
      if pm2 list | grep -q "warface-bot"; then
        pm2 stop warface-bot && pm2 delete warface-bot
      fi
      if systemctl is-active --quiet warface-bot; then
        sudo systemctl stop warface-bot
      fi
      log_ok "Bot parado"
      ;;
    9) exit 0 ;;
    *) log_error "Opção inválida" ;;
  esac

  echo ""
  read -p "Pressione ENTER para continuar..."
  show_menu
}

# Main
case "${1:-}" in
  --help|-h)
    echo "Uso: $0 [comando]"
    echo ""
    echo "Comandos:"
    echo "  docker      Build e executa com Docker"
    echo "  pm2         Deploy com PM2"
    echo "  systemd     Deploy com systemd"
    echo "  install     Apenas instala dependências"
    echo "  test        Testa bot localmente"
    echo "  status      Mostra status de todos os métodos"
    echo "  backup      Cria backup"
    echo "  menu        Menu interativo (padrão)"
    echo ""
    echo "Exemplos:"
    echo "  $0                  #_menu interativo"
    echo "  $0 docker          #Deploy Docker"
    echo "  $0 pm2             #Deploy PM2"
    exit 0
    ;;
  docker)
    check_prerequisites && install_deps && check_config && build_docker
    ;;
  pm2)
    check_prerequisites && install_deps && check_config && deploy_pm2
    ;;
  systemd)
    check_prerequisites && install_deps && check_config && deploy_systemd
    ;;
  install)
    check_prerequisites && install_deps && check_config
    ;;
  test)
    check_prerequisites && install_deps && check_config && test_bot
    ;;
  status)
    show_status
    ;;
  backup)
    ./backup.sh create
    ;;
  menu|'')
    show_menu
    ;;
  *)
    log_error "Comando desconhecido: $1"
    exit 1
    ;;
esac
