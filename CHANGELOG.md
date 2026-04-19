# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere a [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [Em desenvolvimento] - 2026-04-19

### 🎉 Adicionado
- Sistema completo de containerização com Docker
- Multi-stage Dockerfile otimizado (node:18-alpine)
- Healthcheck endpoint na porta 3000
- GitHub Actions CI/CD (`.github/workflows/deploy.yml`)
- Deploy automático para Railway e Render
- `docker-compose.yml` para orquestração local
- `entrypoint.sh` para gerenciamento de processo em produção
- `monitor.js` para auto-restart e logs estruturados
- `ecosystem.config.js` para PM2
- `warface-bot.service` para systemd (VPS)
- `backup.sh` para backup de configuração e logs
- `SETUP.md` – guia detalhado de configuração
- `README.md` – documentação completa

### 🔧 Corrigido
- Evento `clientReady` → `ready` (discord.js v14)
- Validação de URL remota (detecta raw.githubusercontent.com)
- Logs de metadata com warnings explícitos
- Tratamento de erro Missing Permissions (código 50013)
- Mensagem de erro do `DISCORD_TOKEN` mais clara

### 🔐 Segurança
- Dockerfile: usuário não-root (`nodejs`)
- `.dockerignore` completo para evitar vazamento de secrets
- `HEALTHCHECK` para verificar integridade do container
- `restart: unless-stopped` policy
- Logging com rotação (max-size 10M, max-file 3)

### 📦 Dependências
- Adicionado `engines.node >=16.9.0` no `package.json`

---

## [1.0.0] - 2025-04-?? (Original)

### 🎉 Adicionado
- Bot Discord funcional com busca de conquistas Warface
- Integração com warbanner-filter-core.js
- Suporte a dados locais e remotos (GitHub)
- Cache de imagens com TTL de 1 hora
- Filtros por tipo (marca, insignia, fita) e cor
- Atualização automática de dados a cada 10 min

---

## Convenções do Changelog

- **Adicionado** para novas funcionalidades
- **Corrigido** para correções de bugs
- **Alterado** para mudanças em funcionalidades existentes
- **Removido** para funcionalidades removidas
- **Segurança** para vulnerabilidades
