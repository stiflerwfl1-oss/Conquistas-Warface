.PHONY: help test build run clean deploy logs backup restore

help: ## Show this help
	@echo "🤖 Warface Bot - Comandos disponíveis:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

install: ## Instalar dependências
	@echo "📦 Instalando dependências..."
	npm ci --only=production
	@echo "✅ Pronto!"

dev: ## Executar em modo desenvolvimento (com hot-reload se disponível)
	@echo "🚀 Iniciando bot (dev)..."
	npm start

test: ## Testar sintaxe e dependências
	@echo "🧪 Testando sintaxe..."
	@node --check bot.js && echo "✓ bot.js OK"
	@node -e "require('./package.json')" && echo "✓ package.json OK"
	@echo "✅ Todos os testes passaram"

build: ## Construir imagem Docker
	@echo "🐳 Construindo imagem Docker..."
	docker build -t warface-bot:latest .
	@echo "✅ Imagem construída"

run: ## Executar com Docker (local)
	@echo "🏃 Executando container..."
	docker run --rm -d \
		--name warface-bot \
		--restart unless-stopped \
		-v $$(pwd)/logs:/app/logs \
		--env-file .env \
		warface-bot:latest
	@echo "✅ Container rodando"
	@docker logs -f warface-bot

stop: ## Parar container Docker
	@echo "🛑 Parando container..."
	-docker stop warface-bot 2>/dev/null || true
	-docker rm warface-bot 2>/dev/null || true
	@echo "✅ Parado"

logs: ## Mostrar logs do bot (Docker)
	@if docker ps --format '{{.Names}}' | grep -q "^warface-bot$$"; then \
		docker logs -f warface-bot; \
	else \
		echo "Container não está rodando. Use 'make run' para iniciar."; \
	fi

logs-pm2: ## Mostrar logs do PM2
	@if command -v pm2 >/dev/null 2>&1; then \
		pm2 logs warface-bot; \
	else \
		echo "PM2 não instalado."; \
	fi

deploy-docker: build run ## Deploy completo com Docker (build + run)

backup: ## Criar backup de configuração e logs
	@./backup.sh create

restore: ## Listar backups disponíveis
	@./backup.sh list

restore-file: ## Restaurar backup (use: make restore-file FILE=backup_20250419.tar.gz)
	@if [ -z "$(FILE)" ]; then echo "❌ Especifique FILE=..."; exit 1; fi
	@./backup.sh restore $(FILE)

clean: ## Limpar arquivos temporários
	@echo "🧹 Limpando..."
	-rm -rf node_modules
	-rm -f package-lock.json
	-rm -rf logs/*
	-rm -rf image-cache/*
	-docker rmi warface-bot:latest 2>/dev/null || true
	@echo "✅ Limpo"

clean-docker: ## Limpar containers e imagens Docker
	@echo "🐳 Limpando Docker..."
	-docker stop warface-bot 2>/dev/null || true
	-docker rm warface-bot 2>/dev/null || true
	-docker rmi warface-bot:latest 2>/dev/null || true
	@echo "✅ Docker limpo"

push: ## Push imagem para registry (requer estar logado)
	@echo "📤 Push para ghcr.io..."
	docker tag warface-bot:latest ghcr.io/$$(echo $(GITHUB_REPOSITORY) | tr '[:upper:]' '[:lower:]'):latest
	docker push ghcr.io/$$(echo $(GITHUB_REPOSITORY) | tr '[:upper:]' '[:lower:]'):latest
	@echo "✅ Push concluído"

status: ## Mostrar status de todos os métodos de execução
	@echo "📊 Status:"
	@echo ""
	@echo "🐳 Docker:"
	@if docker ps --format '{{.Names}}' | grep -q "^warface-bot$$"; then \
		docker ps --filter "name=warface-bot" --format "  {{.Status}}\t{{.Names}}"; \
	else \
		echo "  (não rodando)"; \
	fi
	@echo ""
	@echo "📊 PM2:"
	@if command -v pm2 >/dev/null 2>&1 && pm2 list | grep -q "warface-bot"; then \
		pm2 list | grep "warface-bot" | awk '{print "  "$4" "$5" "$9}'; \
	else \
		echo "  (não rodando)"; \
	fi
	@echo ""
	@echo "🔧 Systemd:"
	@if systemctl is-active --quiet warface-bot 2>/dev/null; then \
		systemctl status warface-bot --no-pager -l | head -5 | tail -1 | awk '{print "  "$3}'; \
	else \
		echo "  (não rodando)"; \
	fi

# Help é o target default
.DEFAULT_GOAL := help
