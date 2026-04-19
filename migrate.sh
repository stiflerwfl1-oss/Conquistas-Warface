#!/bin/bash
# Migração de instalações antigas do bot para nova estrutura
# Converte .env antigo, atualiza arquivos, preserva logs

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔄 Migrando Warface Bot para nova versão...${NC}"

# 1. Backup da instalação atual
echo ""
echo -e "${YELLOW}1/5 Criando backup...${NC}"
if [ -f ".env" ]; then
  cp .env ".env.backup.$(date +%Y%m%d_%H%M%S)"
  echo "  ✓ .env backup criado"
fi

if [ -d "logs" ] && [ "$(ls -A logs)" ]; then
  mkdir -p backups
  tar -czf "backups/logs-backup-$(date +%Y%m%d_%H%M%S).tar.gz" logs/ 2>/dev/null || true
  echo "  ✓ logs backup criado"
fi

# 2. Atualizar arquivos de código
echo ""
echo -e "${YELLOW}2/5 Atualizando arquivos do sistema...${NC}"

# Se há git, fazer pull
if [ -d ".git" ]; then
  echo "  📥 git pull origin main..."
  git pull origin main 2>/dev/null || git pull origin master || true
fi

# 3. Atualizar dependências
echo ""
echo -e "${YELLOW}3/5 Atualizando dependências...${NC}"
if [ -f "package-lock.json" ]; then
  npm ci --only=production
else
  npm install --only=production
fi
echo "  ✓ Dependências atualizadas"

# 4. Migrar configuração .env se for antiga
echo ""
echo -e "${YELLOW}4/5 Verificando configuração...${NC}"

# Se .env não existe, criar do exemplo
if [ ! -f ".env" ]; then
  cp .env.example .env
  echo "  ✓ .env criado a partir do exemplo"
else
  # Verificar se tem as novas variáveis
  if ! grep -q "DATA_REFRESH_MINUTES" .env 2>/dev/null; then
    echo "" >> .env
    echo "# Adicionado automaticamente na migração" >> .env
    echo "DATA_REFRESH_MINUTES=10" >> .env
    echo "  ✓ DATA_REFRESH_MINUTES adicionado"
  fi

  if ! grep -q "GITHUB_DATA_URL" .env 2>/dev/null; then
    echo "" >> .env
    echo "# Adicionado automaticamente na migração" >> .env
    echo "# GITHUB_DATA_URL=https://raw.githubusercontent.com/USER/REPO/main/data.js" >> .env
    echo "  ✓ GITHUB_DATA_URL adicionado (comentado)"
  fi
fi

# 5. Reiniciar serviços
echo ""
echo -e "${YELLOW}5/5 Reiniciando serviços...${NC}"

RESTARTED=0

if command -v pm2 >/dev/null 2>&1 && pm2 list | grep -q "warface-bot"; then
  echo "  📊 Reiniciando PM2..."
  pm2 reload warface-bot || pm2 restart warface-bot
  RESTARTED=1
fi

if docker ps --format '{{.Names}}' | grep -q "^warface-bot$"; then
  echo "  🐳 Reiniciando Docker..."
  docker restart warface-bot
  RESTARTED=1
fi

if systemctl is-active --quiet warface-bot 2>/dev/null; then
  echo "  🔧 Reiniciando systemd..."
  sudo systemctl restart warface-bot
  RESTARTED=1
fi

if [ $RESTARTED -eq 0 ]; then
  echo -e "  ${YELLOW}⚠️  Nenhum serviço ativo encontrado.${NC}"
  echo "  Inicie manualmente: npm start"
fi

echo ""
echo -e "${GREEN}✅ Migração concluída!${NC}"
echo ""
echo "Próximos passos:"
echo "1. Verifique .env está com DISCORD_TOKEN correto"
echo "2. Confirme Message Content Intent ativada no Discord Portal"
echo "3. Verifique logs para erros"
echo ""
echo "Ajuda:"
echo "  Docker:    docker logs -f warface-bot"
echo "  PM2:       pm2 logs warface-bot"
echo "  Systemd:   sudo journalctl -u warface-bot -f"
