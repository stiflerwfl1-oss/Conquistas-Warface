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
const MAX_EMBEDS_PER_MESSAGE = 10;
const MAX_RESULTS_PER_SEARCH = 30;

loadEnvFile();

const REFRESH_MINUTES = Number(process.env.DATA_REFRESH_MINUTES || 10);
const NO_RESULT_LIMIT = 3;
const NO_RESULT_TIMEOUT_MS = 5 * 60 * 1000;
const DISCORD_ALLOWED_CHANNEL_IDS = String(process.env.DISCORD_ALLOWED_CHANNEL_IDS || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);
const GITHUB_DATA_URL = resolveGithubDataUrl();

let achievementsData = [];
let catalogData = [];
let lastDataSource = 'none';
const warbannerMetadata = loadMetadataMap();
const imageReachabilityCache = new Map();
const noResultStreakByUser = new Map();

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
      catalogData = buildCatalogData(achievementsData);
      lastDataSource = `github:${GITHUB_DATA_URL}`;
      console.log(`[data] ${achievementsData.length} desafios carregados de ${lastDataSource}`);
      return;
    } catch (error) {
      console.warn(`[data] Falha no GitHub (${error.message}). Usando arquivo local.`);
    }
  }

  achievementsData = readLocalData();
  catalogData = buildCatalogData(achievementsData);
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

function getEmbedColor(type) {
  const canonicalType = filterCore.getCanonicalType(type);
  if (canonicalType === 'fita') return 0xd4a843;
  if (canonicalType === 'insignia') return 0x4aa3df;
  if (canonicalType === 'marca') return 0x6cc070;
  return 0x8a8f98;
}

function buildChallengeEmbed(item, imageUrl) {
  const typeLabel = getTypeLabel(item.type);
  const embed = {
    title: `${item.name} (${typeLabel})`,
    description: item.description || 'Sem descricao.',
    color: getEmbedColor(item.type),
  };

  if (imageUrl) {
    embed.image = { url: imageUrl };
  }

  return embed;
}

function chunkArray(items, chunkSize) {
  const chunks = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
}

function buildSearchPayloads(query, results, resolvedResults) {
  const chunks = chunkArray(resolvedResults, MAX_EMBEDS_PER_MESSAGE);
  const displayedCount = resolvedResults.length;
  const totalCount = results.length;

  return chunks.map((chunk, chunkIndex) => {
    const start = chunkIndex * MAX_EMBEDS_PER_MESSAGE + 1;
    const end = start + chunk.length - 1;
    const chunkLabel =
      chunks.length > 1 ? `\nLote ${chunkIndex + 1}/${chunks.length} (${start}-${end}).` : '';
    const trimmedLabel =
      totalCount > displayedCount
        ? `\nExibindo ${displayedCount} de ${totalCount} resultados. Refine a busca para ver menos itens por vez.`
        : '';

    return {
      content:
        chunkIndex === 0
          ? `[BUSCA] Resultados para "${query}": ${totalCount} desafio(s).${chunkLabel}${trimmedLabel}`
          : `[BUSCA] Continuação de "${query}".${chunkLabel}`,
      embeds: chunk.map(({ item, imageUrl }) => buildChallengeEmbed(item, imageUrl)),
    };
  });
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

function buildCatalogData(items) {
  return (Array.isArray(items) ? items : []).map((item) => {
    const filename =
      extractFilenameFromValue(item?.image) ||
      extractFilenameFromValue(item?.fallbackOriginalUrl);
    const metadata = resolveMetadataEntry(filename);

    return {
      ...item,
      filename,
      name: metadata && metadata.name ? metadata.name : item.name,
      description: metadata && metadata.description ? metadata.description : item.description,
      amount: metadata && metadata.amount !== '' ? metadata.amount : (item.objective ?? ''),
      color: metadata && metadata.color ? metadata.color : 'outro',
      warbannerCategory: metadata
        ? metadata.category
        : filterCore.getWarbannerCategory(item),
    };
  });
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

async function resolveChallengeImage(item) {
  const candidates = getChallengeImageCandidates(item);

  for (const imageUrl of candidates) {
    if (await checkImageReachable(imageUrl)) {
      return imageUrl;
    }
  }

  return null;
}

async function handleNoResultAndMaybeTimeout(message) {
  const previous = noResultStreakByUser.get(message.author.id) || 0;
  const next = previous + 1;
  noResultStreakByUser.set(message.author.id, next);

  if (next < NO_RESULT_LIMIT) return;

  noResultStreakByUser.set(message.author.id, 0);
  try {
    if (message.member && message.member.moderatable) {
      await message.member.timeout(
        NO_RESULT_TIMEOUT_MS,
        '3 buscas consecutivas sem resultado no bot de desafios.'
      );
      await message.channel.send(
        `${message.author}, voce recebeu timeout de 5 minutos por 3 buscas sem resultado seguidas.`
      );
    }
  } catch (error) {
    console.error('[discord] Falha ao aplicar timeout por buscas sem resultado:', error);
  }
}

function resetNoResultStreak(userId) {
  if (noResultStreakByUser.has(userId)) {
    noResultStreakByUser.delete(userId);
  }
}

async function buildSearchResponses(query) {
  const results = searchChallenges(query);
  if (results.length === 0) return [];

  const limitedResults = results.slice(0, MAX_RESULTS_PER_SEARCH);
  const resolvedResults = [];

  for (const item of limitedResults) {
    const imageUrl = await resolveChallengeImage(item);
    resolvedResults.push({ item, imageUrl });
  }

  return buildSearchPayloads(query, results, resolvedResults);
}

function searchChallenges(query) {
  const normalized = normalizeSearchQuery(query);
  if (!normalized || normalized.length < 2) return [];

  const resolvedOperationName =
    typeof filterCore.resolveSpecOpsOperationName === 'function'
      ? filterCore.resolveSpecOpsOperationName(query)
      : null;
  const descriptionOnlySearch = Boolean(resolvedOperationName);

  return filterCore.filterItems(catalogData, {
    mainFilter: 'todos',
    armasFilter: 'todos',
    colorFilter: 'todos',
    searchTerm: query,
    resolvedOperationName,
    descriptionOnlySearch,
    hideEmpty: true,
    showOnlyEmpty: false,
  });
}

async function sendPayloads(target, payloads, mode) {
  if (!Array.isArray(payloads) || payloads.length === 0) return;

  if (mode === 'interaction') {
    const [firstPayload, ...otherPayloads] = payloads;
    await target.editReply(firstPayload);

    for (const payload of otherPayloads) {
      await target.followUp(payload);
    }

    return;
  }

  for (const payload of payloads) {
    await target.send(payload);
  }
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
      const payloads = await buildSearchResponses(query);

      if (payloads.length === 0) {
        await interaction.editReply(`Nenhum resultado encontrado para "${query}".`);
        return;
      }

      await sendPayloads(interaction, payloads, 'interaction');
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
      const payloads = await buildSearchResponses(content);
      if (payloads.length === 0) {
        await handleNoResultAndMaybeTimeout(message);
        return;
      }
      resetNoResultStreak(message.author.id);
      await sendPayloads(message.channel, payloads, 'channel');
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

if (require.main === module) {
  main().catch((error) => {
    console.error('[fatal]', error);
    process.exitCode = 1;
  });
} else {
  module.exports = {
    buildSearchResponses,
    getChallengeImageCandidates,
    readLocalData,
    resolveChallengeImage,
    searchChallenges,
    setAchievementsDataForTest(data) {
      achievementsData = Array.isArray(data) ? data : [];
      catalogData = buildCatalogData(achievementsData);
    },
  };
}
