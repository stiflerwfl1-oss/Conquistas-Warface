# Multi-stage build para otimização
FROM node:18-alpine AS base

# Metadata
LABEL maintainer="Warface Bot Team"
LABEL description="Bot Discord para conquistas do Warface"
LABEL org.opencontainers.image.source="https://github.com/stiflerwfl1-oss/Conquistas-Warface"
LABEL org.opencontainers.image.version="1.0.0"

# Diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências primeiro (para cache de camadas)
COPY package*.json ./

# Instalar apenas dependências de produção
RUN npm ci --only=production && \
    npm cache clean --force && \
    # Limpar cache npm
    rm -rf ~/.npm

# Criar usuário não-root para segurança
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Alterar ownership para nodejs
RUN chown -R nodejs:nodejs /app
USER nodejs

# Copiar arquivos da aplicação
COPY --chown=nodejs:nodejs . .

# Criar diretório para logs
RUN mkdir -p logs && chmod 755 logs

# Healthcheck: verifica se processo Node.js está rodando
# Usa pgrep (disponível no busybox do alpine)
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD pgrep -f "node.*bot.js" > /dev/null || exit 1

# Comando de inicialização
CMD ["node", "bot.js"]
