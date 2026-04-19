#!/usr/bin/env node
/**
 * Pré-deploy Check — Validação completa antes do deploy
 * Verifica: sintaxe, dependências, configuração, segurança
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CHECKS = [];
let passed = 0;
let failed = 0;

function check(name, fn) {
  CHECKS.push({ name, fn });
}

function run() {
  console.log('🔍 Warface Bot — Pré-Deploy Check\n');
  console.log('='.repeat(50) + '\n');

  for (const { name, fn } of CHECKS) {
    try {
      fn();
      console.log(`✅ ${name}`);
      passed++;
    } catch (error) {
      console.log(`❌ ${name}`);
      console.log(`   ${error.message}\n`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`\n📊 Resultado: ${passed} OK, ${failed} falha(s)`);

  if (failed > 0) {
    console.log('\n🔧 Corrija os problemas acima antes do deploy.');
    process.exit(1);
  } else {
    console.log('\n🎉 Tudo OK! Pronto para deploy.');
    process.exit(0);
  }
}

// 1. Verificar arquivos essenciais
check('Arquivos essenciais existem', () => {
  const required = ['bot.js', 'package.json', 'Dockerfile', 'Procfile'];
  for (const file of required) {
    if (!fs.existsSync(file)) {
      throw new Error(`Arquivo faltando: ${file}`);
    }
  }
});

// 2. Validar package.json
check('package.json válido', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  if (!pkg.name || !pkg.dependencies || !pkg.dependencies['discord.js']) {
    throw new Error('package.json inválido ou sem discord.js');
  }
  if (!pkg.engines || !pkg.engines.node) {
    throw new Error('Campo "engines.node" ausente (Node >=16.9.0)');
  }
});

// 3. Verificar syntax do bot.js
check('Sintaxe do bot.js', () => {
  try {
    execSync('node --check bot.js', { stdio: 'pipe' });
  } catch {
    throw new Error('Erro de sintaxe em bot.js');
  }
});

// 4. Verificar .env.example
check('.env.example presente', () => {
  if (!fs.existsSync('.env.example')) {
    throw new Error('.env.example não encontrado');
  }
  const content = fs.readFileSync('.env.example', 'utf8');
  if (!content.includes('DISCORD_TOKEN')) {
    throw new Error('.env.example não contém DISCORD_TOKEN');
  }
});

// 5. Verificar Dockerfile
check('Dockerfile válido', () => {
  if (!fs.existsSync('Dockerfile')) {
    throw new Error('Dockerfile não encontrado');
  }
  const content = fs.readFileSync('Dockerfile', 'utf8');
  if (!content.includes('FROM node:')) {
    throw new Error('Dockerfile não usa base Node.js');
  }
  if (!content.includes('USER nodejs')) {
    throw new Error('Dockerfile não define usuário não-root');
  }
});

// 6. Verificar logged de erros no bot.js
check('Listeners de erro configurados', () => {
  const content = fs.readFileSync('bot.js', 'utf8');
  const required = ['error', 'shardError', 'warn'];
  for (const event of required) {
    if (!content.includes(`client.on('${event}'`)) {
      throw new Error(`Falta listener para evento: ${event}`);
    }
  }
});

// 7. Verificar evento ready correto
check('Evento ready (não clientReady)', () => {
  const content = fs.readFileSync('bot.js', 'utf8');
  if (content.includes("'clientReady'")) {
    throw new Error('Usando evento clientReady (depreciado)');
  }
  if (!content.includes("client.once('ready'") && !content.includes("client.on('ready'")) {
    throw new Error('Evento ready não encontrado');
  }
});

// 8. Verificar .gitignore (não ignore arquivos de deploy)
check('.gitignore não ignora arquivos de deploy', () => {
  const gitignore = fs.readFileSync('.gitignore', 'utf8');
  const shouldBeCommited = [
    'Dockerfile',
    'Procfile',
    'docker-compose.yml',
    'ecosystem.config.js',
    'warface-bot.service',
    'package.json',
    'bot.js',
    '.github/'
  ];
  for (const file of shouldBeCommited) {
    // Verifica se há linha que ignora (não começa com #)
    const pattern = new RegExp(`^${file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm');
    const ignored = gitignore.split('\n').some(line => line.trim() === file || line.startsWith(file));
    if (ignored) {
      throw new Error(`${file} está sendo ignorado no .gitignore (deve ser commitado)`);
    }
  }
});

// 9. Verificar tamanho do bot.js (não deve estar vazio)
check('bot.js não vazio', () => {
  const stat = fs.statSync('bot.js');
  if (stat.size < 100) {
    throw new Error('bot.js muito pequeno, possivelmente corrompido');
  }
});

// 10. Verificar scripts no package.json
check('Scripts do package.json', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  if (!pkg.scripts || !pkg.scripts.start) {
    throw new Error('Campo "scripts.start" ausente no package.json');
  }
});

// 11. Verificar existência de data.js (fallback local)
check('data.js presente (fallback local)', () => {
  if (!fs.existsSync('data.js')) {
    throw new Error('data.js não encontrado (fonte local de fallback)');
  }
  const stat = fs.statSync('data.js');
  if (stat.size < 1000) {
    throw new Error('data.js muito pequeno');
  }
});

// 12. Verificar warbanner-filter-core.js
check('warbanner-filter-core.js presente', () => {
  if (!fs.existsSync('warbanner-filter-core.js')) {
    throw new Error('warbanner-filter-core.js não encontrado');
  }
});

// 13. Verificar saúde dos arquivos JSON/JS (parseable)
check('Arquivos JavaScript executáveis', () => {
  try {
    // Tenta carregar warbanner-filter-core como módulo
    const core = require('./warbanner-filter-core');
    if (typeof core.filterItems !== 'function') {
      throw new Error('filterItems não é função');
    }
  } catch (e) {
    throw new Error(`warbanner-filter-core inválido: ${e.message}`);
  }
});

// 14. Verificar permissões do Dockerfile
check('Dockerfile: USER não-root', () => {
  const content = fs.readFileSync('Dockerfile', 'utf8');
  if (!content.includes('USER nodejs') && !content.includes('USER nonroot')) {
    throw new Error('Dockerfile deve usar USER não-root');
  }
});

// 15. Verificar HEALTHCHECK no Dockerfile (se usar Docker)
check('Dockerfile: HEALTHCHECK definido', () => {
  const content = fs.readFileSync('Dockerfile', 'utf8');
  if (!content.includes('HEALTHCHECK')) {
    throw new Error('Dockerfile deve conter HEALTHCHECK');
  }
});

// 16. Verificar README.md
check('README.md presente', () => {
  if (!fs.existsSync('README.md')) {
    throw new Error('README.md não encontrado');
  }
});

// 17. Verificar Procfile (Heroku/Railway)
check('Procfile válido', () => {
  if (!fs.existsSync('Procfile')) {
    throw new Error('Procfile não encontrado');
  }
  const content = fs.readFileSync('Procfile', 'utf8');
  if (!content.includes('web:') && !content.includes('worker:')) {
    throw new Error('Procfile deve conter processo web ou worker');
  }
});

// 18. Verificar que não há código console.log em produção sensível (opcional)
check('Sem vazamento de token em logs (análise básica)', () => {
  const content = fs.readFileSync('bot.js', 'utf8');
  // Permitir console.log, mas não que inclua process.env.DISCORD_TOKEN diretamente
  if (content.includes('console.log(process.env.DISCORD_TOKEN)') ||
      content.includes('console.error(process.env.DISCORD_TOKEN)')) {
    throw new Error('Token pode ser logado acidentalmente');
  }
});

// Executar todos
run();
