/* ============================================
   WARCHAOS - Application Logic
   Search, Filters, Theme, Navigation, Modal
   ============================================ */

(function() {
    'use strict';

    // ============================================
    // DOM References
    // ============================================
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const DOM = {
        header: $('#header'),
        themeToggle: $('#theme-toggle'),
        mobileToggle: $('#mobile-toggle'),
        mainNav: $('#main-nav'),
        globalSearch: $('#global-search'),
        searchClear: $('#search-clear'),
        searchResults: $('#search-results'),
        achievementsGrid: $('#achievements-grid'),
        ribbonsGrid: $('#ribbons-grid'),
        gridEmpty: $('#grid-empty'),
        gridLoading: $('#grid-loading'),
        resultsCount: $('#results-count'),
        scrollTop: $('#scroll-top'),
        filterMain: $('#filter-main'),
        filterArmas: $('#filter-armas'),
        filterColor: $('#filter-color'),
        armasFilterGroup: $('#armas-filter-group'),
        modal: $('#detail-modal'),
    };

    // ============================================
    // State
    // ============================================
    let state = {
        activeCategory: 'all',
        searchQuery: '',
        mainFilter: 'todos',
        armasFilter: 'todos',
        colorFilter: 'todos',
        hideEmpty: true,
        showOnlyEmpty: false,
        ribbonFilter: 'all',
    };

    // SVG fallback for broken images
    const FALLBACK_SVG = "data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Crect fill=%22%231a1a28%22 width=%22100%22 height=%22100%22 rx=%228%22/%3E%3Ctext x=%2250%22 y=%2258%22 text-anchor=%22middle%22 font-size=%2232%22 fill=%22%23d4a843%22%3E⚔%3C/text%3E%3C/svg%3E";
    const IMAGE_BASE_PATH = '../../imagens';
    const filterCore = window.WarbannerFilterCore;
    const metadataMap = window.warbannerMetadata || {};

    function extractFilenameFromValue(value) {
        if (!value) return '';

        const normalized = String(value).split('?')[0].trim();
        const parts = normalized.split('/');
        return parts[parts.length - 1] || '';
    }

    function buildImageCandidates(filename, remoteUrl, originalUrl) {
        const candidates = [];

        if (filename) {
            candidates.push(`${IMAGE_BASE_PATH}/${filename}`);

            if (filename.includes('challenge_strip_')) {
                candidates.push(`${IMAGE_BASE_PATH}/${filename.replace('challenge_strip_', 'challenge_stripe_')}`);
            }

            if (filename.includes('_strip_')) {
                candidates.push(`${IMAGE_BASE_PATH}/${filename.replace('_strip_', '_stripe_')}`);
            }
        }

        if (remoteUrl) candidates.push(remoteUrl);
        if (originalUrl) candidates.push(originalUrl);

        return [...new Set(candidates.filter(Boolean))];
    }

    function buildCatalogData() {
        return achievementsData.map((item) => {
            const filename = extractFilenameFromValue(item.image) || extractFilenameFromValue(item.fallbackOriginalUrl);
            const metadata = metadataMap[filename] || null;
            const remoteUrl = metadata && metadata.url
                ? `https://warbanner.com.br${metadata.url}`
                : (item.fallbackOriginalUrl || item.image || '');
            const imageCandidates = buildImageCandidates(filename, remoteUrl, item.fallbackOriginalUrl || item.image || '');

            return {
                ...item,
                filename,
                name: metadata && metadata.name ? metadata.name : item.name,
                description: metadata && metadata.description ? metadata.description : item.description,
                amount: metadata && metadata.amount !== '' ? metadata.amount : (item.objective ?? ''),
                color: metadata && metadata.color ? metadata.color : 'outro',
                warbannerCategory: metadata
                    ? metadata.category
                    : (filterCore ? filterCore.getWarbannerCategory(item) : 'marcas'),
                imageRemote: remoteUrl,
                imageCandidates,
            };
        });
    }

    const catalogData = buildCatalogData();

    // ============================================
    // Initialize
    // ============================================
    function init() {
        initTheme();
        createModal();
        renderStats();
        renderGrid();
        renderRibbonsGrid();
        bindEvents();
        hideLoading();

        // Delay stat animation for visual impact
        setTimeout(animateStats, 300);

        // Intersection observer for card animations
        setupScrollAnimations();
    }

    // ============================================
    // Theme System
    // ============================================
    function initTheme() {
        const saved = localStorage.getItem('warchaos-theme');
        if (saved) {
            document.documentElement.setAttribute('data-theme', saved);
        }
    }

    function toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('warchaos-theme', next);
    }

    // ============================================
    // Stats Animation
    // ============================================
    function renderStats() {
        const marks = catalogData.filter(a => getCanonicalType(a.type) === 'marca').length;
        const badges = catalogData.filter(a => getCanonicalType(a.type) === 'insignia').length;
        const stripes = catalogData.filter(a => getCanonicalType(a.type) === 'fita').length;
        const total = catalogData.length;
        const marksEl = $('#stat-marks');
        const badgesEl = $('#stat-badges');
        const stripesEl = $('#stat-stripes');
        const totalEl = $('#stat-total');

        // Stats are optional in the layout; update only if present.
        if (marksEl) {
            marksEl.dataset.target = marks;
            marksEl.textContent = marks;
        }
        if (badgesEl) {
            badgesEl.dataset.target = badges;
            badgesEl.textContent = badges;
        }
        if (stripesEl) {
            stripesEl.dataset.target = stripes;
            stripesEl.textContent = stripes;
        }
        if (totalEl) {
            totalEl.dataset.target = total;
            totalEl.textContent = total;
        }
    }

    function animateStats() {
        $$('.hero__stat-number').forEach(el => {
            const target = parseInt(el.dataset.target || el.textContent);
            if (!target || isNaN(target)) return;
            let current = 0;
            const duration = 1800;
            const startTime = performance.now();
            el.textContent = '0';

            function update(now) {
                const elapsed = now - startTime;
                const progress = Math.min(elapsed / duration, 1);
                // Ease out cubic
                const eased = 1 - Math.pow(1 - progress, 3);
                current = Math.floor(target * eased);
                el.textContent = current;
                if (progress < 1) {
                    requestAnimationFrame(update);
                } else {
                    el.textContent = target;
                }
            }
            requestAnimationFrame(update);
        });
    }

    // ============================================
    // Scroll Animations (Intersection Observer)
    // ============================================
    function setupScrollAnimations() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-in');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

        // Observe section headers
        $$('.section__header, .ribbons-filters').forEach(el => {
            el.classList.add('animate-target');
            observer.observe(el);
        });
    }

    function getCanonicalType(type) {
        const normalized = String(type || '').trim().toLowerCase();
        const typeMap = {
            mark: 'marca',
            badge: 'insignia',
            stripe: 'fita',
            marca: 'marca',
            insignia: 'insignia',
            'insígnia': 'insignia',
            fita: 'fita',
        };
        return typeMap[normalized] || normalized;
    }

    function isRibbon(item) {
        return getCanonicalType(item?.type) === 'fita';
    }

    function getNumericObjective(item) {
        const rawValue = item?.amount ?? item?.eliminations ?? item?.goal ?? item?.objective;
        const numericValue = Number(rawValue);
        return Number.isFinite(numericValue) ? numericValue : null;
    }

    function isGoldRibbon(item) {
        if (!isRibbon(item)) return false;
        const text = `${item?.name || ''} ${item?.description || ''}`;
        const hasDourada = /\bdourada\b/i.test(text);
        return hasDourada && getNumericObjective(item) === 999;
    }

    function getTypeLabel(type) {
        const labels = {
            marca: 'Marca',
            insignia: 'Insígnia',
            fita: 'Fita',
        };
        return labels[getCanonicalType(type)] || 'Conquista';
    }

    function getTypeCssClass(type) {
        const canonicalType = getCanonicalType(type);
        const classMap = {
            marca: 'mark',
            insignia: 'badge',
            fita: 'stripe',
        };
        return classMap[canonicalType] || canonicalType;
    }

    function normalizeOperationText(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function escapeRegExp(value) {
        return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function hasWholePhrase(text, term) {
        const normalizedTerm = normalizeOperationText(term);
        if (!normalizedTerm) return false;

        const phrase = escapeRegExp(normalizedTerm).replace(/\s+/g, '\\s+');
        return new RegExp(`(?:^|\\s)${phrase}(?=$|\\s)`).test(text);
    }

    const OPERATION_ALIAS_GROUPS = [
        ['black shark', 'tubarao negro'],
        ['icebreaker', 'quebra gelo', 'pico gelado'],
        ['mars', 'marte'],
        ['anubis', 'anubis'],
        ['hydra'],
        ['pripyat'],
        ['sunrise', 'sol nascente', 'nascer do sol'],
        ['swarm', 'enxame'],
        ['blackwood', 'operation blackwood', 'operacao blackwood'],
        ['heist', 'roubo', 'fuga'],
        ['cyber horde', 'horda ciborgue', 'horda cibernetica'],
        ['earth shaker', 'terremoto', 'operacao qg'],
        ['blackout', 'blecaute'],
        ['tower hq', 'quartel general', 'qg'],
        ['silent streets', 'ruas silenciosas'],
        ['volcano', 'vulcao', 'assalto']
    ].map((group) => Array.from(new Set(group.map((term) => normalizeOperationText(term)).filter(Boolean))));

    const OPERATION_ALIAS_INDEX = (() => {
        const index = new Map();
        OPERATION_ALIAS_GROUPS.forEach((group) => {
            group.forEach((term) => index.set(term, group));
        });
        return index;
    })();

    const SPEC_OPS_TERMS = Array.from(new Set(
        OPERATION_ALIAS_GROUPS.flat().concat([
            'special operations',
            'special operation',
            'operacoes especiais',
            'operacao especial',
            'spec ops',
            'specops',
            'co op',
            'coop',
            'cooperative',
            'cooperativo',
            'pve',
            'tower raid',
            'citadel'
        ].map((term) => normalizeOperationText(term)))
    )).filter(Boolean);

    function getOperationSearchText(item) {
        return normalizeOperationText([
            item?.name || '',
            item?.description || '',
            item?.operationRaw || '',
            item?.mapRaw || '',
            item?.mode || '',
            (item?.tags || []).join(' ')
        ].join(' '));
    }

    function getOperationTerms(opName) {
        const normalized = normalizeOperationText(opName);
        if (!normalized) return [];
        return OPERATION_ALIAS_INDEX.get(normalized) || [normalized];
    }

    function matchesOperationAlias(item, opName) {
        const text = getOperationSearchText(item);
        const terms = getOperationTerms(opName);
        return terms.some((term) => hasWholePhrase(text, term));
    }

    function matchesAnyTerm(item, terms) {
        const text = getOperationSearchText(item);
        return terms.some((term) => hasWholePhrase(text, term));
    }

    function isSpecialOperationItem(item) {
        const operationRaw = normalizeOperationText(item?.operationRaw);
        if (operationRaw) return true;
        return matchesAnyTerm(item, SPEC_OPS_TERMS);
    }

    function getSearchText(item) {
        return `${item?.name || ''} ${item?.description || ''}`.toLowerCase();
    }

    function isLegacyGoldItem(item) {
        return Boolean(item?.isGold) || hasTag(item, 'Gold');
    }

    function isGoldCategoryItem(item) {
        return isGoldRibbon(item) || isLegacyGoldItem(item);
    }

    function matchesGoldFilter(item, goldFilter) {
        if (goldFilter === 'gold') {
            return isGoldRibbon(item);
        }
        if (goldFilter === 'normal') {
            return !isGoldRibbon(item);
        }
        return true;
    }

    function shouldShowGoldIndicator(item) {
        return isGoldRibbon(item) || isLegacyGoldItem(item);
    }

    function getGoldDetailLabel(item) {
        if (isGoldRibbon(item)) {
            return '★ Fita Gold';
        }
        if (isLegacyGoldItem(item)) {
            return '★ Arma Gold';
        }
        return '';
    }

    function scrollToAchievements() {
        const achievementsSection = document.getElementById('achievements');
        if (achievementsSection) {
            achievementsSection.scrollIntoView({ behavior: 'smooth' });
        }
    }

    function scrollToGrid() {
        const grid = document.querySelector('.grid-section');
        if (grid) {
            const offset = grid.getBoundingClientRect().top + window.scrollY - 160;
            window.scrollTo({ top: offset, behavior: 'smooth' });
        }
    }

    function safeToggleFilterGroup() {
        if (DOM.armasFilterGroup) {
            DOM.armasFilterGroup.style.display = state.mainFilter === 'armas' ? 'flex' : 'none';
        }
    }

    function resetArmasFilterIfHidden() {
        if (state.mainFilter !== 'armas') {
            state.armasFilter = 'todos';
            if (DOM.filterArmas) {
                DOM.filterArmas.value = 'todos';
            }
        }
    }

    function refreshGridForCurrentCategory() {
        safeToggleFilterGroup();
        resetArmasFilterIfHidden();
        renderGrid(true);
    }

    function setResultsCount(count) {
        if (DOM.resultsCount) {
            DOM.resultsCount.textContent = String(count);
        }
    }

    function showGridEmptyState() {
        if (DOM.gridEmpty) {
            DOM.gridEmpty.style.display = 'block';
        }
        setResultsCount(0);
    }

    function hideGridEmptyState() {
        if (DOM.gridEmpty) {
            DOM.gridEmpty.style.display = 'none';
        }
    }

    function renderGridBatch(items, startIndex) {
        const html = items.map((item, i) => createCard(item, startIndex + i)).join('');
        DOM.achievementsGrid.insertAdjacentHTML('beforeend', html);
    }

    function getImageSourceSet(item) {
        const sources = Array.isArray(item?.imageCandidates) ? item.imageCandidates : [];
        return sources.length ? sources : [item?.image || item?.fallbackOriginalUrl || FALLBACK_SVG].filter(Boolean);
    }

    // ============================================
    // Image Error Handling
    // ============================================
    function handleImageError(img) {
        let remainingSources = [];

        try {
            remainingSources = JSON.parse(img.dataset.fallbackSources || '[]');
        } catch (error) {
            remainingSources = [];
        }

        if (remainingSources.length > 0) {
            const [nextSource, ...rest] = remainingSources;
            img.dataset.fallbackSources = JSON.stringify(rest);
            img.src = nextSource;
            return;
        }

        const wrapper = img.closest('.card__image-wrapper');
        if (!wrapper) {
            img.src = FALLBACK_SVG;
            return;
        }
        const card = wrapper.closest('.card');
        const itemId = card ? card.dataset.id : '';
        const item = catalogData.find(a => a.id === itemId);
        const fallbackIcons = { marca: '🎯', insignia: '🛡️', fita: '🎖️' };
        const icon = item ? fallbackIcons[getCanonicalType(item.type)] || '⚔' : '⚔';

        // Replace the image with a styled fallback
        img.remove();
        const fallbackDiv = document.createElement('div');
        fallbackDiv.className = 'card__fallback';
        fallbackDiv.textContent = icon;
        wrapper.appendChild(fallbackDiv);
    }

    // ============================================
    // Card Rendering
    // ============================================
    function createCard(item, index) {
        const typeClass = getTypeCssClass(item.type);
        const imageSources = getImageSourceSet(item);
        const primaryImage = imageSources[0] || FALLBACK_SVG;
        const fallbackSources = JSON.stringify(imageSources.slice(1));

        const tagsHtml = (item.tags || []).slice(0, 4).map(tag => {
            let tagClass = 'card__tag';
            if (tag === 'PvE' || tag === 'PvP') tagClass += ' card__tag--mode';
            if (tag === 'Gold') tagClass += ' card__tag--gold';
            return `<span class="${tagClass}">${tag}</span>`;
        }).join('');

        const goldIndicator = shouldShowGoldIndicator(item)
            ? '<span class="card__gold-indicator">★</span>'
            : '';

        const delay = Math.min(index * 0.04, 0.6);

        return `
        <article class="card card--${typeClass}" style="animation-delay: ${delay}s" data-id="${item.id}" tabindex="0">
            <div class="card__image-wrapper">
                ${goldIndicator}
                <span class="card__type-badge card__type-badge--${typeClass}">${getTypeLabel(item.type)}</span>
                <img
                    class="card__image"
                    src="${primaryImage}"
                    data-fallback-sources='${fallbackSources.replace(/'/g, '&#39;')}'
                    alt="${item.name}"
                    width="100"
                    height="80"
                    loading="lazy"
                    onerror="handleImageError(this)"
                >
            </div>
            <div class="card__body">
                <h3 class="card__name">${item.name}</h3>
                <p class="card__description">${item.description}</p>
                <div class="card__meta">
                    ${tagsHtml}
                </div>
            </div>
        </article>`;
    }

    // Expose image error handler globally
    window.handleImageError = handleImageError;

    // ============================================
    // Detail Modal
    // ============================================
    function createModal() {
        const modal = document.createElement('div');
        modal.id = 'detail-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal__overlay"></div>
            <div class="modal__content">
                <button class="modal__close" aria-label="Fechar">✕</button>
                <div class="modal__inner">
                    <div class="modal__image-area">
                        <img class="modal__image" src="" alt="" onerror="handleImageError(this)">
                    </div>
                    <div class="modal__info">
                        <div class="modal__type-badge"></div>
                        <h2 class="modal__title"></h2>
                        <p class="modal__description"></p>
                        <div class="modal__details"></div>
                        <div class="modal__tags"></div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        DOM.modal = modal;

        // Close events
        modal.querySelector('.modal__overlay').addEventListener('click', closeModal);
        modal.querySelector('.modal__close').addEventListener('click', closeModal);
    }

    function openModal(itemId) {
        const item = catalogData.find(a => a.id === itemId);
        if (!item || !DOM.modal) return;

        const typeClass = getTypeCssClass(item.type);
        const typeColors = { mark: '#a78bfa', badge: '#60a5fa', stripe: '#34d399' };

        const modal = DOM.modal;
        modal.setAttribute('data-type', typeClass);
        modal.classList.add('modal--' + typeClass);
        const modalImage = modal.querySelector('.modal__image');
        const imageSources = getImageSourceSet(item);
        modalImage.src = imageSources[0] || FALLBACK_SVG;
        modalImage.dataset.fallbackSources = JSON.stringify(imageSources.slice(1));
        modalImage.alt = item.name;
        modal.querySelector('.modal__title').textContent = item.name;
        modal.querySelector('.modal__description').textContent = item.description;

        const typeBadge = modal.querySelector('.modal__type-badge');
        typeBadge.textContent = getTypeLabel(item.type);
        typeBadge.style.color = typeColors[typeClass] || '#d4a843';
        typeBadge.style.borderColor = typeColors[typeClass] || '#d4a843';

        // Build details
        let detailsHtml = '';
        const objective = getNumericObjective(item);
        if (objective !== null) {
            detailsHtml += `<div class="modal__detail"><span class="modal__detail-label">Objetivo:</span><span class="modal__detail-value">${objective.toLocaleString('pt-BR')}</span></div>`;
        }
        if (item.mode) {
            detailsHtml += `<div class="modal__detail"><span class="modal__detail-label">Modo:</span><span class="modal__detail-value">${item.mode}</span></div>`;
        }
        if (item.operationRaw) {
            detailsHtml += `<div class="modal__detail"><span class="modal__detail-label">Operação:</span><span class="modal__detail-value">${item.operationRaw}</span></div>`;
        }
        if (item.weapon) {
            detailsHtml += `<div class="modal__detail"><span class="modal__detail-label">Arma:</span><span class="modal__detail-value">${item.weapon}</span></div>`;
        }
        if (item.class) {
            detailsHtml += `<div class="modal__detail"><span class="modal__detail-label">Classe:</span><span class="modal__detail-value">${item.class}</span></div>`;
        }
        if (item.mapRaw || item.map) {
            detailsHtml += `<div class="modal__detail"><span class="modal__detail-label">Mapa:</span><span class="modal__detail-value">${item.mapRaw || item.map}</span></div>`;
        }
        const goldDetailLabel = getGoldDetailLabel(item);
        if (goldDetailLabel) {
            detailsHtml += `<div class="modal__detail"><span class="modal__detail-label">Tipo:</span><span class="modal__detail-value gold-text">${goldDetailLabel}</span></div>`;
        }
        modal.querySelector('.modal__details').innerHTML = detailsHtml;

        // Build tags
        const tagsHtml = (item.tags || []).map(t => `<span class="modal__tag">${t}</span>`).join('');
        modal.querySelector('.modal__tags').innerHTML = tagsHtml;

        // Show
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        if (DOM.modal) {
            DOM.modal.classList.remove('active', 'modal--mark', 'modal--badge', 'modal--stripe');
            document.body.style.overflow = '';
        }
    }

    // ============================================
    // Filtering Logic
    // ============================================
    // Helper: check if an item has a specific tag
    function hasTag(item, tag) {
        return item.tags && item.tags.some(t => t.toLowerCase() === tag.toLowerCase());
    }

    function resolveOperationAlias(searchTerm) {
        if (!filterCore || typeof filterCore.resolveSpecOpsOperationName !== 'function') {
            return null;
        }

        return filterCore.resolveSpecOpsOperationName(searchTerm);
    }

    function buildFilterOptions(searchTerm) {
        const resolvedOperationName = resolveOperationAlias(searchTerm);
        const descriptionOnlySearch = state.activeCategory === 'specops'
            || state.mainFilter === 'pve'
            || Boolean(resolvedOperationName);

        return {
            mainFilter: state.mainFilter,
            armasFilter: state.armasFilter,
            colorFilter: state.colorFilter,
            searchTerm,
            resolvedOperationName,
            descriptionOnlySearch,
            hideEmpty: state.hideEmpty,
            showOnlyEmpty: state.showOnlyEmpty,
        };
    }

    function getFilteredData() {
        let data = [...catalogData];

        switch (state.activeCategory) {
            case 'stripes':
                data = data.filter(isRibbon);
                break;
            case 'badges':
                data = data.filter(a => getCanonicalType(a.type) === 'insignia');
                break;
            case 'marks':
                data = data.filter(a => getCanonicalType(a.type) === 'marca');
                break;
            case 'gold':
                data = data.filter(isGoldCategoryItem);
                break;
            case 'specops':
                data = data.filter(isSpecialOperationItem);
                break;
        }

        return filterCore.filterItems(data, buildFilterOptions(state.searchQuery));
    }

    let currentRenderData = [];
    let currentRenderIndex = 0;
    const LOAD_BATCH_SIZE = 80;
    let isRenderingGrid = false;

    function renderGrid(reset = true) {
        if (reset) {
            currentRenderData = getFilteredData();
            currentRenderIndex = 0;
            DOM.achievementsGrid.innerHTML = '';
        }

        if (currentRenderData.length === 0) {
            showGridEmptyState();
            return;
        }

        hideGridEmptyState();

        const nextBatch = currentRenderData.slice(currentRenderIndex, currentRenderIndex + LOAD_BATCH_SIZE);
        if (nextBatch.length > 0) {
            renderGridBatch(nextBatch, currentRenderIndex);
            currentRenderIndex += nextBatch.length;
        }

        if (reset) {
            setResultsCount(currentRenderData.length);
        }
    }

    // Infinite Scroll
    window.addEventListener('scroll', () => {
        if (isRenderingGrid) return;
        if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 1200) {
            if (currentRenderIndex < currentRenderData.length) {
                isRenderingGrid = true;
                requestAnimationFrame(() => {
                    renderGrid(false);
                    isRenderingGrid = false;
                });
            }
        }
    });

    // ============================================
    // Ribbons Grid
    // ============================================
    function renderRibbonsGrid() {
        if (!DOM.ribbonsGrid) return;
        let stripes = catalogData.filter(isRibbon);

        stripes = filterCore.filterItems(stripes, buildFilterOptions(state.searchQuery));

        if (state.ribbonFilter === 'gold') {
            stripes = stripes.filter(isGoldRibbon);
        } else if (state.ribbonFilter === 'normal') {
            stripes = stripes.filter(item => !isGoldRibbon(item));
        }

        if (stripes.length === 0) {
            DOM.ribbonsGrid.innerHTML = '<div class="grid__empty"><span class="grid__empty-icon">🎖️</span><h3>Nenhuma fita encontrada</h3></div>';
        } else {
            DOM.ribbonsGrid.innerHTML = stripes.map((item, i) => createCard(item, i)).join('');
        }
    }

    // ============================================
    // Search
    // ============================================
    function handleSearch(query) {
        state.searchQuery = query;

        if (query.length >= 2) {
            DOM.searchClear.classList.add('visible');
            showSearchResults(query);
        } else {
            DOM.searchClear.classList.remove('visible');
            DOM.searchResults.classList.remove('active');
        }

        renderGrid(true);
        renderRibbonsGrid();
    }

    function showSearchResults(query) {
        const q = query.toLowerCase();
        let results = [...catalogData];

        switch (state.activeCategory) {
            case 'stripes':
                results = results.filter(isRibbon);
                break;
            case 'badges':
                results = results.filter(a => getCanonicalType(a.type) === 'insignia');
                break;
            case 'marks':
                results = results.filter(a => getCanonicalType(a.type) === 'marca');
                break;
            case 'gold':
                results = results.filter(isGoldCategoryItem);
                break;
            case 'specops':
                results = results.filter(isSpecialOperationItem);
                break;
        }

        results = filterCore.filterItems(results, buildFilterOptions(query)).slice(0, 8);

        if (results.length === 0) {
            DOM.searchResults.innerHTML = `
                <div class="search-result-item search-result-item--empty">
                    <span class="search-no-result-icon">🔍</span>
                    <div class="search-result-item__info">
                        <span class="search-result-item__name">Nenhum resultado para "${escapeHtml(query)}"</span>
                        <span class="search-result-item__meta">Tente buscar por nome, mapa ou operação</span>
                    </div>
                </div>`;
        } else {
            DOM.searchResults.innerHTML = results.map(item => {
                const typeClass = getTypeCssClass(item.type);
                const imageSources = getImageSourceSet(item);
                return `
                <div class="search-result-item" onclick="scrollToAchievement('${item.id}')">
                    <img class="search-result-item__img" src="${imageSources[0] || FALLBACK_SVG}"
                         data-fallback-sources='${JSON.stringify(imageSources.slice(1)).replace(/'/g, '&#39;')}'
                         alt="${item.name}"
                         onerror="handleImageError(this)"
                         width="44" height="44" loading="lazy">
                    <div class="search-result-item__info">
                        <div class="search-result-item__name">${highlightMatch(item.name, q)}</div>
                        <div class="search-result-item__meta">${(item.tags || []).join(' • ')}</div>
                    </div>
                    <span class="search-result-item__type search-result-item__type--${typeClass}">${getTypeLabel(item.type)}</span>
                </div>`;
            }).join('');
        }

        DOM.searchResults.classList.add('active');
    }

    function highlightMatch(text, query) {
        if (!query) return text;
        const idx = text.toLowerCase().indexOf(query);
        if (idx === -1) return text;
        return text.substring(0, idx) + 
               '<mark>' + text.substring(idx, idx + query.length) + '</mark>' + 
               text.substring(idx + query.length);
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), wait);
        };
    }

    function clearSearch() {
        DOM.globalSearch.value = '';
        state.searchQuery = '';
        DOM.searchClear.classList.remove('visible');
        DOM.searchResults.classList.remove('active');
        renderGrid(true);
        renderRibbonsGrid();
    }

    // ============================================
    // Category Tabs
    // ============================================
    function setActiveCategory(category) {
        state.activeCategory = category;

        $$('.tabs__btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.category === category);
        });

        refreshGridForCurrentCategory();
        scrollToGrid();
    }

    // ============================================
    // Ribbon Filters
    // ============================================
    function setRibbonFilter(filter) {
        state.ribbonFilter = filter;
        $$('.ribbons-filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.ribbon === filter);
        });
        renderRibbonsGrid();
    }

    // ============================================
    // Event Bindings
    // ============================================
    function bindEvents() {
        // Theme toggle
        DOM.themeToggle.addEventListener('click', toggleTheme);

        // Mobile menu
        DOM.mobileToggle.addEventListener('click', () => {
            DOM.mainNav.classList.toggle('open');
            DOM.mobileToggle.classList.toggle('active');
        });

        // Search
        const debouncedSearch = debounce((v) => handleSearch(v), 300);
        DOM.globalSearch.addEventListener('input', (e) => debouncedSearch(e.target.value));
        DOM.searchClear.addEventListener('click', clearSearch);

        // Close search results on click outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.hero__search')) {
                DOM.searchResults.classList.remove('active');
            }
        });

        // Category tabs
        $$('.tabs__btn').forEach(btn => {
            btn.addEventListener('click', () => setActiveCategory(btn.dataset.category));
        });

        // Ribbon filters
        $$('.ribbons-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => setRibbonFilter(btn.dataset.ribbon));
        });

        // Filter selects
        DOM.filterMain.addEventListener('change', (e) => {
            state.mainFilter = e.target.value;
            refreshGridForCurrentCategory();
            renderRibbonsGrid();
        });
        DOM.filterArmas.addEventListener('change', (e) => {
            state.armasFilter = e.target.value;
            renderGrid(true);
            renderRibbonsGrid();
        });
        DOM.filterColor.addEventListener('change', (e) => {
            state.colorFilter = e.target.value;
            renderGrid(true);
            renderRibbonsGrid();
        });

        safeToggleFilterGroup();

        // Card click -> open modal
        document.addEventListener('click', (e) => {
            const card = e.target.closest('.card');
            if (card && card.dataset.id) {
                openModal(card.dataset.id);
            }
        });

        // Card keyboard enter -> open modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.target.classList.contains('card')) {
                openModal(e.target.dataset.id);
            }
        });

        // Scroll effects
        let ticking = false;
        window.addEventListener('scroll', () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    handleScroll();
                    ticking = false;
                });
                ticking = true;
            }
        });

        // Scroll to top
        DOM.scrollTop.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        // Nav links - close mobile menu
        $$('.header__nav-link').forEach(link => {
            link.addEventListener('click', () => {
                DOM.mainNav.classList.remove('open');
                DOM.mobileToggle.classList.remove('active');
            });
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === '/' && !e.target.closest('input,textarea,select')) {
                e.preventDefault();
                DOM.globalSearch.focus();
            }
            if (e.key === 'Escape') {
                if (DOM.modal && DOM.modal.classList.contains('active')) {
                    closeModal();
                } else {
                    clearSearch();
                    DOM.globalSearch.blur();
                }
            }
        });
    }

    function handleScroll() {
        const scrollY = window.scrollY;

        // Header shadow
        DOM.header.classList.toggle('scrolled', scrollY > 50);

        // Scroll-to-top button
        DOM.scrollTop.classList.toggle('visible', scrollY > 600);

        // Active nav link based on section
        const sections = ['hero', 'achievements', 'ribbons-section', 'about'];
        sections.forEach(id => {
            const section = document.getElementById(id);
            if (section) {
                const rect = section.getBoundingClientRect();
                if (rect.top <= 200 && rect.bottom > 200) {
                    $$('.header__nav-link').forEach(link => {
                        link.classList.toggle('active', link.getAttribute('href') === '#' + id);
                    });
                }
            }
        });
    }

    function hideLoading() {
        if (DOM.gridLoading) {
            DOM.gridLoading.style.display = 'none';
        }
    }

    // ============================================
    // Global Functions (for onclick handlers)
    // ============================================
    window.setCategory = function(cat) {
        setActiveCategory(cat);
        scrollToAchievements();
    };

    window.filterByOperation = function(op) {
        state.searchQuery = '';
        if (DOM.globalSearch) {
            DOM.globalSearch.value = '';
        }
        setActiveCategory('specops');
        renderRibbonsGrid();
        scrollToAchievements();
    };

    window.scrollToAchievement = function(id) {
        DOM.searchResults.classList.remove('active');
        let card = document.querySelector(`[data-id="${id}"]`);

        if (!card) {
            const targetIndex = currentRenderData.findIndex((item) => item.id === id);

            while (targetIndex !== -1 && currentRenderIndex <= targetIndex) {
                renderGrid(false);
            }

            card = document.querySelector(`[data-id="${id}"]`);
        }

        if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            card.classList.add('card--highlight');
            setTimeout(() => card.classList.remove('card--highlight'), 2500);
        }
    };

    // ============================================
    // Boot
    // ============================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
