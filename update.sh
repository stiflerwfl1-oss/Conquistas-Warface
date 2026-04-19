#!/bin/bash
# Atualizar bot para última versão
# Usa git pull e reinstala dependências

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔄 Atualizando Warface Bot...${NC}"

# Verificar se é um repositório git
if [ ! -d ".git" ]; then
  echo -e "${RED}❌ Não é um repositório git. Clone o repositório primeiro.${NC}"
  exit 1
fi

# Verificar se há mudanças não commitadas
if [ -n "$(git status --porcelain)" ]; then
  echo -e "${YELLOW}⚠️  Há mudanças locais não commitadas.${NC}"
  read -p "Deseja continuar e sobrescrever? (s/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo "Abortando."
    exit 1
  fi
  # Fazer backup das mudanças
  echo "💾 Fazendo backup das mudanças locais..."
  git stash push -m "backup-$(date +%s)"
fi

# Pull
echo "📥 Baixando atualizações..."
git pull origin main || git pull origin master

# Instalar/atualizar dependências
echo "📦 Atualizando dependências..."
if [ -f "package-lock.json" ]; then
  npm ci --only=production
else
  npm install --only=production
fi

# Reiniciar serviços se estiver rodando
if command -v pm2 >/dev/null 2>&1; then
  echo "🔄 Reiniciando PM2..."
  pm2 reload warface-bot || pm2 start ecosystem.config.js --env production
  pm2 save
fi

if docker ps --format '{{.Names}}' | grep -q "^warface-bot$"; then
  echo "🐳 Reiniciando container Docker..."
  docker restart warface-bot
fi

if systemctl is-active --quiet warface-bot 2>/dev/null; then
  echo "🔧 Reiniciando serviço systemd..."
  sudo systemctl restart warface-bot
fi

echo -e "${GREEN}✅ Bot atualizado com sucesso!${NC}"
echo ""
echo "Logs:"
if docker ps --format '{{.Names}}' | grep -q "^warface-bot$"; then
  echo "  Docker: docker logs -f warface-bot"
fi
if command -v pm2 >/dev/null 2>&1 && pm2 list | grep -q "warface-bot"; then
  echo "  PM2:    pm2 logs warface-bot"
fi
