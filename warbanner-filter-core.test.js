const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const core = require('./warbanner-filter-core.js');

const ROOT = __dirname;

function loadAchievementsData() {
    const filePath = path.join(ROOT, 'data.js');
    const source = fs.readFileSync(filePath, 'utf8') + '\n;globalThis.__data = achievementsData;';
    const sandbox = { globalThis: {} };
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox);
    return sandbox.globalThis.__data;
}

function loadWarbannerMetadata() {
    const filePath = path.join(ROOT, 'warbanner-metadata.js');
    const source = fs.readFileSync(filePath, 'utf8') + '\n;globalThis.__meta = window.warbannerMetadata;';
    const sandbox = { window: {}, globalThis: {} };
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox);
    return sandbox.globalThis.__meta || sandbox.window.warbannerMetadata;
}

function extractFilename(value) {
    if (!value) return '';

    const normalized = String(value).split('?')[0].trim();
    const parts = normalized.split('/');
    return parts[parts.length - 1] || '';
}

function buildCatalog() {
    const data = loadAchievementsData();
    const metadataMap = loadWarbannerMetadata();

    return data.map((item) => {
        const filename = extractFilename(item.image) || extractFilename(item.fallbackOriginalUrl);
        const metadata = metadataMap[filename] || null;

        return {
            ...item,
            filename,
            name: metadata && metadata.name ? metadata.name : item.name,
            description: metadata && metadata.description ? metadata.description : item.description,
            amount: metadata && metadata.amount !== '' ? metadata.amount : (item.objective ?? ''),
            color: metadata && metadata.color ? metadata.color : 'outro',
            warbannerCategory: metadata ? metadata.category : core.getWarbannerCategory(item),
        };
    });
}

function sortedIds(items) {
    return items.map((item) => item.id).sort();
}

test('expandWithSynonyms is bidirectional for gold/dourada', () => {
    const fromGold = core.expandWithSynonyms('gold');
    const fromDourada = core.expandWithSynonyms('dourada');

    assert.ok(fromGold.includes('dourada'));
    assert.ok(fromDourada.includes('gold'));
});

test('partial keyword matching finds SIG Sauer with and without P226 term', () => {
    const item = {
        name: 'SIG Sauer P226 Gold',
        tags: ['weapon'],
        description: 'Premium pistol skin'
    };

    assert.equal(core.hasWarbannerSearchMatch(item, 'sig sauer gold'), true);
    assert.equal(core.hasWarbannerSearchMatch(item, 'sig sauer p226 gold'), true);
});

test('levenshtein <= 1 supports typo tolerance on name', () => {
    const item = { name: 'elite', tags: [], description: '' };

    assert.equal(core.hasWarbannerSearchMatch(item, 'elitr'), true);
    assert.equal(core.hasWarbannerSearchMatch(item, 'xlyte'), false);
});

test('numeric weapon codes do not fuzzy-match different codes', () => {
    const item = { name: 'M17 Tactical', tags: ['weapon'], description: 'Pistol challenge' };

    assert.equal(core.hasWarbannerSearchMatch(item, 'm14'), false);
    assert.equal(core.hasWarbannerSearchMatch(item, 'm17'), true);
});

test('gold and dourada queries return the same result set on catalog', () => {
    const catalog = buildCatalog();

    const gold = core.filterItems(catalog, {
        searchTerm: 'gold',
        hideEmpty: false,
        showOnlyEmpty: false
    });

    const dourada = core.filterItems(catalog, {
        searchTerm: 'dourada',
        hideEmpty: false,
        showOnlyEmpty: false
    });

    const goldWithPunctuation = core.filterItems(catalog, {
        searchTerm: 'GOLD,',
        hideEmpty: false,
        showOnlyEmpty: false
    });

    assert.deepEqual(sortedIds(gold), sortedIds(dourada));
    assert.deepEqual(sortedIds(gold), sortedIds(goldWithPunctuation));
    assert.ok(gold.length > 0);
    assert.ok(gold.every((item) => core.is999EliminationsChallenge(item)));
});

test('sig sauer gold and sig sauer p226 gold are equivalent on catalog', () => {
    const catalog = buildCatalog();

    const queryA = core.filterItems(catalog, {
        searchTerm: 'sig sauer gold',
        hideEmpty: false,
        showOnlyEmpty: false
    });

    const queryB = core.filterItems(catalog, {
        searchTerm: 'sig sauer p226 gold',
        hideEmpty: false,
        showOnlyEmpty: false
    });

    assert.deepEqual(sortedIds(queryA), sortedIds(queryB));
});

test('black shark and tubarao negro return the same result set on catalog', () => {
    const catalog = buildCatalog();

    const english = core.filterItems(catalog, {
        searchTerm: 'black shark',
        hideEmpty: false,
        showOnlyEmpty: false
    });

    const portuguese = core.filterItems(catalog, {
        searchTerm: 'tubarao negro',
        hideEmpty: false,
        showOnlyEmpty: false
    });

    assert.deepEqual(sortedIds(english), sortedIds(portuguese));
});

test('as50 query finds weapon challenges on catalog', () => {
    const catalog = buildCatalog();

    const results = core.filterItems(catalog, {
        searchTerm: 'as50',
        hideEmpty: false,
        showOnlyEmpty: false
    });

    assert.ok(results.length > 0);
    assert.ok(results.some((item) => String(item.name).includes('AS50')));
});

test('gold ribbon filter isolates ribbon challenges only', () => {
    const catalog = buildCatalog();

    const results = catalog.filter((item) => {
        return core.getWarbannerCategory(item) === 'fitas'
            && core.matchesArmasFilter(item, 'dourada');
    });

    assert.ok(results.length > 0);
    assert.ok(results.every((item) => core.getWarbannerCategory(item) === 'fitas'));
});
