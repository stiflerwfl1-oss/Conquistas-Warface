(function (globalScope) {
    'use strict';

    const FITA_SPECIAL_BLOCKLIST = [
        'conclua',
        'complete',
        'coroa',
        'torneio',
        'passe de batalha',
        'conquista especial',
        'pvp',
        'dano',
        'gum lovers',
        'ganhe qualquer uma',
        'marte',
        'in god we trust',
        'classificatorias',
        'lan',
        'energetico',
        'melhor jogador',
        'torretas',
        'na missao',
        'sed'
    ];

    const ESPECIAIS_TERMS = [
        'anubis', 'absolute', 'apache', 'pharaoh', 'hidden war', 'valquiria',
        'special', 'pyrite', 'godfather', 'scar', 'viridian', 'umbra',
        'santa muerte', 'aztec', 'corporate', 'shroud', 'apostate',
        'armament company', 'hydra', 'atlas', 'obsidian', 'morion', 'onyx',
        'sindicato', 'fobos', 'berserk', 'particle', 'rogue', 'guardian',
        'inverno', 'imperador amarelo', 'galaxia', 'infernal',
        'torneio mundial', 'papai noel maligno', 'great gatsby', 'gorgon',
        'medusa', 'mechanical', 'heat', 'frankenstein', 'quebra-gelo',
        'yakuza', 'caimao', 'rust', 'banshee', 'red dusk', 'road block',
        'higwayman', 'moray', 'terremoto', 'deimos', 'light circle',
        'cyber pro'
    ];

    const SYNONYMS = {
        gold: ['dourado', 'dourada', 'douradas', 'golden'],
        silver: ['prateado', 'prateada', 'prateadas'],
        weapon: ['arma'],
        rifle: ['fuzil'],
        pistol: ['pistola', 'handgun'],
        knife: ['faca', 'canivete'],
        shotgun: ['espingarda'],
        sniper: ['franco', 'barret'],
        smg: ['submetralhadora'],
        map: ['mapa'],
        operation: ['operacao', 'operations', 'mission', 'missao'],
        pve: [
            'co op', 'coop', 'cooperative', 'cooperativo', 'cooperacao',
            'player versus environment', 'spec ops', 'specops',
            'special operations', 'special operation',
            'operacoes especiais', 'operacao especial'
        ],
        'special operations': ['operacoes especiais', 'operacao especial', 'spec ops', 'specops', 'co op', 'coop'],
        camo: ['camouflage', 'padrao'],
        skin: ['cosmetic', 'visual'],
        ribbon: ['fita', 'laco'],
        achievement: ['conquista'],
        'black shark': ['tubarao negro'],
        'tubarao negro': ['black shark'],
        icebreaker: ['quebra gelo', 'pico gelado'],
        'quebra gelo': ['icebreaker', 'pico gelado'],
        'pico gelado': ['icebreaker', 'quebra gelo'],
        blackwood: ['operation blackwood', 'operacao blackwood'],
        heist: ['fuga'],
        fuga: ['heist'],
        blackout: ['blecaute'],
        blecaute: ['blackout'],
        volcano: ['vulcao', 'assalto'],
        vulcao: ['volcano', 'assalto'],
        assalto: ['volcano', 'vulcao'],
        sunrise: ['sol nascente', 'nascer do sol'],
        mars: ['marte'],
        'tower hq': ['quartel general', 'qg'],
        'quartel general': ['tower hq', 'qg']
    };

    const SPECIAL_OPS_HINT_TERMS = [
        'spec ops',
        'specops',
        'special operations',
        'special operation',
        'operacoes especiais',
        'operacao especial',
        'co op',
        'coop',
        'cooperative',
        'cooperativo'
    ];

    function normalizeComparableText(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();
    }

    function normalizeSearchQuery(value) {
        return normalizeComparableText(value)
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function hasDigit(value) {
        return /\d/.test(String(value || ''));
    }

    function normalizeText(str) {
        if (str == null) return '';
        return String(str)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function escapeRegExp(str) {
        return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    const CUSTOM_MARKERS = new Set([
        'custom',
        'customizado',
        'customizada',
        'personalizado',
        'personalizada'
    ]);

    function addAlnumBoundarySpaces(value) {
        const normalized = normalizeText(value);
        if (!normalized) return '';

        let result = '';
        for (let index = 0; index < normalized.length; index += 1) {
            const current = normalized[index];
            const next = normalized[index + 1];
            result += current;

            if (!next || current === ' ' || next === ' ') continue;

            const currentIsLetter = /[a-z]/.test(current);
            const currentIsDigit = /\d/.test(current);
            const nextIsLetter = /[a-z]/.test(next);
            const nextIsDigit = /\d/.test(next);

            if ((currentIsLetter && nextIsDigit) || (currentIsDigit && nextIsLetter)) {
                result += ' ';
            }
        }

        return result.replace(/\s+/g, ' ').trim();
    }

    function collapseSeparatedAlnumTokens(value) {
        const tokens = normalizeText(value).split(' ').filter(Boolean);
        if (tokens.length === 0) return '';

        const merged = [];

        for (const token of tokens) {
            if (merged.length === 0) {
                merged.push(token);
                continue;
            }

            const previous = merged[merged.length - 1];
            const tokenIsDigits = /^\d+$/.test(token);
            const tokenIsLetters = /^[a-z]+$/.test(token);
            const previousEndsWithLetter = /[a-z]$/.test(previous);
            const previousEndsWithDigit = /\d$/.test(previous);

            const shouldMerge =
                (previousEndsWithLetter && tokenIsDigits)
                || (previousEndsWithDigit && tokenIsLetters && token.length <= 2);

            if (shouldMerge) {
                merged[merged.length - 1] = `${previous}${token}`;
            } else {
                merged.push(token);
            }
        }

        return merged.join(' ');
    }

    function getWeaponQueryVariants(query) {
        const normalized = normalizeText(query);
        if (!normalized) return [];

        const variants = [
            normalized,
            addAlnumBoundarySpaces(normalized),
            collapseSeparatedAlnumTokens(normalized),
            collapseSeparatedAlnumTokens(addAlnumBoundarySpaces(normalized)),
            addAlnumBoundarySpaces(collapseSeparatedAlnumTokens(normalized))
        ];

        return [...new Set(variants.map((value) => normalizeText(value)).filter(Boolean))];
    }

    function matchesWeaponQuery(description, query) {
        const d = normalizeText(description);
        const q = normalizeText(query);
        if (!d || !q) return false;

        const queryTokens = q.split(' ').filter(Boolean);
        const queryWantsCustom = queryTokens.some((token) => CUSTOM_MARKERS.has(token));

        const queryVariants = getWeaponQueryVariants(q);

        for (const variant of queryVariants) {
            const phrase = escapeRegExp(variant).replace(/\s+/g, '\\s+');
            const regex = new RegExp(`(?:^|\\s)(${phrase})(?=$|\\s)`, 'g');

            let match;
            while ((match = regex.exec(d)) !== null) {
                if (queryWantsCustom) return true;

                const after = d.slice(match.index + match[0].length).trimStart();
                const nextToken = after.split(' ', 1)[0];
                if (CUSTOM_MARKERS.has(nextToken)) continue;

                return true;
            }
        }

        return false;
    }

    function queryRequiresWeaponPrecision(query) {
        const normalized = normalizeText(query);
        if (!normalized) return false;

        if (hasDigit(normalized)) return true;

        const tokens = normalized.split(' ').filter(Boolean);
        return tokens.some((token) => CUSTOM_MARKERS.has(token));
    }

    const NORMALIZED_SYNONYM_ENTRIES = Object.entries(SYNONYMS).map(([key, values]) => {
        return [
            normalizeComparableText(key),
            (values || []).map((value) => normalizeComparableText(value)).filter(Boolean)
        ];
    });

    function getSearchTerms(term) {
        const normalizedTerm = normalizeComparableText(term);
        if (!normalizedTerm) return [];

        // Numeric/alphanumeric weapon codes must stay exact (e.g. m14 != m17).
        if (hasDigit(normalizedTerm)) {
            return [normalizedTerm];
        }

        const result = [normalizedTerm];

        NORMALIZED_SYNONYM_ENTRIES.forEach(([key, values]) => {
            if (key === normalizedTerm || values.includes(normalizedTerm)) {
                result.push(key, ...values);
            }
        });

        return [...new Set(result)];
    }

    // Backward compatibility for existing integrations.
    function expandWithSynonyms(term) {
        return getSearchTerms(term);
    }

    function levenshtein(s1, s2) {
        const left = normalizeComparableText(s1);
        const right = normalizeComparableText(s2);

        if (left === right) return 0;

        const lenA = left.length;
        const lenB = right.length;
        const lenDiff = Math.abs(lenA - lenB);

        if (lenDiff > 1) return 2;

        if (lenA === lenB) {
            let mismatches = 0;

            for (let i = 0; i < lenA; i += 1) {
                if (left[i] !== right[i]) {
                    mismatches += 1;
                    if (mismatches > 1) return 2;
                }
            }

            return mismatches;
        }

        const shorter = lenA < lenB ? left : right;
        const longer = lenA < lenB ? right : left;

        let shortIndex = 0;
        let longIndex = 0;
        let edits = 0;

        while (shortIndex < shorter.length && longIndex < longer.length) {
            if (shorter[shortIndex] === longer[longIndex]) {
                shortIndex += 1;
                longIndex += 1;
                continue;
            }

            edits += 1;
            if (edits > 1) return 2;

            longIndex += 1;
        }

        if (longIndex < longer.length) {
            edits += 1;
        }

        return edits > 1 ? 2 : edits;
    }

    function getSearchFields(item) {
        const name = normalizeComparableText(item && item.name);
        const tags = ((item && item.tags) || [])
            .map((tag) => normalizeComparableText(tag))
            .filter(Boolean);
        const descriptionRaw = String(item && item.description || '');
        const description = normalizeComparableText(item && item.description);
        const operation = normalizeComparableText(item && item.operationRaw);
        const mode = normalizeComparableText(item && item.mode);
        const map = normalizeComparableText(item && (item.mapRaw || item.map));
        const hasPveTag = tags.includes('pve');
        const hasOperationSemantic = /operacao|operation|spec ops|specops|special operations|special operation|co op|coop/.test(
            `${name} ${description} ${operation} ${map}`
        );
        const isSpecialOperation = Boolean(operation) || (hasPveTag && hasOperationSemantic);
        const specialOpsHints = isSpecialOperation ? SPECIAL_OPS_HINT_TERMS.join(' ') : '';
        const context = [operation, mode, map, specialOpsHints].filter(Boolean).join(' ');
        const nameTokens = name.split(/\s+/).filter(Boolean);

        return {
            name,
            tags,
            descriptionRaw,
            description,
            operation,
            mode,
            map,
            context,
            isSpecialOperation,
            nameTokens
        };
    }

    function getBestKeywordScore(searchFields, keyword) {
        const terms = getSearchTerms(keyword);
        if (terms.length === 0) return 0;

        let bestScore = 0;

        if (terms.some((term) => searchFields.name === term)) {
            bestScore = Math.max(bestScore, 200);
        }

        if (terms.some((term) => searchFields.name.includes(term))) {
            bestScore = Math.max(bestScore, 140);
        }

        if (searchFields.tags.some((tag) => terms.some((term) => tag.includes(term)))) {
            bestScore = Math.max(bestScore, 95);
        }

        if (terms.some((term) => searchFields.description.includes(term))) {
            bestScore = Math.max(bestScore, 70);
        }

        if (terms.some((term) => searchFields.context.includes(term))) {
            bestScore = Math.max(bestScore, 115);
        }

        const hasFuzzyNameMatch = terms.some((term) => {
            if (hasDigit(term)) return false;
            return searchFields.nameTokens.some((token) => {
                if (hasDigit(token)) return false;
                return levenshtein(term, token) <= 1;
            });
        });

        if (hasFuzzyNameMatch) {
            bestScore = Math.max(bestScore, 45);
        }

        return bestScore;
    }

    function calculateSearchRelevance(item, searchTerm) {
        const query = normalizeSearchQuery(searchTerm);
        if (!query) return 0;

        const searchFields = getSearchFields(item);
        if (!searchFields.name && searchFields.tags.length === 0 && !searchFields.description && !searchFields.context) {
            return 0;
        }

        const expandedQueryTerms = getSearchTerms(query);
        const queryKeywords = query.split(/\s+/).filter((keyword) => keyword.length > 0);
        const phraseTerms = expandedQueryTerms.filter((term) => term.includes(' '));
        const hasAlternativePhrase = query.includes(' ') && phraseTerms.some((term) => term !== query);
        const requiresWeaponPrecision = queryRequiresWeaponPrecision(query);

        let score = 0;
        let skipKeywordStrictMatch = false;

        if (requiresWeaponPrecision) {
            if (!matchesWeaponQuery(searchFields.descriptionRaw, query)) {
                return 0;
            }

            score += 520;
            skipKeywordStrictMatch = true;
        }

        if (searchFields.name === query) {
            score += 700;
        } else if (searchFields.name.startsWith(query)) {
            score += 520;
        } else if (searchFields.name.includes(query)) {
            score += 400;
        }

        if (expandedQueryTerms.some((term) => searchFields.name.includes(term))) {
            score += 260;
        }

        if (searchFields.tags.some((tag) => expandedQueryTerms.some((term) => tag.includes(term)))) {
            score += 160;
        }

        if (expandedQueryTerms.some((term) => searchFields.description.includes(term))) {
            score += 110;
        }

        if (expandedQueryTerms.some((term) => searchFields.context.includes(term))) {
            score += 240;
        }

        if (searchFields.isSpecialOperation && expandedQueryTerms.some((term) => SPECIAL_OPS_HINT_TERMS.includes(term))) {
            score += 200;
        }

        if (hasAlternativePhrase) {
            const hasPhraseMatch = phraseTerms.some((term) => {
                return searchFields.name.includes(term)
                    || searchFields.tags.some((tag) => tag.includes(term))
                    || searchFields.description.includes(term)
                    || searchFields.context.includes(term);
            });

            if (hasPhraseMatch) {
                score += 280;
                skipKeywordStrictMatch = true;
            }
        }

        if (queryKeywords.length > 0 && !skipKeywordStrictMatch) {
            let keywordScoreTotal = 0;

            for (const keyword of queryKeywords) {
                const keywordScore = getBestKeywordScore(searchFields, keyword);
                if (keywordScore === 0) {
                    return 0;
                }
                keywordScoreTotal += keywordScore;
            }

            score += keywordScoreTotal;
        }

        if (levenshtein(query, searchFields.name) <= 1) {
            score += 130;
        }

        return score;
    }

    // Backward compatibility for existing integrations.
    function getSynonyms(query) {
        return getSearchTerms(query);
    }

    // Backward compatibility for existing integrations.
    function distance(s1, s2) {
        return levenshtein(s1, s2);
    }

    function getCanonicalType(type) {
        const normalized = normalizeComparableText(type);
        if (normalized === 'mark' || normalized === 'marca') return 'marca';
        if (normalized === 'badge' || normalized === 'insignia' || normalized === 'insignia') return 'insignia';
        if (normalized === 'stripe' || normalized === 'fita') return 'fita';
        return normalized;
    }

    function getWarbannerCategory(item) {
        if (item && item.warbannerCategory) return item.warbannerCategory;

        const type = getCanonicalType(item && item.type);

        if (type === 'marca') return 'marcas';
        if (type === 'insignia') return 'insignias';
        if (type === 'fita') return 'fitas';

        return 'marcas';
    }

    function parseEliminationCount(description) {
        const match = String(description || '').match(/Elimine\s+([\d.]+)\s+inimigos/i);
        if (!match) return null;

        const value = parseInt(match[1].replace(/\./g, ''), 10);
        return Number.isFinite(value) ? value : null;
    }

    function parseNumericCount(value) {
        if (value === null || value === undefined || value === '') return null;

        const normalized = String(value)
            .replace(/\s+/g, '')
            .replace(/\./g, '')
            .replace(',', '.');

        const numeric = Number(normalized);
        return Number.isFinite(numeric) ? numeric : null;
    }

    function getItemRequiredCount(item) {
        const rawCandidates = [
            item && item.amount,
            item && item.eliminations,
            item && item.goal,
            item && item.objective
        ];

        for (const candidate of rawCandidates) {
            const parsed = parseNumericCount(candidate);
            if (parsed !== null) return parsed;
        }

        return parseEliminationCount(item && item.description);
    }

    function queryHasGoldIntent(searchTerm) {
        const normalized = normalizeSearchQuery(searchTerm);
        if (!normalized) return false;

        const keywords = normalized.split(/\s+/).filter(Boolean);
        return keywords.some((keyword) => getSearchTerms(keyword).includes('gold'));
    }

    function is999EliminationsChallenge(item) {
        const requiredCount = getItemRequiredCount(item);
        if (requiredCount !== 999) return false;

        const description = normalizeComparableText(item && item.description);
        const hasEliminationSemantic = /elimine|mate|eliminac|oponentes|inimigos|acertos/.test(description);

        return hasEliminationSemantic || parseEliminationCount(item && item.description) === 999;
    }

    function hasWarbannerSearchMatch(item, searchTerm) {
        const query = normalizeSearchQuery(searchTerm);
        if (!query) return true;
        return calculateSearchRelevance(item, query) > 0;
    }

    function matchesArmasFilter(item, armasFilter) {
        const descriptionRaw = String(item && item.description || '');
        const description = normalizeComparableText(descriptionRaw);
        const category = getWarbannerCategory(item);
        const eliminationCount = parseEliminationCount(descriptionRaw);
        const activeFilter = String(armasFilter || 'todos');

        if (activeFilter === 'crown') {
            return description.includes('elimine') && description.includes('inimigos') && description.includes('coroa');
        }

        if (activeFilter === 'dourada') {
            if (!description.includes('dourada')) return false;

            if (category === 'fitas') {
                return eliminationCount === 999;
            }

            const hasVersionPattern = (description.includes('elimine') || description.includes('inimigos')) && description.includes('versao');
            const isHighTierGoldenWeapon = ['elimine', 'inimigos', 'com', 'versao'].some((term) => description.includes(term))
                && (eliminationCount === 5000 || eliminationCount === 10000);

            return !(isHighTierGoldenWeapon || hasVersionPattern);
        }

        if (activeFilter === 'especiais') {
            if (description.includes('dourado') || description.includes('dourada')) {
                return false;
            }

            if (category === 'fitas' && FITA_SPECIAL_BLOCKLIST.some((term) => description.includes(term))) {
                return false;
            }

            return ESPECIAIS_TERMS.some((term) => description.includes(term));
        }

        if (activeFilter === 'todos') {
            return eliminationCount !== null || /elimine|mate|vencer|partida/i.test(descriptionRaw);
        }

        if (eliminationCount === null) return false;

        if (activeFilter === 'low') return eliminationCount < 999;
        if (activeFilter === '999') return eliminationCount === 999 || eliminationCount === 1000;
        if (activeFilter === '2500') return eliminationCount === 2500;
        if (activeFilter === '5000') return eliminationCount === 5000;
        if (activeFilter === '10000') return eliminationCount === 10000;

        return false;
    }

    function matchesMainFilter(item, mainFilter, armasFilter) {
        const activeMainFilter = String(mainFilter || 'todos');
        const description = normalizeComparableText(item && item.description);
        const descriptionSearch = normalizeSearchQuery(item && item.description);
        const filename = normalizeComparableText(item && item.filename);

        if (activeMainFilter === 'armas') {
            return matchesArmasFilter(item, armasFilter);
        }

        if (activeMainFilter === 'pvp') {
            return filename.includes('pvp') || /vencer|vitoria|ganhar\s+partida/i.test(description);
        }

        if (activeMainFilter === 'pve') {
            return filename.includes('pve')
                || /completar|missao|operacao|mission|operation|spec\s*ops|special\s*operation|co\s*op|coop/i.test(descriptionSearch)
                || Boolean(normalizeComparableText(item && item.operationRaw));
        }

        return true;
    }

    function filterItems(items, options) {
        const settings = Object.assign({
            mainFilter: 'todos',
            armasFilter: 'todos',
            colorFilter: 'todos',
            searchTerm: '',
            hideEmpty: true,
            showOnlyEmpty: false
        }, options || {});

        let filtered = Array.isArray(items) ? items.slice() : [];

        if (settings.showOnlyEmpty) {
            return filtered.filter((item) => !String(item && item.description || '').trim());
        }

        if (settings.hideEmpty) {
            filtered = filtered.filter((item) => String(item && item.description || '').trim() !== '');
        }

        if (String(settings.searchTerm || '').trim() !== '') {
            const forceGold999Eliminations = queryHasGoldIntent(settings.searchTerm);

            const scoredItems = filtered
                .map((item, index) => ({
                    item,
                    index,
                    score: calculateSearchRelevance(item, settings.searchTerm)
                }))
                .filter((entry) => entry.score > 0)
                .filter((entry) => {
                    if (!forceGold999Eliminations) return true;
                    return is999EliminationsChallenge(entry.item);
                })
                .sort((left, right) => {
                    if (right.score !== left.score) {
                        return right.score - left.score;
                    }
                    return left.index - right.index;
                });

            filtered = scoredItems.map((entry) => entry.item);
        }

        filtered = filtered.filter((item) => matchesMainFilter(item, settings.mainFilter, settings.armasFilter));

        if (settings.colorFilter && settings.colorFilter !== 'todos') {
            filtered = filtered.filter((item) => String(item && item.color || 'outro') === settings.colorFilter);
        }

        return filtered;
    }

    const api = {
        calculateSearchRelevance,
        distance,
        expandWithSynonyms,
        filterItems,
        getCanonicalType,
        getItemRequiredCount,
        getSearchTerms,
        getSynonyms,
        getWarbannerCategory,
        hasWarbannerSearchMatch,
        is999EliminationsChallenge,
        levenshtein,
        matchesWeaponQuery,
        matchesArmasFilter,
        matchesMainFilter,
        normalizeComparableText,
        normalizeText,
        parseEliminationCount
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    globalScope.WarbannerFilterCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
