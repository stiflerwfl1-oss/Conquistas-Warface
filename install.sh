#!/bin/bash
# Instalação completa do Warface Bot em VPS (Ubuntu/Debian/CentOS)
# Uso: curl -fsSL https://raw.githubusercontent.com/stiflerwfl1-oss/Conquistas-Warface/main/install.sh | bash

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Detectar OS
detect_os() {
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VER=$VERSION_ID
  elif [ -f /etc/redhat-release ]; then
    OS="rhel"
    VER=$(grep -o '[0-9]\+' /etc/redhat-release | head -1)
  else
    OS="unknown"
  fi
  echo "$OS"
}

OS=$(detect_os)
echo -e "${BLUE}🧰 Detectado: $OS${NC}"

# Funções de instalação
install_nodejs() {
  echo -e "${YELLOW}📦 Instalando Node.js 18...${NC}"

  case "$OS" in
    ubuntu|debian)
      curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
      apt-get install -y nodejs
      ;;
    centos|rhel|fedora|rocky|almalinux)
      curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
      yum install -y nodejs
      ;;
    alpine)
      apk add --no-cache nodejs npm
      ;;
    *)
      echo -e "${RED}❌ OS não suportado. Instale Node.js manualmente (>=16.9.0)${NC}"
      exit 1
      ;;
  esac

  local version=$(node --version)
  echo -e "${GREEN}✓ Node.js $version instalado${NC}"
}

install_docker() {
  echo -e "${YELLOW}🐳 Instalando Docker...${NC}"

  if command -v docker >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Docker já instalado${NC}"
    return
  fi

  case "$OS" in
    ubuntu|debian)
      apt-get update
      apt-get install -y ca-certificates curl gnupg lsb-release
      mkdir -p /etc/apt/keyrings
      curl -fsSL https://download.docker.com/linux/$OS/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
      echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$OS $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
      apt-get update
      apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
      ;;
    centos|rhel|fedora)
      yum install -y yum-utils
      yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
      yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
      systemctl start docker
      systemctl enable docker
      ;;
    *)
      echo -e "${RED}❌ Instalação automática do Docker não suportada em $OS${NC}"
      echo "Instale manualmente: https://docs.docker.com/engine/install/"
      return
      ;;
  esac

  echo -e "${GREEN}✓ Docker instalado${NC}"
}

install_pm2() {
  echo -e "${YELLOW}📦 Instalando PM2 (gerenciador de processos)...${NC}"
  if ! command -v pm2 >/dev/null 2>&1; then
    npm install -g pm2
    echo -e "${GREEN}✓ PM2 instalado${NC}"
  else
    echo -e "${GREEN}✓ PM2 já instalado${NC}"
  fi
}

setup_bot() {
  echo -e "${YELLOW}🤖 Configurando bot...${NC}"

  # Criar diretório
  BOT_DIR="/opt/warface-bot"
  if [ ! -d "$BOT_DIR" ]; then
    mkdir -p "$BOT_DIR"
  fi

  # Perguntar local de instalação
  read -p "Instalar em $BOT_DIR? [s/N]: " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    read -p "Diretório personalizado: " BOT_DIR
    mkdir -p "$BOT_DIR"
  fi

  # Clonar repositório
  if [ ! -f "$BOT_DIR/bot.js" ]; then
    echo "📥 Clonando repositório..."
    git clone https://github.com/stiflerwfl1-oss/Conquistas-Warface.git "$BOT_DIR" || {
      echo -e "${RED}❌ Falha ao clonar. Verifique se git está instalado.${NC}"
      exit 1
    }
  else
    echo "📁 Diretório já contém bot.js, pulando clone"
  fi

  cd "$BOT_DIR"

  # Instalar dependências
  echo "📦 Instalando dependências Node.js..."
  npm ci --only=production

  # Configurar .env
  if [ ! -f ".env" ]; then
    echo "⚙️  Configurando variáveis de ambiente..."
    cp .env.example .env
    echo ""
    echo -e "${YELLOW}⚠️  IMPORTANTE: Edite o arquivo .env e adicione o DISCORD_TOKEN${NC}"
    echo -e "   Caminho: ${BLUE}$BOT_DIR/.env${NC}"
  else
    echo "✅ .env já existe"
  fi

  # Criar diretório de logs
  mkdir -p logs

  echo -e "${GREEN}✓ Bot configurado em $BOT_DIR${NC}"
}

setup_systemd() {
  echo -e "${YELLOW}🔧 Configurando systemd...${NC}"

  sudo cp "$BOT_DIR/warface-bot.service" /etc/systemd/system/
  sudo systemctl daemon-reload
  sudo systemctl enable warface-bot

  echo -e "${GREEN}✓ Serviço systemd criado${NC}"
  echo "💡 Para iniciar: sudo systemctl start warface-bot"
  echo "💡 Para ver logs: sudo journalctl -u warface-bot -f"
}

setup_docker() {
  echo -e "${YELLOW}🐳 Configurando Docker...${NC}"

  cd "$BOT_DIR"

  # Build imagem
  echo "🏗️  Construindo imagem Docker..."
  docker build -t warface-bot:latest .

  # Parar container existente
  if docker ps -a --format '{{.Names}}' | grep -q "^warface-bot$"; then
    echo "🛑 Parando container existente..."
    docker stop warface-bot 2>/dev/null || true
    docker rm warface-bot 2>/dev/null || true
  fi

  # Iniciar novo container
  echo "▶️  Iniciando container..."
  docker run -d \
    --name warface-bot \
    --restart unless-stopped \
    -v "$BOT_DIR/logs:/app/logs" \
    --env-file "$BOT_DIR/.env" \
    warface-bot:latest

  echo -e "${GREEN}✓ Container Docker rodando${NC}"
  echo "💡 Logs: docker logs -f warface-bot"
}

show_info() {
  echo ""
  echo -e "${BLUE}═══════════════════════════════════════════${NC}"
  echo -e "${BLUE}   🤖 Warface Bot instalado com sucesso!${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════${NC}"
  echo ""
  echo "📂 Diretório: $BOT_DIR"
  echo "📄 Config:    $BOT_DIR/.env"
  echo "📋 Logs:      $BOT_DIR/logs/"
  echo ""
  echo "Próximos passos:"
  echo ""
  echo "1. Edite o .env com seu DISCORD_TOKEN:"
  echo -e "   ${YELLOW}nano $BOT_DIR/.env${NC}"
  echo ""
  echo "2. Reinicie o serviço:"
  if [ "$DEPLOY_METHOD" = "systemd" ]; then
    echo -e "   ${YELLOW}sudo systemctl start warface-bot${NC}"
  else
    echo -e "   ${YELLOW}docker restart warface-bot${NC}"
  fi
  echo ""
  echo "3. Verifique os logs:"
  if [ "$DEPLOY_METHOD" = "systemd" ]; then
    echo -e "   ${YELLOW}sudo journalctl -u warface-bot -f${NC}"
  else
    echo -e "   ${YELLOW}docker logs -f warface-bot${NC}"
  fi
  echo ""
  echo -e "${GREEN}Obrigado por usar o Warface Bot! 🎮${NC}"
}

# Main
main() {
  clear
  echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║   🤖 Warface Bot - Instalação Automática  ║${NC}"
  echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}"
  echo ""

  # Verificar se é root para algumas operações
  if [ "$(id -u)" -ne 0 ] && [ "$OS" != "alpine" ]; then
    echo -e "${YELLOW}⚠️  Alguns passos requerem sudo. Será solicitado quando necessário.${NC}"
    echo ""
  fi

  # Instalar Node.js se necessário
  if ! command -v node >/dev/null 2>&1; then
    install_nodejs
  else
    local node_ver=$(node --version | cut -d'v' -f2)
    echo -e "${GREEN}✓ Node.js $node_ver já instalado${NC}"
  fi

  # Menu de deploy
  echo "Escolha o método de deploy:"
  echo "1) Docker (recomendado, isolado)"
  echo "2) PM2 (cluster, fácil gerenciamento)"
  echo "3) Systemd (VPS tradicional)"
  echo "4) Apenas instalar (gerenciar manualmente)"
  echo ""
  read -p "Opção [1-4]: " DEPLOY_CHOICE

  case $DEPLOY_CHOICE in
    1)
      DEPLOY_METHOD="docker"
      install_docker
      setup_bot
      setup_docker
      ;;
    2)
      DEPLOY_METHOD="pm2"
      install_pm2
      setup_bot
      echo -e "${YELLOW}Execute: cd $BOT_DIR && pm2 start ecosystem.config.js${NC}"
      ;;
    3)
      DEPLOY_METHOD="systemd"
      setup_bot
      # Instalar node se não existir
      if ! command -v node >/dev/null 2>&1; then
        install_nodejs
      fi
      setup_systemd
      ;;
    4)
      DEPLOY_METHOD="manual"
      setup_bot
      echo -e "${GREEN}Bot instalado. Inicie manualmente: cd $BOT_DIR && npm start${NC}"
      ;;
    *)
      echo -e "${RED}Opção inválida${NC}"
      exit 1
      ;;
  esac

  show_info
}

# Executar
main
