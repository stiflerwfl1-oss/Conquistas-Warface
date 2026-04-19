const fs = require('fs');
const http = require('http');
const path = require('path');
const vm = require('vm');
const https = require('https');
const { Client, Events, GatewayIntentBits, SlashCommandBuilder } = require('discord.js');
const filterCore = require('./warbanner-filter-core');

const DATA_FILE = path.join(__dirname, 'data.js');
const METADATA_FILE = path.join(__dirname, 'warbanner-metadata.js');
const ENV_FILE = path.join(__dirname, '.env');
const WARBANNER_BASE_URL = 'https://warbanner.com.br';
const DEFAULT_GITHUB_OWNER = 'stiflerwfl1-oss';
const DEFAULT_GITHUB_REPO = 'Conquistas-Warface';
const SEARCH_COMMAND_NAME = 'conquista';
const PORT = Number(process.env.PORT || 3000);

loadEnvFile();

const REFRESH_MINUTES = Number(process.env.DATA_REFRESH_MINUTES || 10);
const DISCORD_ALLOWED_CHANNEL_IDS = String(process.env.DISCORD_ALLOWED_CHANNEL_IDS || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);
const GITHUB_DATA_URL = resolveGithubDataUrl();

let achievementsData = [];
let lastDataSource = 'none';
const warbannerMetadata = loadMetadataMap();
const imageReachabilityCache = new Map();

function loadEnvFile() {
  if (!fs.existsSync(ENV_FILE)) return;

  const lines = fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (key) {
      process.env[key] = value;
    }
  }
}

function buildGithubRawUrl() {
  const owner = process.env.GITHUB_OWNER || DEFAULT_GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO || DEFAULT_GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || 'main';
  const dataPath = process.env.GITHUB_DATA_PATH || 'data.js';

  if (!owner || !repo) return '';
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${dataPath}`;
}

function startHealthServer() {
  const server = http.createServer((request, response) => {
    if (request.url === '/health') {
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(
        JSON.stringify({
          ok: true,
          source: lastDataSource,
          loadedItems: achievementsData.length,
        })
      );
      return;
    }

    response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Conquistas Warface bot online');
  });

  server.listen(PORT, () => {
    console.log(`[web] Healthcheck ouvindo na porta ${PORT}`);
  });

  return server;
}

function resolveGithubDataUrl() {
  const configuredUrl = String(process.env.GITHUB_DATA_URL || '').trim();
  if (!configuredUrl) return buildGithubRawUrl();

  // Se for URL raw do GitHub, usar diretamente
  if (configuredUrl.includes('raw.githubusercontent.com')) {
    return configuredUrl;
  }

  // Se for URL do GitHub (repo ou blob), normalizar para raw
  const repoMatch = configuredUrl.match(/^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/?$/i);
  if (repoMatch) {
    const owner = repoMatch[1];
    const repo = repoMatch[2];
    const branch = process.env.GITHUB_BRANCH || 'main';
    const dataPath = process.env.GITHUB_DATA_PATH || 'data.js';
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${dataPath}`;
  }

  const blobMatch = configuredUrl.match(
    /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/blob\/([^\/]+)\/(.+)$/i
  );
  if (blobMatch) {
    const owner = blobMatch[1];
    const repo = blobMatch[2];
    const branch = blobMatch[3];
    const blobPath = blobMatch[4];
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${blobPath}`;
  }

  console.warn('[config] GITHUB_DATA_URL não é uma URL raw válida nem URL do GitHub, ignorando.');
  return buildGithubRawUrl();
}

function loadMetadataMap() {
  if (!fs.existsSync(METADATA_FILE)) {
    console.warn('[metadata] Arquivo de metadados não encontrado.');
    return {};
  }

  try {
    const source = fs.readFileSync(METADATA_FILE, 'utf8');
    const context = { window: {} };
    vm.createContext(context);
    vm.runInContext(source, context);
    const map = context.window?.warbannerMetadata || context.warbannerMetadata || {};
    const result = map && typeof map === 'object' ? map : {};
    if (Object.keys(result).length === 0) {
      console.warn('[metadata] Metadados vazios ou malformados.');
    }
    return result;
  } catch (error) {
    console.error(`[metadata] Falha ao carregar metadados: ${error.message}`);
    return {};
  }
}

function normalizeSearchQuery(value) {
  return filterCore.normalizeComparableText(value)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isAllowedChannel(channelId) {
  if (DISCORD_ALLOWED_CHANNEL_IDS.length === 0) return true;
  return DISCORD_ALLOWED_CHANNEL_IDS.includes(channelId);
}

function parseAchievementsFromSource(sourceCode, sourceName) {
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${sourceCode}\nthis.__achievementsData = achievementsData;`, context);

  if (!Array.isArray(context.__achievementsData)) {
    throw new Error(`Falha ao carregar achievementsData de ${sourceName}`);
  }

  return context.__achievementsData;
}

function readLocalData() {
  const source = fs.readFileSync(DATA_FILE, 'utf8');
  return parseAchievementsFromSource(source, 'data.js local');
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 10000 }, (response) => {
      if (
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        response.resume();
        fetchText(response.headers.location).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`HTTP ${response.statusCode} ao baixar ${url}`));
        return;
      }

      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => resolve(body));
    });

    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

async function reloadData() {
  if (GITHUB_DATA_URL) {
    try {
      const remoteSource = await fetchText(GITHUB_DATA_URL);
      achievementsData = parseAchievementsFromSource(remoteSource, 'GitHub');
      lastDataSource = `github:${GITHUB_DATA_URL}`;
      console.log(`[data] ${achievementsData.length} desafios carregados de ${lastDataSource}`);
      return;
    } catch (error) {
      console.warn(`[data] Falha no GitHub (${error.message}). Usando arquivo local.`);
    }
  }

  achievementsData = readLocalData();
  lastDataSource = 'local:data.js';
  console.log(`[data] ${achievementsData.length} desafios carregados de ${lastDataSource}`);
}

function getTypeLabel(type) {
  const canonicalType = filterCore.getCanonicalType(type);
  if (canonicalType === 'marca') return 'Marca';
  if (canonicalType === 'insignia') return 'Insignia';
  if (canonicalType === 'fita') return 'Fita';
  return 'Conquista';
}

function formatChallengeLine(item) {
  const typeLabel = getTypeLabel(item.type);
  const isGold = filterCore.is999EliminationsChallenge(item) || Boolean(item.isGold);
  const goldPrefix = isGold ? '[GOLD] ' : '';
  return `${goldPrefix}**${item.name}** (${typeLabel})\n${item.description || 'Sem descricao.'}`;
}

function buildSearchPayload(query, results, resolved) {
  const topResults = results.slice(0, 10).map(formatChallengeLine).join('\n\n');
  const hasMore = results.length > 10 ? `\n\n... e mais ${results.length - 10} resultado(s).` : '';
  const topItem = resolved.item;
  const topType = getTypeLabel(topItem.type);

  const payload = {
    content: `[BUSCA] **Resultados para:** "${query}"\n\n${topResults}${hasMore}`,
  };

  if (resolved.imageUrl) {
    payload.embeds = [
      {
        title: `${topItem.name} (${topType})`,
        description: topItem.description || 'Sem descricao.',
        image: { url: resolved.imageUrl },
        color: 0xd4a843,
      },
    ];
  }

  return payload;
}

function extractFilenameFromValue(value) {
  if (!value) return '';
  const normalized = String(value).split('?')[0].trim();
  const parts = normalized.split('/');
  return (parts[parts.length - 1] || '').trim().toLowerCase();
}

function resolveMetadataEntry(filename) {
  if (!filename) return null;

  const candidates = [
    filename,
    filename.replace('challange_', 'challenge_'),
    filename.replace('challenge_strip_', 'challenge_stripe_'),
    filename.replace('_strip_', '_stripe_'),
  ];

  for (const candidate of candidates) {
    if (warbannerMetadata[candidate]) {
      return warbannerMetadata[candidate];
    }
  }

  return null;
}

function normalizeImageUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/')) return `${WARBANNER_BASE_URL}${raw}`;
  return null;
}

function withImageTypoVariants(url) {
  const variants = [url];
  if (url.includes('challenge_strip_')) {
    variants.push(url.replace('challenge_strip_', 'challenge_stripe_'));
  }
  if (url.includes('_strip_')) {
    variants.push(url.replace('_strip_', '_stripe_'));
  }
  return variants;
}

function getChallengeImageCandidates(item) {
  const filename =
    extractFilenameFromValue(item?.image) ||
    extractFilenameFromValue(item?.fallbackOriginalUrl);
  const metadata = resolveMetadataEntry(filename);

  const rawCandidates = [
    normalizeImageUrl(metadata?.url),
    normalizeImageUrl(item?.image),
    normalizeImageUrl(item?.fallbackOriginalUrl),
  ].filter(Boolean);

  return [...new Set(rawCandidates.flatMap(withImageTypoVariants))];
}

function checkImageReachable(url) {
  const cached = imageReachabilityCache.get(url);
  const now = Date.now();
  const ttlMs = 60 * 60 * 1000;
  if (cached && now - cached.at < ttlMs) {
    return Promise.resolve(cached.ok);
  }

  const testMethods = ['HEAD', 'GET'];

  return new Promise((resolve) => {
    const attempt = (index) => {
      if (index >= testMethods.length) {
        imageReachabilityCache.set(url, { ok: false, at: now });
        resolve(false);
        return;
      }

      const req = https.request(
        url,
        {
          method: testMethods[index],
          timeout: 5000,
          headers: { 'User-Agent': 'WarChaosDiscordBot/1.0' },
        },
        (response) => {
          const ok = response.statusCode >= 200 && response.statusCode < 300;
          response.resume();
          if (ok) {
            imageReachabilityCache.set(url, { ok: true, at: now });
            resolve(true);
            return;
          }
          attempt(index + 1);
        }
      );

      req.on('timeout', () => req.destroy(new Error('timeout')));
      req.on('error', () => attempt(index + 1));
      req.end();
    };

    attempt(0);
  });
}

async function resolveBestImageResult(results) {
  const topResults = results.slice(0, 10);
  for (const item of topResults) {
    const candidates = getChallengeImageCandidates(item);
    for (const imageUrl of candidates) {
      if (await checkImageReachable(imageUrl)) {
        return { item, imageUrl };
      }
    }
  }

  return { item: results[0], imageUrl: null };
}

async function buildSearchResponse(query) {
  const results = searchChallenges(query);
  if (results.length === 0) return null;

  const resolved = await resolveBestImageResult(results);
  return buildSearchPayload(query, results, resolved);
}

function searchChallenges(query) {
  const normalized = normalizeSearchQuery(query);
  if (!normalized || normalized.length < 3) return [];

  return filterCore.filterItems(achievementsData, {
    mainFilter: 'todos',
    armasFilter: 'todos',
    colorFilter: 'todos',
    searchTerm: normalized,
    hideEmpty: true,
    showOnlyEmpty: false,
  });
}

async function main() {
  if (!process.env.DISCORD_TOKEN) {
    throw new Error('Defina DISCORD_TOKEN antes de iniciar o bot.');
  }

  startHealthServer();
  await reloadData();

  const searchCommand = new SlashCommandBuilder()
    .setName(SEARCH_COMMAND_NAME)
    .setDescription('Busca desafios do Warface pelo nome, arma ou termo relacionado.')
    .addStringOption((option) =>
      option
        .setName('termo')
        .setDescription('Termo para pesquisar nas conquistas')
        .setRequired(true)
    );

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  // Global error listeners
  client.on('error', (error) => {
    console.error('[discord] Client error:', error);
  });

  client.on('shardError', (error) => {
    console.error('[discord] Shard error:', error);
  });

  client.on('warn', (warning) => {
    console.warn('[discord] Warning:', warning);
  });

  client.once(Events.ClientReady, async () => {
    console.log(`[discord] Online como ${client.user.tag}`);
    console.log(`[discord] Fonte de dados: ${lastDataSource}`);

    try {
      await client.application.commands.set([searchCommand.toJSON()]);
      console.log(`[discord] Slash command /${SEARCH_COMMAND_NAME} sincronizado.`);
    } catch (error) {
      console.error(`[discord] Falha ao sincronizar /${SEARCH_COMMAND_NAME}:`, error);
    }
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== SEARCH_COMMAND_NAME) return;

    const query = interaction.options.getString('termo', true).trim();
    if (!query) {
      await interaction.reply({
        content: 'Informe um termo para pesquisar.',
        ephemeral: true,
      });
      return;
    }

    try {
      await interaction.deferReply();
      const payload = await buildSearchResponse(query);

      if (!payload) {
        await interaction.editReply(`Nenhum resultado encontrado para "${query}".`);
        return;
      }

      await interaction.editReply(payload);
    } catch (error) {
      console.error('[discord] Erro ao processar slash command:', error);

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply('Ocorreu um erro ao processar sua busca.');
      } else {
        await interaction.reply({
          content: 'Ocorreu um erro ao processar sua busca.',
          ephemeral: true,
        });
      }
    }
  });

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    if (!message.guildId) return;
    if (!isAllowedChannel(message.channelId)) return;

    const content = message.content.trim();
    if (!content) return;

    try {
      const payload = await buildSearchResponse(content);
      if (!payload) return;
      await message.channel.send(payload);
    } catch (error) {
      if (error.code === 50013) {
        console.error('[discord] Sem permissão para enviar mensagem no canal:', message.channelId);
      } else {
        console.error('[discord] Erro ao processar mensagem:', error);
      }
    }
  });

  const refreshMs = Math.max(1, REFRESH_MINUTES) * 60 * 1000;
  setInterval(() => {
    reloadData().catch((error) => {
      console.error('[data] Erro ao atualizar desafios:', error);
    });
  }, refreshMs);

  await client.login(process.env.DISCORD_TOKEN);
}

main().catch((error) => {
  console.error('[fatal]', error);
  process.exitCode = 1;
});
