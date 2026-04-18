const fs = require('fs');
const path = require('path');
const vm = require('vm');
const https = require('https');
const { Client, GatewayIntentBits } = require('discord.js');
const filterCore = require('./warbanner-filter-core');

const DATA_FILE = path.join(__dirname, 'data.js');
const METADATA_FILE = path.join(__dirname, 'warbanner-metadata.js');
const ENV_FILE = path.join(__dirname, '.env');
const WARBANNER_BASE_URL = 'https://warbanner.com.br';

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
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || 'main';
  const dataPath = process.env.GITHUB_DATA_PATH || 'data.js';

  if (!owner || !repo) return '';
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${dataPath}`;
}

function resolveGithubDataUrl() {
  const configuredUrl = String(process.env.GITHUB_DATA_URL || '').trim();
  if (!configuredUrl) return buildGithubRawUrl();

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

  return configuredUrl;
}

function loadMetadataMap() {
  if (!fs.existsSync(METADATA_FILE)) return {};

  try {
    const source = fs.readFileSync(METADATA_FILE, 'utf8');
    const context = { window: {} };
    vm.createContext(context);
    vm.runInContext(source, context);
    const map = context.window?.warbannerMetadata || context.warbannerMetadata || {};
    return map && typeof map === 'object' ? map : {};
  } catch (error) {
    console.warn(`[metadata] Falha ao carregar metadados: ${error.message}`);
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

  await reloadData();

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  client.once('clientReady', () => {
    console.log(`[discord] Online como ${client.user.tag}`);
    console.log(`[discord] Fonte de dados: ${lastDataSource}`);
  });

  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.guildId) return;
    if (!isAllowedChannel(message.channelId)) return;

    const content = message.content.trim();
    if (!content) return;

    try {
      const results = searchChallenges(content);
      if (results.length === 0) return;

      const topResults = results.slice(0, 10).map(formatChallengeLine).join('\n\n');
      const hasMore = results.length > 10 ? `\n\n... e mais ${results.length - 10} resultado(s).` : '';

      const resolved = await resolveBestImageResult(results);
      const topItem = resolved.item;
      const topType = getTypeLabel(topItem.type);

      const payload = {
        content: `🔎 **Resultados para:** "${content}"\n\n${topResults}${hasMore}`,
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

      await message.channel.send(payload);
    } catch (error) {
      console.error('[discord] Erro ao processar mensagem:', error);
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
