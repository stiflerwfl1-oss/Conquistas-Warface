# Política de Segurança

## 🔐 Reportando Vulnerabilidades

Agradecemos aos pesquisadores de segurança que ajudam a manter este projeto seguro. Por favor, reporte vulnerabilidades de forma responsável.

### 📧 Contato
- **Email**: (não disponível, abra issue privada no GitHub)
- **GitHub Private Vulnerability Reporting**: [Security Advisory](https://github.com/stiflerwfl1-oss/Conquistas-Warface/security/advisories)

### 🎯 Escopo
- Código fonte do bot (bot.js, warbanner-filter-core.js)
- Infraestrutura de deploy (Docker, CI/CD)
- Integração com API do Discord
- Manipulação de dados de usuários

### 🚫 Fora do Escopo
- Dados de conquistas do Warface (são públicos)
- Servidores externos (warbanner.com.br)
- Issues de rate limiting ou disponibilidade de API externas

## 🛡️ Práticas de Segurança Implementadas

### 1. Segregação de Segredos
- **Nenhum token hardcoded**: Todos os tokens estão em variáveis de ambiente
- **.env no .gitignore**: Arquivo de configuração local nunca é commitado
- **Suporte a secrets de plataforma**: Heroku/Railway/Render usam variáveis seguras

### 2. Containerização
- **Usuário não-root**: Rodando como `nodejs` (UID 1001)
- **Imagem mínima**: baseada em `node:18-alpine` (~120MB)
- **Multi-stage**: Não incluso, mas poderia ser para build de dependências nativas
- ** scanned CVE**: Recomenda-se `docker scan` antes de deploy

### 3.Execução de Código
- **Isolamento com vm**: Dados externos (data.js) são executados em contexto VM isolado
- **Validação de URL**: Apenas URLs do GitHub/raw são aceitas
- **Fallback para local**: Se dado remoto falhar, usa data.js local (confiável)

### 4. Rate Limiting e DoS
- **Cache de imagem**: TTL 1h para evitar requisições repetidas
- **Timeout de request**: 10s para dados remotos
- **Debounce de mensagens**: Busca é síncrona mas rápida (<100ms)
- **Máximo de resultados**: 10 para evitar payloads grandes

### 5. Logs e Monitoramento
- **Sem dados sensíveis**: Logs não incluem tokens ou mensagens de canal completas
- **Logs estruturados**: Prefixos `[discord]`, `[data]`, `[metadata]`
- **Rotação de logs**: docker-compose limita a 10MB por arquivo

### 6. Permissões no Discord
- **Intents mínimas**: Apenas Guilds, GuildMessages, MessageContent
- **Sem permissões de admin**: Bot não precisa de permissões administrativas
- **Canal whitelist**: Suporte a `DISCORD_ALLOWED_CHANNEL_IDS`

## 📋 Checklist de Segurança para Deploy

- [ ] `DISCORD_TOKEN` configurado como variável de ambiente (não no .env no repo)
- [ ] Message Content Intent ativada no Discord Portal
- [ ] Bot convidado com permissões mínimas (Send Messages, Embed Links)
- [ ] Docker rodando como usuário não-root
- [ ] Healthcheck ativo (monitora processo)
- [ ] Logs direcionados para stdout (não arquivos persistentes sensíveis)
- [ ] Backup de .env feito com segurança (não no repositório)
- [ ] Rate limits do GitHub respeitados (DATA_REFRESH_MINUTES >= 10)

## 🔄 Atualizações de Segurança

- **discord.js**: Atualizar para última versão estável
- **Node.js**: Manter >= 16.9.0 (LTS recomendado)
- **Dependências**: `npm audit` regularmente
- **Alpine**: `apk update && apk upgrade` na imagem base

## 🐛 Issues de Segurança Conhecidas

### Nenhuma conhecida no momento.

Se encontrar, por favor reporte via **Security Advisory** no GitHub.

## 📚 Recursos
- [Discord.js Security](https://discord.js.org/#/docs/main/stable/guide/security)
- [Docker Security Best Practices](https://docs.docker.com/develop/security-best-practices/)
- [Node.js Security](https://nodejs.org/en/docs/guides/security/)

---

**Última atualização**: 2026-04-19
