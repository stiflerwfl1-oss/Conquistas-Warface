#!/bin/bash
# Backup e restore do bot Warface
# Faz backup de configuração e logs

set -e

BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backup_${DATE}.tar.gz"

show_help() {
  echo "Uso: ./backup.sh [comando]"
  echo ""
  echo "Comandos:"
  echo "  create     - cria um novo backup"
  echo "  list       - lista backups existentes"
  echo "  restore    - restaura backup (especificar arquivo)"
  echo "  clean      - remove backups antigos (mais de 30 dias)"
  echo ""
  echo "Exemplos:"
  echo "  ./backup.sh create"
  echo "  ./backup.sh list"
  echo "  ./backup.sh restore backup_20250419_103000.tar.gz"
}

create_backup() {
  echo "📦 Criando backup..."

  if [ ! -d "$BACKUP_DIR" ]; then
    mkdir -p "$BACKUP_DIR"
  fi

  # Arquivos a incluir
  FILES=""
  [ -f ".env" ] && FILES="$FILES .env"
  [ -d "logs" ] && FILES="$FILES logs/"
  [ -d "image-cache" ] && FILES="$FILES image-cache/"

  if [ -z "$FILES" ]; then
    echo "⚠️  Nenhum arquivo para backup (crie .env e execute o bot para gerar logs)"
    return 0
  fi

  tar -czf "${BACKUP_DIR}/${BACKUP_FILE}" $FILES 2>/dev/null || true

  echo "✅ Backup criado: ${BACKUP_DIR}/${BACKUP_FILE}"
  du -h "${BACKUP_DIR}/${BACKUP_FILE}"
}

list_backups() {
  echo "📋 Backups disponíveis:"
  if [ ! -d "$BACKUP_DIR" ]; then
    echo "  (nenhum backup encontrado)"
    return 0
  fi
  ls -lh "$BACKUP_DIR"/*.tar.gz 2>/dev/null || echo "  (nenhum backup encontrado)"
}

restore_backup() {
  if [ -z "$1" ]; then
    echo "❌ Especifique o arquivo de backup"
    show_help
    exit 1
  fi

  local backup_file="$1"

  if [ ! -f "$backup_file" ] && [ ! -f "${BACKUP_DIR}/$backup_file" ]; then
    echo "❌ Backup não encontrado: $backup_file"
    exit 1
  fi

  # Se for apenas o nome, buscar na pasta backups
  if [ ! -f "$backup_file" ]; then
    backup_file="${BACKUP_DIR}/$backup_file"
  fi

  echo "🔙 Restaurando backup: $backup_file"

  # Parar bot antes de restaurar (se estiver rodando)
  if pgrep -f "node.*bot.js" > /dev/null; then
    echo "🛑 Parando bot..."
    pkill -f "node.*bot.js" || true
    sleep 2
  fi

  # Extrair
  tar -xzf "$backup_file"

  echo "✅ Backup restaurado!"
  echo "💡 Inicie o bot novamente: npm start"
}

clean_backups() {
  echo "🧹 Limpando backups antigos (> 30 dias)..."
  if [ -d "$BACKUP_DIR" ]; then
    find "$BACKUP_DIR" -name "*.tar.gz" -type f -mtime +30 -delete
    echo "✅ Backups antigos removidos"
  else
    echo "ℹ️  Nenhum backup para limpar"
  fi
}

# Main
case "$1" in
  create)
    create_backup
    ;;
  list)
    list_backups
    ;;
  restore)
    restore_backup "$2"
    ;;
  clean)
    clean_backups
    ;;
  *)
    show_help
    exit 1
    ;;
esac
