#!/usr/bin/env node
/**
 * Monitor & Auto-restart para Warface Bot
 * Monitora o processo principal e reinicia se falhar
 * Envia logs para arquivo e stdout
 *
 * Uso: node monitor.js
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const BOT_SCRIPT = path.join(__dirname, 'bot.js');
const LOG_DIR = path.join(__dirname, 'logs');
const RESTART_DELAY_MS = 5000; // 5 segundos entre reinícios
const MAX_RESTARTS_PER_MINUTE = 10;

let restartCount = 0;
let restartTimestamps = [];
let botProcess = null;

// Garantir diretório de logs
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const timestamp = () => new Date().toISOString();

function log(level, message) {
  const full = `[${timestamp()}] [${level}] ${message}`;
  console.log(full);
  // Opcional: escrever em arquivo
  // fs.appendFileSync(path.join(LOG_DIR, 'monitor.log'), full + '\n');
}

function shouldRestart() {
  const now = Date.now();
  // Remover timestamps antigos (> 1 minuto)
  restartTimestamps = restartTimestamps.filter(t => now - t < 60000);
  if (restartTimestamps.length >= MAX_RESTARTS_PER_MINUTE) {
    log('ERROR', `Muitos reinícios (${MAX_RESTARTS_PER_MINUTE}/min). Parando para evitar loop.`);
    return false;
  }
  return true;
}

function startBot() {
  if (botProcess && !botProcess.killed) {
    log('WARN', 'Processo bot ainda está rodando, matando...');
    botProcess.kill('SIGTERM');
  }

  log('INFO', '🚀 Iniciando warface-bot...');
  restartCount++;
  restartTimestamps.push(Date.now());

  botProcess = spawn('node', [BOT_SCRIPT], {
    cwd: __dirname,
    env: { ...process.env, NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  // Logs do bot
  botProcess.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean);
    lines.forEach(line => log('BOT', line));
  });

  botProcess.stderr.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean);
    lines.forEach(line => log('BOT-ERR', line));
  });

  botProcess.on('exit', (code, signal) => {
    log('WARN', `Bot encerrou (code=${code}, signal=${signal})`);
    botProcess = null;

    if (shouldRestart()) {
      log('INFO', `🕐 Reiniciando em ${RESTART_DELAY_MS/1000}s...`);
      setTimeout(startBot, RESTART_DELAY_MS);
    }
  });

  botProcess.on('error', (err) => {
    log('ERROR', `Falha ao iniciar bot: ${err.message}`);
    botProcess = null;
  });
}

function stop() {
  log('INFO', '🛑 Parando monitor...');
  if (botProcess && !botProcess.killed) {
    botProcess.kill('SIGTERM');
    setTimeout(() => {
      if (!botProcess.killed) {
        log('WARN', 'Forçando encerramento (SIGKILL)...');
        botProcess.kill('SIGKILL');
      }
    }, 5000);
  }
  process.exit(0);
}

// Tratar sinais
process.on('SIGINT', stop);   // Ctrl+C
process.on('SIGTERM', stop);  // Docker stop
process.on('SIGHUP', stop);   // Terminal close

// Iniciar
log('INFO', '🔍 Warface Bot Monitor inicializado');
log('INFO', `📂 Diretório: ${__dirname}`);
log('INFO', `📄 Script: ${BOT_SCRIPT}`);

// Verificar se bot.js existe
if (!fs.existsSync(BOT_SCRIPT)) {
  log('ERROR', `bot.js não encontrado em ${BOT_SCRIPT}`);
  process.exit(1);
}

// Iniciar bot
startBot();
