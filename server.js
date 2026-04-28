const express = require('express');
const path = require('path');
const { startBot } = require('./bot');

const app = express();
const PORT = Number(process.env.PORT || 3000);

let botReady = false;
let botStartError = null;

app.get('/health', (_req, res) => {
  const status = botReady ? 200 : 503;
  res.status(status).json({
    ok: botReady,
    botReady,
    error: botStartError ? botStartError.message : null,
  });
});

app.use(express.static(path.join(__dirname)));

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Site rodando na porta ${PORT}`);
});

startBot({ startHealthServer: false })
  .then(() => {
    botReady = true;
    console.log('[bot] Inicializado pelo server.js');
  })
  .catch((error) => {
    botStartError = error;
    console.error('[bot] Falha ao iniciar pelo server.js:', error);
    process.exit(1);
  });
