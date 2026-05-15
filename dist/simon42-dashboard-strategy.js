/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/Registry.ts"
/*!*************************!*\
  !*** ./src/Registry.ts ***!
  \*************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Registry: () => (/* binding */ Registry)
/* harmony export */ });
/* harmony import */ var _utils_debug__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./utils/debug */ "./src/utils/debug.ts");
/* harmony import */ var _utils_localize__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./utils/localize */ "./src/utils/localize.ts");
// ====================================================================
// SIMON42 DASHBOARD STRATEGY - Registry (Singleton)
// ====================================================================
// Central data access layer. Replaces scattered entity filtering across
// multiple JS files with pre-computed Maps and Sets for O(1) lookups.
//
// Usage:
//   Registry.initialize(hass, config);   // once at strategy start
//   Registry.getEntitiesForArea('bad');   // anywhere afterwards
//   Registry.isEntityExcluded('light.x'); // full exclusion check
// ====================================================================


/**
 * Static singleton registry that holds all HA registry data and provides
 * fast lookups. Must be initialized once via Registry.initialize() before
 * any other access.
 *
 * Reads directly from hass.entities/devices/areas (synchronous, no WebSocket
 * calls). All members are static, all maps are built once on initialize().
 */
class Registry {
    // Prevent instantiation
    constructor() { }
    // =====================================================================
    // Initialization
    // =====================================================================
    /**
     * Initialize the registry from hass object and strategy config.
     * Synchronous — reads directly from hass.entities/devices/areas.
     * Idempotent: skips if already initialized.
     */
    static initialize(hass, config) {
        if (Registry._initialized)
            return;
        (0,_utils_debug__WEBPACK_IMPORTED_MODULE_0__.timeStart)('registry-init');
        Registry._hass = hass;
        Registry._config = config;
        // Initialize localization from hass language settings
        (0,_utils_localize__WEBPACK_IMPORTED_MODULE_1__.setupLocalize)(hass);
        // Read registries from hass object (synchronous, no WebSocket)
        Registry._fetchedEntities = Object.values(hass.entities);
        Registry._fetchedDevices = Object.values(hass.devices);
        Registry._fetchedAreas = Object.values(hass.areas);
        // Build exclusion sets FIRST (needed by entity maps for pre-filtering)
        (0,_utils_debug__WEBPACK_IMPORTED_MODULE_0__.timeStart)('registry-buildExclusionSets');
        Registry._buildExclusionSets();
        (0,_utils_debug__WEBPACK_IMPORTED_MODULE_0__.timeEnd)('registry-buildExclusionSets');
        // Build pre-computed Maps/Sets for O(1) lookups (raw + pre-filtered)
        (0,_utils_debug__WEBPACK_IMPORTED_MODULE_0__.timeStart)('registry-buildDeviceMaps');
        Registry._buildDeviceMaps();
        (0,_utils_debug__WEBPACK_IMPORTED_MODULE_0__.timeEnd)('registry-buildDeviceMaps');
        (0,_utils_debug__WEBPACK_IMPORTED_MODULE_0__.timeStart)('registry-buildEntityMaps');
        Registry._buildEntityMaps();
        (0,_utils_debug__WEBPACK_IMPORTED_MODULE_0__.timeEnd)('registry-buildEntityMaps');
        Registry._initialized = true;
        (0,_utils_debug__WEBPACK_IMPORTED_MODULE_0__.debugLog)(`Registry initialized: ${Registry._fetchedEntities.length} entities, ${Registry._fetchedDevices.length} devices, ${Registry._fetchedAreas.length} areas`);
        (0,_utils_debug__WEBPACK_IMPORTED_MODULE_0__.timeEnd)('registry-init');
    }
    // =====================================================================
    // Map building (private)
    // =====================================================================
    // =====================================================================
    // Visibility check (private helper for pre-filtering)
    // =====================================================================
    /**
     * Check if an entity should be visible on the dashboard.
     * Combines all exclusion criteria into a single check:
     * - no_dboard label
     * - Config-hidden (areas_options)
     * - hidden (by user/integration)
     * - entity_category config/diagnostic
     *
     * Note: disabled entities are already excluded from hass.entities.
     */
    static _isEntityVisible(entity) {
        if (Registry._excludeSet.has(entity.entity_id))
            return false;
        if (Registry._hiddenFromConfig.has(entity.entity_id))
            return false;
        if (entity.hidden)
            return false;
        if (entity.entity_category === 'config' || entity.entity_category === 'diagnostic')
            return false;
        return true;
    }
    /**
     * Check if an entity is config or diagnostic category.
     */
    static _isConfigOrDiagnostic(entity) {
        return entity.entity_category === 'config' || entity.entity_category === 'diagnostic';
    }
    // =====================================================================
    // Map building (private)
    // =====================================================================
    /**
     * Build entity lookup maps from fetched registry data and hass.states.
     *
     * Builds both raw maps (for editor/special cases) and pre-filtered maps
     * (for dashboard views/cards). Pre-filtering removes hidden/disabled/
     * excluded entities once during init, eliminating redundant checks downstream.
     *
     * Raw maps:
     * - _entityById, _entitiesByDomain, _entitiesByDevice, _entitiesByArea
     *
     * Pre-filtered maps:
     * - _visibleEntitiesByArea, _visibleEntitiesByDomain, _configDiagEntitiesByArea
     */
    static _buildEntityMaps() {
        const entities = Registry._fetchedEntities;
        // Entity by ID (always raw — needed for individual lookups)
        Registry._entityById = new Map();
        for (const e of entities) {
            Registry._entityById.set(e.entity_id, e);
        }
        // Entities by domain — raw + visible (built from registry, filtered to entities with state)
        Registry._entitiesByDomain = new Map();
        Registry._visibleEntitiesByDomain = new Map();
        for (const e of entities) {
            // Only include entities that have a state (disabled entities don't)
            if (!(e.entity_id in Registry._hass.states))
                continue;
            const dotIndex = e.entity_id.indexOf('.');
            const domain = e.entity_id.substring(0, dotIndex);
            // Raw map (all registry entities with a state)
            if (!Registry._entitiesByDomain.has(domain)) {
                Registry._entitiesByDomain.set(domain, []);
            }
            Registry._entitiesByDomain.get(domain)?.push(e.entity_id);
            // Visible map (pre-filtered)
            if (Registry._isEntityVisible(e)) {
                if (!Registry._visibleEntitiesByDomain.has(domain)) {
                    Registry._visibleEntitiesByDomain.set(domain, []);
                }
                Registry._visibleEntitiesByDomain.get(domain)?.push(e.entity_id);
            }
        }
        // Entities by device (raw only — device grouping is internal)
        Registry._entitiesByDevice = new Map();
        for (const e of entities) {
            if (e.device_id) {
                if (!Registry._entitiesByDevice.has(e.device_id)) {
                    Registry._entitiesByDevice.set(e.device_id, []);
                }
                Registry._entitiesByDevice.get(e.device_id)?.push(e.entity_id);
            }
        }
        // Entities by area — raw + visible + config/diagnostic
        Registry._entitiesByArea = new Map();
        Registry._visibleEntitiesByArea = new Map();
        Registry._configDiagEntitiesByArea = new Map();
        for (const e of entities) {
            const areaId = e.area_id || (e.device_id ? Registry._deviceById.get(e.device_id)?.area_id : undefined);
            if (!areaId)
                continue;
            // Raw map (all entities in area)
            if (!Registry._entitiesByArea.has(areaId)) {
                Registry._entitiesByArea.set(areaId, []);
            }
            Registry._entitiesByArea.get(areaId)?.push(e);
            // Config/diagnostic map (separate bucket)
            if (Registry._isConfigOrDiagnostic(e)) {
                if (!Registry._configDiagEntitiesByArea.has(areaId)) {
                    Registry._configDiagEntitiesByArea.set(areaId, []);
                }
                Registry._configDiagEntitiesByArea.get(areaId)?.push(e);
            }
            // Visible map (pre-filtered — excludes hidden/disabled/labeled/category)
            if (Registry._isEntityVisible(e)) {
                if (!Registry._visibleEntitiesByArea.has(areaId)) {
                    Registry._visibleEntitiesByArea.set(areaId, []);
                }
                Registry._visibleEntitiesByArea.get(areaId)?.push(e);
            }
        }
    }
    /** Build device lookup map from fetched device registry. */
    static _buildDeviceMaps() {
        Registry._deviceById = new Map();
        for (const d of Registry._fetchedDevices) {
            Registry._deviceById.set(d.id, d);
        }
    }
    /**
     * Build exclusion sets from labels and config.
     *
     * Exclusion pipeline (matches the JS data-collectors logic):
     * 1. no_dboard label -> _excludeSet
     * 2. areas_options.*.groups_options.*.hidden -> _hiddenFromConfig
     */
    static _buildExclusionSets() {
        // no_dboard label exclusion
        Registry._excludeSet = new Set();
        for (const e of Registry._fetchedEntities) {
            if (e.labels.includes('no_dboard')) {
                Registry._excludeSet.add(e.entity_id);
            }
        }
        // Hidden from config (areas_options.{areaId}.groups_options.{domain}.hidden)
        Registry._hiddenFromConfig = new Set();
        const areasOptions = Registry._config.areas_options;
        if (areasOptions) {
            for (const areaOpts of Object.values(areasOptions)) {
                if (areaOpts.groups_options) {
                    for (const groupOpts of Object.values(areaOpts.groups_options)) {
                        if (groupOpts.hidden && Array.isArray(groupOpts.hidden)) {
                            for (const id of groupOpts.hidden) {
                                Registry._hiddenFromConfig.add(id);
                            }
                        }
                    }
                }
            }
        }
    }
    // =====================================================================
    // Public accessors — raw data
    // =====================================================================
    /** The Home Assistant instance. */
    static get hass() {
        return Registry._hass;
    }
    /** The strategy configuration. */
    static get config() {
        return Registry._config;
    }
    /** Whether initialize() has been called. */
    static get initialized() {
        return Registry._initialized;
    }
    // =====================================================================
    // Entity lookups
    // =====================================================================
    /** Get entity registry entry by entity_id. O(1). */
    static getEntity(entityId) {
        return Registry._entityById.get(entityId);
    }
    /** Get all entity IDs for a given domain (e.g. "light", "sensor"). O(1). */
    static getEntityIdsForDomain(domain) {
        return Registry._entitiesByDomain.get(domain) || [];
    }
    /**
     * Get all entity registry entries assigned to an area.
     * Includes entities whose device resolves to that area.
     * O(1).
     */
    static getEntitiesForArea(areaId) {
        return Registry._entitiesByArea.get(areaId) || [];
    }
    /** Get all entity IDs belonging to a device. O(1). */
    static getEntityIdsForDevice(deviceId) {
        return Registry._entitiesByDevice.get(deviceId) || [];
    }
    // =====================================================================
    // Pre-filtered entity lookups (visible entities only)
    // =====================================================================
    /**
     * Get visible entity IDs for a domain. O(1).
     * Pre-filtered: no hidden, no_dboard, config/diagnostic, config-hidden.
     */
    static getVisibleEntityIdsForDomain(domain) {
        return Registry._visibleEntitiesByDomain.get(domain) || [];
    }
    /**
     * Get visible entity registry entries for an area. O(1).
     * Pre-filtered: no hidden, no_dboard, config/diagnostic, config-hidden.
     */
    static getVisibleEntitiesForArea(areaId) {
        return Registry._visibleEntitiesByArea.get(areaId) || [];
    }
    /**
     * Get config/diagnostic entities for an area. O(1).
     * Only entities with entity_category = 'config' or 'diagnostic'.
     */
    static getConfigDiagEntitiesForArea(areaId) {
        return Registry._configDiagEntitiesByArea.get(areaId) || [];
    }
    // =====================================================================
    // Device lookups
    // =====================================================================
    /** Get device registry entry by device id. O(1). */
    static getDevice(deviceId) {
        return Registry._deviceById.get(deviceId);
    }
    // =====================================================================
    // Area / Floor accessors
    // =====================================================================
    /** All area registry entries (from hass.areas). */
    static get areas() {
        return Registry._fetchedAreas;
    }
    /** All floor registry entries (from hass — no WS endpoint needed). */
    static get floors() {
        return Object.values(Registry._hass.floors);
    }
    // =====================================================================
    // Exclusion checks
    // =====================================================================
    /** Check if entity is excluded by the "no_dboard" label. */
    static isExcludedByLabel(entityId) {
        return Registry._excludeSet.has(entityId);
    }
    /** Check if entity is hidden via areas_options config. */
    static isHiddenByConfig(entityId) {
        return Registry._hiddenFromConfig.has(entityId);
    }
    /**
     * Full exclusion check combining all filtering criteria.
     *
     * 1. no_dboard label
     * 2. areas_options hidden
     * 3. hidden (by user/integration)
     * 4. entity_category "config" or "diagnostic"
     *
     * Note: disabled entities are already excluded from hass.entities.
     */
    static isEntityExcluded(entityId) {
        if (Registry._excludeSet.has(entityId))
            return true;
        if (Registry._hiddenFromConfig.has(entityId))
            return true;
        const entry = Registry._entityById.get(entityId);
        if (!entry)
            return false; // Entity not in registry — don't exclude
        if (entry.hidden)
            return true;
        if (entry.entity_category === 'config' || entry.entity_category === 'diagnostic')
            return true;
        return false;
    }
    /**
     * Extended exclusion check that also checks entity_category from
     * state attributes as a fallback.
     *
     * Use this for the summary card which works with hass.states keys
     * and may encounter entities where entity_category is only available
     * in state attributes, not the registry.
     */
    static isEntityExcludedWithStateCategory(entityId) {
        if (Registry.isEntityExcluded(entityId))
            return true;
        // Fallback: check entity_category from state attributes
        const state = Registry._hass.states[entityId];
        if (state?.attributes?.entity_category === 'config' || state?.attributes?.entity_category === 'diagnostic') {
            return true;
        }
        return false;
    }
    // =====================================================================
    // Per-group hidden entities
    // =====================================================================
    /**
     * Get set of entity IDs hidden for a specific group key across all areas.
     *
     * Used by summary cards that need per-domain/group filtering from
     * areas_options.*.groups_options.{groupKey}.hidden.
     */
    static getHiddenForGroup(groupKey) {
        const hidden = new Set();
        const areasOptions = Registry._config.areas_options;
        if (!areasOptions)
            return hidden;
        for (const areaOpts of Object.values(areasOptions)) {
            const groupOpts = areaOpts.groups_options?.[groupKey];
            if (groupOpts?.hidden && Array.isArray(groupOpts.hidden)) {
                for (const id of groupOpts.hidden) {
                    hidden.add(id);
                }
            }
        }
        return hidden;
    }
    /**
     * Get set of entity IDs hidden for a specific group in a specific area.
     *
     * Used by room views for area-scoped entity filtering.
     */
    static getHiddenForAreaGroup(areaId, groupKey) {
        const hidden = new Set();
        const groupOpts = Registry._config.areas_options?.[areaId]?.groups_options?.[groupKey];
        if (groupOpts?.hidden && Array.isArray(groupOpts.hidden)) {
            for (const id of groupOpts.hidden) {
                hidden.add(id);
            }
        }
        return hidden;
    }
}
/** Entity IDs grouped by domain prefix (e.g. "light", "sensor") */
Registry._entitiesByDomain = new Map();
/** Visible entity IDs grouped by domain (pre-filtered during init) */
Registry._visibleEntitiesByDomain = new Map();
/** Initialization flag */
Registry._initialized = false;



/***/ },

/***/ "./src/cards/CoversGroupCard.ts"
/*!**************************************!*\
  !*** ./src/cards/CoversGroupCard.ts ***!
  \**************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony import */ var lit__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! lit */ "./node_modules/lit/index.js");
/* harmony import */ var _Registry__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../Registry */ "./src/Registry.ts");
/* harmony import */ var _utils_debug__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../utils/debug */ "./src/utils/debug.ts");
/* harmony import */ var _utils_localize__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../utils/localize */ "./src/utils/localize.ts");
// ====================================================================
// COVERS GROUP CARD — Reactive card for open/closed cover groups (LitElement)
// ====================================================================




// Pre-compiled RegExps for cover type name stripping
const COVER_TERMS = [
    'Rollo',
    'Rollladen',
    'Jalousie',
    'Vorhang',
    'Gardine',
    'Rolladen',
    'Beschattung',
    'Raffstore',
    'Fenster',
    'Cover',
    'Blind',
    'Curtain',
    'Shade',
    'Shutter',
    'Window',
    'Markise',
    'Awning',
];
const COVER_TERM_REGEXPS = COVER_TERMS.map((term) => new RegExp(`^${term}\\s+|\\s+${term}$`, 'gi'));
const DEFAULT_DEVICE_CLASSES = ['awning', 'blind', 'curtain', 'shade', 'shutter', 'window'];
class Simon42CoversGroupCard extends lit__WEBPACK_IMPORTED_MODULE_0__.LitElement {
    constructor() {
        super(...arguments);
        this._cachedFilteredIds = null;
        this._lastCoversList = '';
        // Reusable card pool
        this._tileCards = new Map();
        this._headingCard = null;
    }
    setConfig(config) {
        this._config = config;
        this._deviceClasses = config.device_classes || DEFAULT_DEVICE_CLASSES;
    }
    willUpdate(changedProps) {
        if (!changedProps.has('hass') || !this.hass)
            return;
        (0,_utils_debug__WEBPACK_IMPORTED_MODULE_2__.trackHassUpdate)('covers-group');
        const oldHass = changedProps.get('hass');
        if (!oldHass || oldHass.entities !== this.hass.entities) {
            this._cachedFilteredIds = null;
        }
        // Build cache if needed
        if (!this._cachedFilteredIds) {
            if (!_Registry__WEBPACK_IMPORTED_MODULE_1__.Registry.initialized)
                return;
            this._cachedFilteredIds = new Set(this._getFilteredCoverEntities(this.hass));
        }
        // Always propagate hass to child cards
        this._propagateHass(this.hass);
    }
    _propagateHass(hass) {
        if (this._headingCard)
            this._headingCard.hass = hass;
        for (const card of this._tileCards.values()) {
            card.hass = hass;
        }
    }
    _getFilteredCoverEntities(hass) {
        return _Registry__WEBPACK_IMPORTED_MODULE_1__.Registry.getVisibleEntityIdsForDomain('cover').filter((id) => {
            const state = hass.states[id];
            if (!state)
                return false;
            const deviceClass = state.attributes?.device_class;
            // Covers without device_class only match the main group (multiple classes), not specialized groups like awnings/windows
            if (!deviceClass)
                return this._deviceClasses.length > 1;
            return this._deviceClasses.includes(deviceClass);
        });
    }
    _getRelevantCovers() {
        if (!this.hass || !this._cachedFilteredIds)
            return [];
        const groupType = this._config.group_type;
        const showPartiallyOpen = this._config.show_partially_open === true;
        const relevant = [];
        for (const id of this._cachedFilteredIds) {
            const state = this.hass.states[id];
            if (!state)
                continue;
            const position = state.attributes?.current_position;
            const hasPosition = typeof position === 'number';
            const isMoving = state.state === 'opening' || state.state === 'closing';
            if (groupType === 'partially_open') {
                // Partially open: position between 0 and 100 (open or currently moving)
                if (state.state === 'open' || isMoving) {
                    if (hasPosition && position > 0 && position < 100) {
                        relevant.push(id);
                    }
                }
            }
            else if (groupType === 'open') {
                if (state.state === 'open' || state.state === 'opening') {
                    if (showPartiallyOpen) {
                        // Only fully open (100%) or covers without position attribute
                        if (!hasPosition || position >= 100) {
                            relevant.push(id);
                        }
                    }
                    else {
                        relevant.push(id);
                    }
                }
            }
            else {
                if (state.state === 'closed') {
                    relevant.push(id);
                }
                else if (state.state === 'closing') {
                    // When partially_open is active, closing covers with position > 0 belong to partially_open
                    if (showPartiallyOpen && hasPosition && position > 0)
                        continue;
                    relevant.push(id);
                }
            }
        }
        relevant.sort((a, b) => {
            const stateA = this.hass?.states[a];
            const stateB = this.hass?.states[b];
            if (!stateA || !stateB)
                return 0;
            return new Date(stateB.last_changed).getTime() - new Date(stateA.last_changed).getTime();
        });
        return relevant;
    }
    _stripCoverType(entityId) {
        const state = this.hass?.states[entityId];
        if (!state)
            return entityId;
        let name = state.attributes.friendly_name || entityId;
        for (const regex of COVER_TERM_REGEXPS) {
            regex.lastIndex = 0;
            name = name.replace(regex, '');
        }
        return name.trim() || state.attributes.friendly_name || entityId;
    }
    _buildHeadingConfig(covers) {
        const groupType = this._config.group_type;
        const openText = this._config.batch_open_text || (0,_utils_localize__WEBPACK_IMPORTED_MODULE_3__.localize)('covers.open_all');
        const closeText = this._config.batch_close_text || (0,_utils_localize__WEBPACK_IMPORTED_MODULE_3__.localize)('covers.close_all');
        if (groupType === 'partially_open') {
            const headingLabel = this._config.heading_partial || (0,_utils_localize__WEBPACK_IMPORTED_MODULE_3__.localize)('covers.partially_open');
            return {
                type: 'heading',
                heading: `${headingLabel} (${covers.length})`,
                icon: 'mdi:blinds-horizontal',
                badges: [
                    {
                        type: 'button',
                        icon: 'mdi:arrow-up',
                        text: openText,
                        tap_action: {
                            action: 'perform-action',
                            perform_action: 'cover.open_cover',
                            target: { entity_id: covers },
                        },
                    },
                    {
                        type: 'button',
                        icon: 'mdi:arrow-down',
                        text: closeText,
                        tap_action: {
                            action: 'perform-action',
                            perform_action: 'cover.close_cover',
                            target: { entity_id: covers },
                        },
                    },
                ],
            };
        }
        const isOpen = groupType === 'open';
        const headingLabel = isOpen
            ? (this._config.heading_open || (0,_utils_localize__WEBPACK_IMPORTED_MODULE_3__.localize)('covers.open'))
            : (this._config.heading_closed || (0,_utils_localize__WEBPACK_IMPORTED_MODULE_3__.localize)('covers.closed'));
        return {
            type: 'heading',
            heading: `${headingLabel} (${covers.length})`,
            icon: isOpen ? 'mdi:blinds-horizontal' : 'mdi:blinds',
            badges: [
                {
                    type: 'button',
                    icon: isOpen ? 'mdi:arrow-down' : 'mdi:arrow-up',
                    text: isOpen ? closeText : openText,
                    tap_action: {
                        action: 'perform-action',
                        perform_action: isOpen ? 'cover.close_cover' : 'cover.open_cover',
                        target: { entity_id: covers },
                    },
                },
            ],
        };
    }
    _getOrCreateTileCard(entityId) {
        let card = this._tileCards.get(entityId);
        if (card)
            return card;
        card = document.createElement('hui-tile-card');
        card.hass = this.hass;
        card.setConfig({
            type: 'tile',
            entity: entityId,
            name: this._stripCoverType(entityId),
            features: [{ type: 'cover-open-close' }],
            vertical: false,
            features_position: 'inline',
            state_content: ['current_position', 'last_changed'],
        });
        this._tileCards.set(entityId, card);
        return card;
    }
    _calculateRenderKey(covers) {
        return covers
            .map((id) => {
            const state = this.hass?.states[id];
            if (!state)
                return id;
            const position = state.attributes?.current_position;
            if (typeof position === 'number') {
                return `${id}:${state.state}:${position}`;
            }
            return `${id}:${state.state}`;
        })
            .join(',');
    }
    render() {
        if (!this.hass || !this._cachedFilteredIds)
            return lit__WEBPACK_IMPORTED_MODULE_0__.nothing;
        const covers = this._getRelevantCovers();
        this.hidden = covers.length === 0;
        return (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `
      <div class="covers-section">
        <div id="heading"></div>
        <div class="cover-grid" id="grid"></div>
      </div>
    `;
    }
    updated(changedProps) {
        super.updated(changedProps);
        if (!this.hass || !this._cachedFilteredIds)
            return;
        const covers = this._getRelevantCovers();
        const coversKey = this._calculateRenderKey(covers);
        if (this._lastCoversList === coversKey)
            return;
        this._lastCoversList = coversKey;
        if (covers.length === 0) {
            const headingSlot = this.shadowRoot?.getElementById('heading');
            if (headingSlot)
                headingSlot.innerHTML = '';
            const grid = this.shadowRoot?.getElementById('grid');
            if (grid)
                grid.innerHTML = '';
            this._headingCard = null;
            this._tileCards.clear();
            this._lastCoversList = '';
            return;
        }
        // Reconcile heading card
        const headingSlot = this.shadowRoot?.getElementById('heading');
        if (headingSlot) {
            if (!this._headingCard) {
                this._headingCard = document.createElement('hui-heading-card');
                headingSlot.appendChild(this._headingCard);
            }
            this._headingCard.hass = this.hass;
            this._headingCard.setConfig(this._buildHeadingConfig(covers));
        }
        // Reconcile tile cards in grid
        const grid = this.shadowRoot?.getElementById('grid');
        if (!grid)
            return;
        const activeIds = new Set(covers);
        // Remove cards for entities no longer in the list
        for (const [id, card] of this._tileCards) {
            if (!activeIds.has(id)) {
                if (card.parentNode === grid)
                    grid.removeChild(card);
                this._tileCards.delete(id);
            }
        }
        // Add/reorder cards to match the desired order
        let prevNode = null;
        for (const entityId of covers) {
            const card = this._getOrCreateTileCard(entityId);
            const nextSibling = prevNode ? prevNode.nextSibling : grid.firstChild;
            if (card !== nextSibling) {
                grid.insertBefore(card, nextSibling);
            }
            prevNode = card;
        }
        // Remove trailing stale nodes
        while (prevNode && prevNode.nextSibling) {
            grid.removeChild(prevNode.nextSibling);
        }
    }
    getCardSize() {
        const covers = this._getRelevantCovers();
        return Math.ceil(covers.length / 3) + 1;
    }
}
Simon42CoversGroupCard.properties = {
    hass: { attribute: false },
};
Simon42CoversGroupCard.styles = (0,lit__WEBPACK_IMPORTED_MODULE_0__.css) `
    :host {
      display: block;
    }
    :host([hidden]) {
      display: none;
    }
    .covers-section {
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: 100%;
    }
    .cover-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 8px;
    }
  `;
customElements.define('simon42-covers-group-card', Simon42CoversGroupCard);


/***/ },

/***/ "./src/cards/LightsGroupCard.ts"
/*!**************************************!*\
  !*** ./src/cards/LightsGroupCard.ts ***!
  \**************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony import */ var lit__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! lit */ "./node_modules/lit/index.js");
/* harmony import */ var _Registry__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../Registry */ "./src/Registry.ts");
/* harmony import */ var _utils_debug__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../utils/debug */ "./src/utils/debug.ts");
/* harmony import */ var _utils_localize__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../utils/localize */ "./src/utils/localize.ts");
/* harmony import */ var _utils_name_utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../utils/name-utils */ "./src/utils/name-utils.ts");
// ====================================================================
// LIGHTS GROUP CARD — Reactive card for on/off light groups (LitElement)
// ====================================================================





const LIGHT_BRIGHTNESS_MODES = ['brightness', 'color_temp', 'hs', 'xy', 'rgb', 'rgbw', 'rgbww', 'white'];
class Simon42LightsGroupCard extends lit__WEBPACK_IMPORTED_MODULE_0__.LitElement {
    constructor() {
        super(...arguments);
        this._cachedSourceIds = null;
        this._cachedAreaForEntity = null;
        this._lastLightsList = '';
        // Reusable tile card pool (keyed by entity_id)
        this._tileCards = new Map();
        this._headingCard = null;
        this._floorHeadingCards = new Map();
        this._groupContainers = new Map();
        this._groupExpansion = new Map();
    }
    setConfig(config) {
        if (!['on', 'off', 'all'].includes(config.group_type)) {
            throw new Error('You need to define group_type (on/off/all)');
        }
        this._config = config;
    }
    willUpdate(changedProps) {
        if (!changedProps.has('hass') || !this.hass)
            return;
        (0,_utils_debug__WEBPACK_IMPORTED_MODULE_2__.trackHassUpdate)('lights-group');
        const oldHass = changedProps.get('hass');
        if (!oldHass || oldHass.entities !== this.hass.entities) {
            this._cachedSourceIds = null;
            this._cachedAreaForEntity = null;
        }
        // Build cache if needed
        if (!this._cachedSourceIds) {
            if (!_Registry__WEBPACK_IMPORTED_MODULE_1__.Registry.initialized)
                return;
            this._cachedSourceIds = new Set(this._getSourceLightEntities());
        }
        // Always propagate hass to child cards
        this._propagateHass(this.hass);
    }
    _propagateHass(hass) {
        if (this._headingCard)
            this._headingCard.hass = hass;
        for (const card of this._tileCards.values()) {
            card.hass = hass;
        }
    }
    _getState(entityId) {
        if (!this.hass)
            return undefined;
        const state = Reflect.get(this.hass.states, entityId);
        return state;
    }
    _getSourceLightEntities() {
        if (Array.isArray(this._config.entities) && this._config.entities.length > 0) {
            return this._config.entities.filter((id) => id.startsWith('light.') && this._getState(id) !== undefined);
        }
        return _Registry__WEBPACK_IMPORTED_MODULE_1__.Registry.getVisibleEntityIdsForDomain('light').filter((id) => this._getState(id) !== undefined);
    }
    _getRelevantLights(lightIds) {
        if (!this.hass)
            return [];
        const sourceIds = lightIds ? Array.from(lightIds) : Array.from(this._cachedSourceIds || []);
        if (sourceIds.length === 0)
            return [];
        if (this._config.group_type === 'all') {
            return [...sourceIds].sort((a, b) => this._sortByLastChanged(a, b));
        }
        const targetState = this._config.group_type === 'on' ? 'on' : 'off';
        const relevant = [];
        for (const id of sourceIds) {
            const state = this._getState(id);
            if (state && state.state === targetState)
                relevant.push(id);
        }
        return relevant.sort((a, b) => this._sortByLastChanged(a, b));
    }
    _sortByLastChanged(a, b) {
        const stateA = this._getState(a);
        const stateB = this._getState(b);
        if (!stateA || !stateB)
            return 0;
        return new Date(stateB.last_changed).getTime() - new Date(stateA.last_changed).getTime();
    }
    _getAreaForEntity(entityId) {
        if (!this._cachedAreaForEntity) {
            this._cachedAreaForEntity = new Map();
        }
        if (this._cachedAreaForEntity.has(entityId)) {
            return this._cachedAreaForEntity.get(entityId) ?? null;
        }
        const entity = _Registry__WEBPACK_IMPORTED_MODULE_1__.Registry.getEntity(entityId);
        let areaId = entity?.area_id ?? null;
        if (!areaId && entity?.device_id) {
            const device = _Registry__WEBPACK_IMPORTED_MODULE_1__.Registry.getDevice(entity.device_id);
            areaId = device?.area_id ?? null;
        }
        this._cachedAreaForEntity.set(entityId, areaId);
        return areaId;
    }
    _getDisplayName(entityId) {
        if (!this.hass)
            return undefined;
        if (this._config.area) {
            return (0,_utils_name_utils__WEBPACK_IMPORTED_MODULE_4__.stripAreaName)(entityId, this._config.area, this.hass);
        }
        return undefined;
    }
    _getGroupChildIds(entityId, candidateSet) {
        const entityState = this._getState(entityId);
        const members = entityState?.attributes?.entity_id;
        if (!Array.isArray(members))
            return [];
        const childIds = members.filter((id) => typeof id === 'string' && id.startsWith('light.') && id !== entityId && candidateSet.has(id));
        return [...new Set(childIds)].sort((a, b) => this._sortByLastChanged(a, b));
    }
    _collectDescendants(entityId, rawChildren, descendantCache, visiting) {
        const cached = descendantCache.get(entityId);
        if (cached)
            return cached;
        if (visiting.has(entityId))
            return new Set();
        visiting.add(entityId);
        const descendants = new Set();
        for (const childId of rawChildren.get(entityId) || []) {
            descendants.add(childId);
            for (const nestedId of this._collectDescendants(childId, rawChildren, descendantCache, visiting)) {
                descendants.add(nestedId);
            }
        }
        visiting.delete(entityId);
        descendantCache.set(entityId, descendants);
        return descendants;
    }
    _buildHierarchy(lightIds) {
        if (this._config.nested_groups !== true) {
            const nodes = new Map();
            for (const entityId of lightIds) {
                nodes.set(entityId, { entityId, childIds: [] });
            }
            return { topLevelIds: [...lightIds], nodes };
        }
        const candidateSet = new Set(lightIds);
        const rawChildren = new Map();
        for (const entityId of lightIds) {
            rawChildren.set(entityId, this._getGroupChildIds(entityId, candidateSet));
        }
        const descendantCache = new Map();
        const nodes = new Map();
        const allNestedChildIds = new Set();
        for (const entityId of lightIds) {
            const directChildIds = rawChildren.get(entityId) || [];
            const prunedChildIds = directChildIds.filter((childId) => {
                return !directChildIds.some((siblingId) => {
                    if (siblingId === childId)
                        return false;
                    return this._collectDescendants(siblingId, rawChildren, descendantCache, new Set()).has(childId);
                });
            });
            nodes.set(entityId, { entityId, childIds: prunedChildIds });
            for (const childId of prunedChildIds) {
                allNestedChildIds.add(childId);
            }
        }
        const topLevelIds = lightIds
            .filter((entityId) => !allNestedChildIds.has(entityId))
            .sort((a, b) => this._sortByLastChanged(a, b));
        return { topLevelIds, nodes };
    }
    _groupByFloors(lights) {
        if (!this.hass)
            return [];
        const areas = Object.values(this.hass.areas);
        const areaFloorMap = new Map();
        for (const area of areas) {
            areaFloorMap.set(area.area_id, area.floor_id ?? null);
        }
        // Partition lights by floor
        const floorMap = new Map();
        for (const id of lights) {
            const areaId = this._getAreaForEntity(id);
            const floorId = areaId ? (areaFloorMap.get(areaId) ?? null) : null;
            if (!floorMap.has(floorId))
                floorMap.set(floorId, []);
            floorMap.get(floorId)?.push(id);
        }
        // Use HA's floor order from the registry. The hass.floors object preserves
        // the user-defined order from HA's "Reorder areas and floors" dialog via
        // Object.keys() insertion order — no separate sort_order field needed.
        const floors = this.hass.floors;
        const floorOrder = Object.keys(floors);
        const sortedKeys = [
            ...floorOrder.filter((id) => floorMap.has(id)),
            ...(floorMap.has(null) ? [null] : []),
        ];
        return sortedKeys.map((floorId) => {
            const floor = floorId ? floors[floorId] : null;
            return {
                floorId,
                floorName: floor?.name || (0,_utils_localize__WEBPACK_IMPORTED_MODULE_3__.localize)('lights.floor_other'),
                floorIcon: floor?.icon || 'mdi:home-outline',
                lights: floorMap.get(floorId) ?? [],
            };
        });
    }
    _getFloorDomKey(floorId) {
        return floorId ?? '_none';
    }
    _buildHeadingConfig(lights, label, icon) {
        const isOn = this._config.group_type === 'on';
        const isAll = this._config.group_type === 'all';
        const heading = label
            ? `${label} (${lights.length})`
            : `${isAll ? (this._config.heading_label || (0,_utils_localize__WEBPACK_IMPORTED_MODULE_3__.localize)('room.lighting')) : (isOn ? (0,_utils_localize__WEBPACK_IMPORTED_MODULE_3__.localize)('lights.on') : (0,_utils_localize__WEBPACK_IMPORTED_MODULE_3__.localize)('lights.off'))} (${lights.length})`;
        const badges = lights.length === 0
            ? []
            : [
                {
                    type: 'button',
                    icon: 'mdi:lightbulb-on',
                    text: (0,_utils_localize__WEBPACK_IMPORTED_MODULE_3__.localize)('lights.all_on'),
                    tap_action: {
                        action: 'perform-action',
                        perform_action: 'light.turn_on',
                        target: { entity_id: lights },
                    },
                    visibility: [{ condition: 'or', conditions: lights.map((entity) => ({ condition: 'state', entity, state: 'off' })) }],
                },
                {
                    type: 'button',
                    icon: 'mdi:lightbulb-off',
                    text: (0,_utils_localize__WEBPACK_IMPORTED_MODULE_3__.localize)('lights.all_off'),
                    tap_action: {
                        action: 'perform-action',
                        perform_action: 'light.turn_off',
                        target: { entity_id: lights },
                    },
                    visibility: [{ condition: 'or', conditions: lights.map((entity) => ({ condition: 'state', entity, state: 'on' })) }],
                },
            ];
        return {
            type: 'heading',
            heading,
            icon: icon ||
                this._config.heading_icon ||
                (isAll ? 'mdi:lightbulb-group' : isOn ? 'mdi:lightbulb-group' : 'mdi:lightbulb-group-off'),
            badges,
        };
    }
    _getOrCreateTileCard(entityId) {
        const existingCard = this._tileCards.get(entityId);
        if (existingCard)
            return existingCard;
        const card = document.createElement('hui-tile-card');
        card.hass = this.hass;
        const cardConfig = { type: 'tile', entity: entityId, vertical: false, state_content: 'last_changed' };
        const displayName = this._getDisplayName(entityId);
        if (displayName) {
            cardConfig.name = displayName;
        }
        const state = this._getState(entityId);
        const modes = state?.attributes?.supported_color_modes;
        const hasBrightness = modes?.some((m) => LIGHT_BRIGHTNESS_MODES.includes(m)) || false;
        if (this._config.group_type !== 'off' && hasBrightness) {
            // Keep the slider on supported lights in all interactive views.
            // HA handles disabled/irrelevant controls for unsupported runtime states.
            cardConfig.features = [{ type: 'light-brightness' }];
            cardConfig.features_position = 'inline';
        }
        card.setConfig(cardConfig);
        card.dataset.entityId = entityId;
        this._tileCards.set(entityId, card);
        return card;
    }
    _isExpanded(entityId) {
        return this._groupExpansion.get(entityId) ?? (this._config.default_expanded === true);
    }
    _getOrCreateGroupContainer(entityId) {
        let container = this._groupContainers.get(entityId);
        if (container)
            return container;
        container = document.createElement('div');
        container.className = 'group-block';
        container.dataset.entityId = entityId;
        const groupHeader = document.createElement('div');
        groupHeader.className = 'group-header';
        const toggleButton = document.createElement('button');
        toggleButton.className = 'group-toggle';
        toggleButton.type = 'button';
        toggleButton.setAttribute('aria-expanded', 'false');
        const toggleIcon = document.createElement('ha-icon');
        toggleIcon.setAttribute('icon', 'mdi:chevron-right');
        toggleButton.appendChild(toggleIcon);
        const groupCardHost = document.createElement('div');
        groupCardHost.className = 'group-card-slot';
        groupHeader.append(toggleButton, groupCardHost);
        const childContainer = document.createElement('div');
        childContainer.className = 'group-children';
        childContainer.hidden = true;
        container.append(groupHeader, childContainer);
        toggleButton.addEventListener('click', () => {
            const expanded = !this._isExpanded(entityId);
            this._groupExpansion.set(entityId, expanded);
            toggleButton.setAttribute('aria-expanded', String(expanded));
            childContainer.hidden = !expanded;
        });
        this._groupContainers.set(entityId, container);
        return container;
    }
    _resolveHierarchyContainer(entityId, hasChildren) {
        if (hasChildren) {
            return this._getOrCreateGroupContainer(entityId);
        }
        return this._getOrCreateTileCard(entityId);
    }
    _placeHierarchyNode(parentElement, childElement, referenceNode) {
        if (childElement !== referenceNode) {
            parentElement.insertBefore(childElement, referenceNode);
        }
    }
    _syncGroupContainer(groupContainerElement, entityId, childIds, nodes) {
        const groupCardHostElement = groupContainerElement.querySelector('.group-card-slot');
        const groupCard = this._getOrCreateTileCard(entityId);
        if (groupCard.parentNode !== groupCardHostElement) {
            groupCardHostElement.replaceChildren(groupCard);
        }
        const childContainerElement = groupContainerElement.querySelector('.group-children');
        const expanded = this._isExpanded(entityId);
        const toggleButtonElement = groupContainerElement.querySelector('.group-toggle');
        toggleButtonElement.setAttribute('aria-expanded', String(expanded));
        childContainerElement.hidden = !expanded;
        this._reconcileHierarchy(childContainerElement, childIds, nodes);
    }
    _reconcileHierarchy(container, nodeIds, nodes) {
        let previousNode = null;
        for (const entityId of nodeIds) {
            const node = nodes.get(entityId);
            const childIds = node?.childIds || [];
            const hierarchyContainerElement = this._resolveHierarchyContainer(entityId, childIds.length > 0);
            const nextSibling = previousNode ? previousNode.nextSibling : container.firstChild;
            this._placeHierarchyNode(container, hierarchyContainerElement, nextSibling);
            previousNode = hierarchyContainerElement;
            if (childIds.length > 0) {
                this._syncGroupContainer(hierarchyContainerElement, entityId, childIds, nodes);
            }
        }
        while (previousNode && previousNode.nextSibling) {
            container.removeChild(previousNode.nextSibling);
        }
    }
    render() {
        if (!this.hass || !this._cachedSourceIds)
            return lit__WEBPACK_IMPORTED_MODULE_0__.nothing;
        const lights = this._getRelevantLights();
        if (lights.length === 0) {
            this.hidden = true;
            return lit__WEBPACK_IMPORTED_MODULE_0__.nothing;
        }
        this.hidden = false;
        if (this._config.group_by_floors) {
            const floorGroups = this._groupByFloors(lights);
            return (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `
        <div class="lights-section">
          <div id="heading"></div>
          ${floorGroups.map((group) => {
                const floorKey = this._getFloorDomKey(group.floorId);
                return (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `
              <div class="floor-section">
                <div id=${`floor-heading-${floorKey}`}></div>
                <div class="light-grid" id=${`floor-grid-${floorKey}`}></div>
              </div>
            `;
            })}
        </div>
      `;
        }
        return (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `
      <div class="lights-section">
        <div id="heading"></div>
        <div class="light-grid" id="grid"></div>
      </div>
    `;
    }
    _getOrCreateFloorHeadingCard(key) {
        let card = this._floorHeadingCards.get(key);
        if (card)
            return card;
        card = document.createElement('hui-heading-card');
        this._floorHeadingCards.set(key, card);
        return card;
    }
    updated(changedProps) {
        super.updated(changedProps);
        if (!this.hass || !this._cachedSourceIds)
            return;
        const lights = this._getRelevantLights();
        const lightsKey = lights.join(',');
        if (this._lastLightsList === lightsKey)
            return;
        this._lastLightsList = lightsKey;
        if (lights.length === 0)
            return;
        if (this._config.group_by_floors) {
            const floorGroups = this._groupByFloors(lights);
            // Reconcile main heading (total count)
            const headingSlot = this.shadowRoot?.getElementById('heading');
            if (headingSlot) {
                if (!this._headingCard) {
                    this._headingCard = document.createElement('hui-heading-card');
                }
                const mainHeadingCard = this._headingCard;
                headingSlot.appendChild(mainHeadingCard);
                mainHeadingCard.hass = this.hass;
                mainHeadingCard.setConfig(this._buildHeadingConfig(lights));
            }
            // Reconcile per-floor sections
            const allActiveIds = new Set(lights);
            for (const group of floorGroups) {
                const key = group.floorId || '_none';
                const floorHeadingSlot = this.shadowRoot?.getElementById(`floor-heading-${key}`);
                if (floorHeadingSlot) {
                    const headingCard = this._getOrCreateFloorHeadingCard(key);
                    if (!headingCard.parentNode)
                        floorHeadingSlot.appendChild(headingCard);
                    headingCard.hass = this.hass;
                    headingCard.setConfig(this._buildHeadingConfig(group.lights, group.floorName, group.floorIcon));
                }
                const grid = this.shadowRoot?.getElementById(`floor-grid-${key}`);
                if (grid) {
                    const hierarchy = this._buildHierarchy(group.lights);
                    this._reconcileHierarchy(grid, hierarchy.topLevelIds, hierarchy.nodes);
                }
            }
            // Clean up stale pool entries
            for (const [id, card] of this._tileCards) {
                if (!allActiveIds.has(id)) {
                    if (card.parentNode)
                        card.parentNode.removeChild(card);
                    this._tileCards.delete(id);
                }
            }
            for (const [id, container] of this._groupContainers) {
                if (!allActiveIds.has(id)) {
                    if (container.parentNode)
                        container.parentNode.removeChild(container);
                    this._groupContainers.delete(id);
                }
            }
            return;
        }
        // Flat mode (no floor grouping)
        const headingSlot = this.shadowRoot?.getElementById('heading');
        if (headingSlot) {
            if (!this._headingCard) {
                this._headingCard = document.createElement('hui-heading-card');
            }
            const mainHeadingCard = this._headingCard;
            headingSlot.appendChild(mainHeadingCard);
            mainHeadingCard.hass = this.hass;
            mainHeadingCard.setConfig(this._buildHeadingConfig(lights));
        }
        const grid = this.shadowRoot?.getElementById('grid');
        if (!grid)
            return;
        const hierarchy = this._buildHierarchy(lights);
        // Clean up stale pool entries
        const activeIds = new Set(lights);
        for (const [id, card] of this._tileCards) {
            if (!activeIds.has(id)) {
                if (card.parentNode)
                    card.parentNode.removeChild(card);
                this._tileCards.delete(id);
            }
        }
        for (const [id, container] of this._groupContainers) {
            if (!activeIds.has(id)) {
                if (container.parentNode)
                    container.parentNode.removeChild(container);
                this._groupContainers.delete(id);
            }
        }
        this._reconcileHierarchy(grid, hierarchy.topLevelIds, hierarchy.nodes);
    }
    getCardSize() {
        const lights = this._getRelevantLights();
        return Math.ceil(lights.length / 3) + 1;
    }
}
Simon42LightsGroupCard.properties = {
    hass: { attribute: false },
};
Simon42LightsGroupCard.styles = (0,lit__WEBPACK_IMPORTED_MODULE_0__.css) `
    :host {
      display: block;
    }
    :host([hidden]) {
      display: none;
    }
    .lights-section {
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: 100%;
    }
    .light-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 8px;
    }
    .floor-section {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .group-block {
      grid-column: 1 / -1;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px;
      border: 1px solid var(--divider-color);
      border-radius: 16px;
      background: color-mix(in srgb, var(--card-background-color) 92%, var(--primary-color) 8%);
    }
    .group-header {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 8px;
      align-items: start;
    }
    .group-toggle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      margin-top: 6px;
      border: none;
      border-radius: 999px;
      background: var(--secondary-background-color);
      color: var(--primary-text-color);
      cursor: pointer;
      transition: transform 0.2s ease;
    }
    .group-toggle:hover {
      background: color-mix(in srgb, var(--secondary-background-color) 75%, var(--primary-color) 25%);
    }
    .group-toggle ha-icon {
      --mdc-icon-size: 18px;
      transition: transform 0.2s ease;
    }
    .group-toggle[aria-expanded='true'] ha-icon {
      transform: rotate(90deg);
    }
    .group-children {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 8px;
      padding-left: 44px;
    }
    .group-children[hidden] {
      display: none;
    }
  `;
customElements.define('simon42-lights-group-card', Simon42LightsGroupCard);


/***/ },

/***/ "./src/cards/SummaryCard.ts"
/*!**********************************!*\
  !*** ./src/cards/SummaryCard.ts ***!
  \**********************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony import */ var lit__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! lit */ "./node_modules/lit/index.js");
/* harmony import */ var _Registry__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../Registry */ "./src/Registry.ts");
/* harmony import */ var _utils_debug__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../utils/debug */ "./src/utils/debug.ts");
/* harmony import */ var _utils_localize__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../utils/localize */ "./src/utils/localize.ts");
/* harmony import */ var _utils_entity_filter__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../utils/entity-filter */ "./src/utils/entity-filter.ts");
/* harmony import */ var _styles_global_styles__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../styles/global-styles */ "./src/styles/global-styles.ts");
// ====================================================================
// SUMMARY CARD — Reactive summary tile for lights/covers/security/batteries (LitElement)
// ====================================================================






const COVER_DEVICE_CLASSES = new Set(['awning', 'blind', 'curtain', 'shade', 'shutter', 'window']);
const SECURITY_COVER_CLASSES = new Set(['door', 'garage', 'gate', 'window']);
const SECURITY_BINARY_SENSOR_CLASSES = new Set(['door', 'window', 'garage_door', 'opening', 'smoke', 'gas']);
const COLOR_MAP = {
    orange: 'var(--orange-color, #ff9800)',
    purple: 'var(--purple-color, #9c27b0)',
    yellow: 'var(--yellow-color, #ffc107)',
    red: 'var(--red-color, #f44336)',
    grey: 'var(--disabled-color, #bdbdbd)',
};
class Simon42SummaryCard extends lit__WEBPACK_IMPORTED_MODULE_0__.LitElement {
    constructor() {
        super(...arguments);
        this._count = 0;
        this._relevantEntityIds = null;
    }
    setConfig(config) {
        this._config = config;
        this._relevantEntityIds = null;
    }
    connectedCallback() {
        super.connectedCallback();
        (0,_styles_global_styles__WEBPACK_IMPORTED_MODULE_5__.ensureSimon42StrategyGlobalStylesForElement)(this);
    }
    willUpdate(changedProps) {
        if (!changedProps.has('hass') || !this.hass)
            return;
        (0,_utils_debug__WEBPACK_IMPORTED_MODULE_2__.trackHassUpdate)(`summary-${this._config.summary_type}`);
        const oldHass = changedProps.get('hass');
        if (!oldHass || oldHass.entities !== this.hass.entities) {
            this._relevantEntityIds = null;
            (0,_utils_debug__WEBPACK_IMPORTED_MODULE_2__.debugLog)(`summary-${this._config.summary_type}: cache invalidated (registry changed)`);
        }
        const newCount = this._calculateCount();
        if (this._count !== newCount) {
            this._count = newCount;
        }
    }
    _isEntityRelevant(id, _state) {
        return !_Registry__WEBPACK_IMPORTED_MODULE_1__.Registry.isEntityExcludedWithStateCategory(id);
    }
    _getRelevantEntities() {
        if (!this.hass || this._relevantEntityIds)
            return;
        if (!_Registry__WEBPACK_IMPORTED_MODULE_1__.Registry.initialized)
            return;
        const type = this._config.summary_type;
        (0,_utils_debug__WEBPACK_IMPORTED_MODULE_2__.timeStart)(`summary-getRelevant-${type}`);
        const hass = this.hass;
        let result;
        switch (this._config.summary_type) {
            case 'lights':
                result = _Registry__WEBPACK_IMPORTED_MODULE_1__.Registry.getVisibleEntityIdsForDomain('light').filter((id) => hass.states[id] && this._isEntityRelevant(id, hass.states[id]));
                break;
            case 'covers':
                result = _Registry__WEBPACK_IMPORTED_MODULE_1__.Registry.getVisibleEntityIdsForDomain('cover').filter((id) => {
                    const state = hass.states[id];
                    if (!state)
                        return false;
                    if (!this._isEntityRelevant(id, state))
                        return false;
                    const coverDeviceClass = state.attributes?.device_class;
                    if (coverDeviceClass && !COVER_DEVICE_CLASSES.has(coverDeviceClass))
                        return false;
                    return true;
                });
                break;
            case 'security': {
                const lockIds = _Registry__WEBPACK_IMPORTED_MODULE_1__.Registry.getVisibleEntityIdsForDomain('lock');
                const coverIds = _Registry__WEBPACK_IMPORTED_MODULE_1__.Registry.getVisibleEntityIdsForDomain('cover');
                const binarySensorIds = _Registry__WEBPACK_IMPORTED_MODULE_1__.Registry.getVisibleEntityIdsForDomain('binary_sensor');
                result = [];
                for (const id of lockIds) {
                    if (hass.states[id] && this._isEntityRelevant(id, hass.states[id])) {
                        result.push(id);
                    }
                }
                for (const id of coverIds) {
                    const state = hass.states[id];
                    if (!state || !this._isEntityRelevant(id, state))
                        continue;
                    const deviceClass = state.attributes?.device_class;
                    if (deviceClass !== undefined && SECURITY_COVER_CLASSES.has(deviceClass)) {
                        result.push(id);
                    }
                }
                for (const id of binarySensorIds) {
                    const state = hass.states[id];
                    if (!state || !this._isEntityRelevant(id, state))
                        continue;
                    const entry = _Registry__WEBPACK_IMPORTED_MODULE_1__.Registry.getEntity(id);
                    if (entry?.platform && _utils_entity_filter__WEBPACK_IMPORTED_MODULE_4__.SECURITY_EXCLUDED_PLATFORMS.has(entry.platform))
                        continue;
                    const deviceClass = state.attributes?.device_class;
                    if (deviceClass !== undefined && SECURITY_BINARY_SENSOR_CLASSES.has(deviceClass)) {
                        result.push(id);
                    }
                }
                break;
            }
            case 'batteries': {
                result = (0,_utils_entity_filter__WEBPACK_IMPORTED_MODULE_4__.getBatteryEntities)(hass, this._config);
                break;
            }
            case 'climate':
                result = _Registry__WEBPACK_IMPORTED_MODULE_1__.Registry.getVisibleEntityIdsForDomain('climate').filter((id) => hass.states[id] && this._isEntityRelevant(id, hass.states[id]));
                break;
            default:
                result = [];
        }
        this._relevantEntityIds = new Set(result);
        (0,_utils_debug__WEBPACK_IMPORTED_MODULE_2__.debugLog)(`summary-${type}: ${result.length} relevant entities`);
        (0,_utils_debug__WEBPACK_IMPORTED_MODULE_2__.timeEnd)(`summary-getRelevant-${type}`);
    }
    _calculateCount() {
        if (!this.hass)
            return 0;
        this._getRelevantEntities();
        if (!this._relevantEntityIds || this._relevantEntityIds.size === 0)
            return 0;
        const hass = this.hass;
        let count = 0;
        switch (this._config.summary_type) {
            case 'lights':
                for (const id of this._relevantEntityIds) {
                    if (hass.states[id]?.state === 'on')
                        count++;
                }
                return count;
            case 'covers':
                for (const id of this._relevantEntityIds) {
                    const s = hass.states[id]?.state;
                    if (s === 'open' || s === 'opening')
                        count++;
                }
                return count;
            case 'security':
                for (const id of this._relevantEntityIds) {
                    const state = hass.states[id];
                    if (!state)
                        continue;
                    if (id.startsWith('lock.') && state.state === 'unlocked')
                        count++;
                    else if (id.startsWith('cover.') && state.state === 'open')
                        count++;
                    else if (id.startsWith('binary_sensor.') && state.state === 'on')
                        count++;
                }
                return count;
            case 'batteries': {
                const critThreshold = this._config.battery_critical_threshold ?? 20;
                for (const id of this._relevantEntityIds) {
                    const state = hass.states[id];
                    if (!state)
                        continue;
                    if (id.startsWith('binary_sensor.')) {
                        if (state.state === 'on')
                            count++;
                    }
                    else {
                        const unit = state.attributes?.unit_of_measurement;
                        if (unit && unit !== '%')
                            continue;
                        const value = parseFloat(state.state);
                        const isUnavailable = state.state === 'unavailable' || state.state === 'unknown';
                        if (isUnavailable || (!isNaN(value) && value < critThreshold))
                            count++;
                    }
                }
                return count;
            }
            case 'climate':
                for (const id of this._relevantEntityIds) {
                    const s = hass.states[id]?.state;
                    if (s && s !== 'off' && s !== 'unavailable' && s !== 'unknown')
                        count++;
                }
                return count;
            default:
                return 0;
        }
    }
    _getDisplayConfig() {
        const count = this._count;
        const hasItems = count > 0;
        const configs = {
            lights: {
                icon: 'mdi:lamps',
                name: hasItems ? `${count} ${count === 1 ? (0,_utils_localize__WEBPACK_IMPORTED_MODULE_3__.localize)('summary.lights_on_one') : (0,_utils_localize__WEBPACK_IMPORTED_MODULE_3__.localize)('summary.lights_on_many')}` : (0,_utils_localize__WEBPACK_IMPORTED_MODULE_3__.localize)('summary.lights_off'),
                color: hasItems ? 'orange' : 'grey',
                path: 'lights',
            },
            covers: {
                icon: 'mdi:blinds-horizontal',
                name: hasItems ? `${count} ${count === 1 ? (0,_utils_localize__WEBPACK_IMPORTED_MODULE_3__.localize)('summary.covers_open_one') : (0,_utils_localize__WEBPACK_IMPORTED_MODULE_3__.localize)('summary.covers_open_many')}` : (0,_utils_localize__WEBPACK_IMPORTED_MODULE_3__.localize)('summary.covers_closed'),
                color: hasItems ? 'purple' : 'grey',
                path: 'covers',
            },
            security: {
                icon: 'mdi:security',
                name: hasItems ? `${count} ${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_3__.localize)('summary.security_unsafe')}` : (0,_utils_localize__WEBPACK_IMPORTED_MODULE_3__.localize)('summary.security_safe'),
                color: hasItems ? 'yellow' : 'grey',
                path: 'security',
            },
            batteries: {
                icon: hasItems ? 'mdi:battery-alert' : 'mdi:battery-charging',
                name: hasItems ? `${count} ${count === 1 ? (0,_utils_localize__WEBPACK_IMPORTED_MODULE_3__.localize)('summary.batteries_critical_one') : (0,_utils_localize__WEBPACK_IMPORTED_MODULE_3__.localize)('summary.batteries_critical_many')}` : (0,_utils_localize__WEBPACK_IMPORTED_MODULE_3__.localize)('summary.batteries_ok'),
                color: hasItems ? 'red' : 'grey',
                path: 'batteries',
            },
            climate: {
                icon: 'mdi:thermostat',
                name: hasItems ? `${count} ${count === 1 ? (0,_utils_localize__WEBPACK_IMPORTED_MODULE_3__.localize)('summary.climate_active_one') : (0,_utils_localize__WEBPACK_IMPORTED_MODULE_3__.localize)('summary.climate_active_many')}` : (0,_utils_localize__WEBPACK_IMPORTED_MODULE_3__.localize)('summary.climate_off'),
                color: hasItems ? 'orange' : 'grey',
                path: 'climate',
            },
        };
        return configs[this._config.summary_type];
    }
    _handleClick() {
        if (!this.hass)
            return;
        const displayConfig = this._getDisplayConfig();
        this.dispatchEvent(new CustomEvent('hass-action', {
            bubbles: true,
            composed: true,
            detail: {
                config: {
                    tap_action: {
                        action: 'navigate',
                        navigation_path: displayConfig.path,
                    },
                },
                action: 'tap',
            },
        }));
    }
    render() {
        const display = this._getDisplayConfig();
        const colorCss = COLOR_MAP[display.color] || COLOR_MAP.grey;
        return (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `
      <ha-card @click=${() => this._handleClick()}>
        <ha-ripple style="--ha-ripple-color: ${colorCss}"></ha-ripple>
        <ha-icon class="icon" .icon=${display.icon} style="color: ${colorCss}"></ha-icon>
        <div class="name">${display.name}</div>
      </ha-card>
    `;
    }
    getCardSize() {
        return 1;
    }
}
Simon42SummaryCard.properties = {
    hass: { attribute: false },
    _count: { state: true },
};
Simon42SummaryCard.styles = (0,lit__WEBPACK_IMPORTED_MODULE_0__.css) `
    :host {
      display: block;
      cursor: pointer;
    }
    ha-card {
      padding: 12px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: 8px;
      height: 100%;
      box-sizing: border-box;
      background: var(--ha-card-background, var(--card-background-color, #fff));
      border-radius: var(--ha-card-border-radius, 12px);
      overflow: hidden;
    }
    ha-card:active {
      transform: scale(0.97);
      transition: transform 0.1s;
    }
    .icon {
      --mdc-icon-size: 28px;
      transition: color 0.3s;
    }
    .name {
      font-size: 13px;
      font-weight: 500;
      line-height: 1.2;
      color: var(--primary-text-color);
    }
  `;
customElements.define('simon42-summary-card', Simon42SummaryCard);
window.customCards = window.customCards || [];
window.customCards.push({
    type: 'simon42-summary-card',
    name: 'Simon42 Summary Card',
    description: 'Reactive summary card that counts entities dynamically',
});


/***/ },

/***/ "./src/editor/StrategyEditor.ts"
/*!**************************************!*\
  !*** ./src/editor/StrategyEditor.ts ***!
  \**************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony import */ var lit__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! lit */ "./node_modules/lit/index.js");
/* harmony import */ var lit_directives_unsafe_html_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! lit/directives/unsafe-html.js */ "./node_modules/lit/directives/unsafe-html.js");
/* harmony import */ var js_yaml__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! js-yaml */ "./node_modules/js-yaml/dist/js-yaml.mjs");
/* harmony import */ var _types_strategy__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../types/strategy */ "./src/types/strategy.ts");
/* harmony import */ var _utils_localize__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../utils/localize */ "./src/utils/localize.ts");
/* harmony import */ var _utils_badge_utils__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../utils/badge-utils */ "./src/utils/badge-utils.ts");
// ====================================================================
// SIMON42 DASHBOARD STRATEGY - EDITOR (LitElement)
// ====================================================================
// Single-file LitElement editor replacing the previous 4-file
// vanilla HTMLElement + innerHTML pattern.
// ====================================================================






// ====================================================================
// Editor Class
// ====================================================================
class Simon42DashboardStrategyEditor extends lit__WEBPACK_IMPORTED_MODULE_0__.LitElement {
    constructor() {
        super(...arguments);
        // hass is set externally by HA — use a setter, not a Lit property
        this._hass = null;
        this._isUpdatingConfig = false;
        this._config = {};
        this._expandedAreas = new Set();
        this._expandedGroups = new Map();
        // Entity search state (NOT @state — we call requestUpdate manually)
        this._favoriteSearch = '';
        this._roomPinSearch = '';
        // Cache for loaded area entities (avoid re-fetching on every render)
        this._areaEntitiesCache = new Map();
        // Drag state (not reactive — no render needed)
        this._draggedElement = null;
        this._sectionDraggedElement = null;
        // -- Section order drag & drop -----------------------------------------
        this._handleSectionDragStart = (ev) => {
            const dragHandle = ev.target.closest('.drag-handle');
            if (!dragHandle) {
                ev.preventDefault();
                return;
            }
            const item = ev.target.closest('.section-order-item');
            if (!item) {
                ev.preventDefault();
                return;
            }
            item.classList.add('dragging');
            if (ev.dataTransfer) {
                ev.dataTransfer.effectAllowed = 'move';
                ev.dataTransfer.setData('text/plain', item.dataset.sectionKey || '');
            }
            this._sectionDraggedElement = item;
        };
        this._handleSectionDragEnd = (ev) => {
            const item = ev.target.closest('.section-order-item');
            if (item)
                item.classList.remove('dragging');
            const list = this.shadowRoot?.querySelector('#section-order-list');
            if (list) {
                list.querySelectorAll('.section-order-item').forEach((el) => {
                    el.classList.remove('drag-over');
                });
            }
            this._sectionDraggedElement = null;
        };
        this._handleSectionDragOver = (ev) => {
            ev.preventDefault();
            if (ev.dataTransfer)
                ev.dataTransfer.dropEffect = 'move';
            const item = ev.currentTarget;
            if (item !== this._sectionDraggedElement) {
                item.classList.add('drag-over');
            }
        };
        this._handleSectionDragLeave = (ev) => {
            ev.currentTarget.classList.remove('drag-over');
        };
        this._handleSectionDrop = (ev) => {
            ev.stopPropagation();
            ev.preventDefault();
            const dropTarget = ev.currentTarget;
            dropTarget.classList.remove('drag-over');
            if (!this._sectionDraggedElement || this._sectionDraggedElement === dropTarget)
                return;
            const draggedKey = this._sectionDraggedElement.dataset.sectionKey;
            const dropKey = dropTarget.dataset.sectionKey;
            if (!draggedKey || !dropKey)
                return;
            const currentOrder = this._getSectionsOrder();
            const draggedIndex = currentOrder.indexOf(draggedKey);
            const dropIndex = currentOrder.indexOf(dropKey);
            if (draggedIndex === -1 || dropIndex === -1)
                return;
            const newOrder = [...currentOrder];
            newOrder.splice(draggedIndex, 1);
            newOrder.splice(dropIndex, 0, draggedKey);
            this._updateSectionsOrder(newOrder);
        };
        // ====================================================================
        // DRAG AND DROP
        // ====================================================================
        this._handleDragStart = (ev) => {
            const dragHandle = ev.target.closest('.drag-handle');
            if (!dragHandle) {
                ev.preventDefault();
                return;
            }
            const areaItem = ev.target.closest('.area-item');
            if (!areaItem) {
                ev.preventDefault();
                return;
            }
            areaItem.classList.add('dragging');
            if (ev.dataTransfer) {
                ev.dataTransfer.effectAllowed = 'move';
                ev.dataTransfer.setData('text/plain', areaItem.dataset.areaId || '');
            }
            this._draggedElement = areaItem;
        };
        this._handleDragEnd = (ev) => {
            const areaItem = ev.target.closest('.area-item');
            if (areaItem) {
                areaItem.classList.remove('dragging');
            }
            // Remove all drag-over classes
            const areaList = this.shadowRoot.querySelector('#area-list');
            if (areaList) {
                areaList.querySelectorAll('.area-item').forEach((item) => {
                    item.classList.remove('drag-over');
                });
            }
        };
        this._handleDragOver = (ev) => {
            ev.preventDefault();
            ev.dataTransfer.dropEffect = 'move';
            const item = ev.currentTarget;
            if (item !== this._draggedElement) {
                item.classList.add('drag-over');
            }
        };
        this._handleDragLeave = (ev) => {
            ev.currentTarget.classList.remove('drag-over');
        };
        this._handleDrop = (ev) => {
            ev.stopPropagation();
            ev.preventDefault();
            const dropTarget = ev.currentTarget;
            dropTarget.classList.remove('drag-over');
            if (!this._draggedElement || this._draggedElement === dropTarget)
                return;
            const draggedAreaId = this._draggedElement.dataset.areaId;
            const dropAreaId = dropTarget.dataset.areaId;
            if (!draggedAreaId || !dropAreaId)
                return;
            // Compute new order from current config state (NOT from DOM)
            const currentOrder = this._getAreaOrder();
            const draggedIndex = currentOrder.indexOf(draggedAreaId);
            const dropIndex = currentOrder.indexOf(dropAreaId);
            if (draggedIndex === -1 || dropIndex === -1)
                return;
            const newOrder = [...currentOrder];
            newOrder.splice(draggedIndex, 1);
            newOrder.splice(dropIndex, 0, draggedAreaId);
            this._updateAreaOrder(newOrder);
        };
        // ====================================================================
        // ENTITY LIST DRAG & DROP (Favorites / Room Pins)
        // ====================================================================
        this._entityDraggedId = null;
        this._handleEntityDragStart = (ev, _listType) => {
            const item = ev.target.closest('.entity-list-item');
            if (!item) {
                ev.preventDefault();
                return;
            }
            item.classList.add('dragging');
            this._entityDraggedId = item.dataset.entityId || null;
            if (ev.dataTransfer) {
                ev.dataTransfer.effectAllowed = 'move';
                ev.dataTransfer.setData('text/plain', this._entityDraggedId || '');
            }
        };
        this._handleEntityDragEnd = (ev) => {
            const item = ev.target.closest('.entity-list-item');
            if (item)
                item.classList.remove('dragging');
            this._entityDraggedId = null;
        };
        this._handleEntityDragOver = (ev) => {
            ev.preventDefault();
            if (ev.dataTransfer)
                ev.dataTransfer.dropEffect = 'move';
            const item = ev.currentTarget;
            if (item.dataset.entityId !== this._entityDraggedId) {
                item.classList.add('drag-over');
            }
        };
        this._handleEntityDragLeave = (ev) => {
            ev.currentTarget.classList.remove('drag-over');
        };
        this._handleEntityDrop = (ev, listType) => {
            ev.stopPropagation();
            ev.preventDefault();
            const dropTarget = ev.currentTarget;
            dropTarget.classList.remove('drag-over');
            const draggedId = this._entityDraggedId;
            const dropId = dropTarget.dataset.entityId;
            if (!draggedId || !dropId || draggedId === dropId)
                return;
            const currentList = listType === 'favorites'
                ? [...(this._config.favorite_entities || [])]
                : [...(this._config.room_pin_entities || [])];
            const draggedIndex = currentList.indexOf(draggedId);
            const dropIndex = currentList.indexOf(dropId);
            if (draggedIndex === -1 || dropIndex === -1)
                return;
            currentList.splice(draggedIndex, 1);
            currentList.splice(dropIndex, 0, draggedId);
            const key = listType === 'favorites' ? 'favorite_entities' : 'room_pin_entities';
            const newConfig = { ...this._config, [key]: currentList };
            this._config = newConfig;
            this._fireConfigChanged(newConfig);
        };
    }
    // -- Lifecycle --------------------------------------------------------
    set hass(hass) {
        const oldHass = this._hass;
        this._hass = hass;
        if (!oldHass)
            this.requestUpdate();
    }
    setConfig(config) {
        if (this._isUpdatingConfig)
            return;
        this._config = config;
    }
    // -- Dependency check -------------------------------------------------
    _checkSearchCardDependencies() {
        const hasSearchCard = customElements.get('search-card') !== undefined;
        const hasCardTools = customElements.get('card-tools') !== undefined;
        return hasSearchCard && hasCardTools;
    }
    // -- Entity helpers ---------------------------------------------------
    _getAllEntitiesForSelect() {
        if (!this._hass)
            return [];
        const entities = Object.values(this._hass.entities);
        const devices = Object.values(this._hass.devices);
        // Build device-to-area lookup
        const deviceAreaMap = new Map();
        devices.forEach((device) => {
            if (device.area_id) {
                deviceAreaMap.set(device.id, device.area_id);
            }
        });
        const hass = this._hass;
        return Object.keys(hass.states)
            .map((entityId) => {
            const stateObj = hass.states[entityId];
            const entity = entities.find((e) => e.entity_id === entityId);
            let areaId = entity?.area_id;
            if (!areaId && entity?.device_id) {
                areaId = deviceAreaMap.get(entity.device_id) ?? null;
            }
            return {
                entity_id: entityId,
                name: stateObj.attributes?.friendly_name || entityId.split('.')[1].replace(/_/g, ' '),
                area_id: areaId,
                device_area_id: areaId,
            };
        })
            .sort((a, b) => a.name.localeCompare(b.name));
    }
    _getAlarmEntities() {
        if (!this._hass)
            return [];
        return Object.keys(this._hass.states)
            .filter((entityId) => entityId.startsWith('alarm_control_panel.'))
            .map((entityId) => {
            const stateObj = this._hass.states[entityId];
            return {
                entity_id: entityId,
                name: stateObj.attributes?.friendly_name || entityId.split('.')[1].replace(/_/g, ' '),
            };
        })
            .sort((a, b) => a.name.localeCompare(b.name));
    }
    _getFilteredEntities(query, filterWithArea = false) {
        if (!this._hass || query.length < 2)
            return [];
        const q = query.toLowerCase();
        const all = this._getAllEntitiesForSelect();
        const filtered = all.filter((entity) => {
            if (filterWithArea && !entity.area_id && !entity.device_area_id)
                return false;
            return entity.name.toLowerCase().includes(q) || entity.entity_id.toLowerCase().includes(q);
        });
        // Prioritize: exact match > starts-with > contains
        filtered.sort((a, b) => {
            const aName = a.name.toLowerCase();
            const bName = b.name.toLowerCase();
            const aId = a.entity_id.toLowerCase();
            const bId = b.entity_id.toLowerCase();
            const aExact = aName === q || aId === q;
            const bExact = bName === q || bId === q;
            if (aExact !== bExact)
                return aExact ? -1 : 1;
            const aStarts = aName.startsWith(q) || aId.startsWith(q) || aId.split('.')[1]?.startsWith(q);
            const bStarts = bName.startsWith(q) || bId.startsWith(q) || bId.split('.')[1]?.startsWith(q);
            if (aStarts !== bStarts)
                return aStarts ? -1 : 1;
            return aName.localeCompare(bName);
        });
        return filtered.slice(0, 21);
    }
    // -- Main render ------------------------------------------------------
    render() {
        if (!this._hass)
            return lit__WEBPACK_IMPORTED_MODULE_0__.nothing;
        return (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `
      <div class="card-config">
        ${this._renderOverviewSection()}
        ${this._renderSummariesSection()}
        ${this._renderFavoritesSection()}

        <div class="section-divider">
          <div class="section-divider-title">
            ${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.section_areas_rooms')}
          </div>
        </div>

        ${this._renderAreasSection()}
        ${this._renderRoomPinsSection()}
        ${this._renderViewsSection()}

        <div class="section-divider">
          <div class="section-divider-title">
            ${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.section_advanced')}
          </div>
        </div>

        ${this._renderSectionOrderPanel()}
        ${this._renderCustomCardsSection()}
        ${this._renderCustomBadgesSection()}
        ${this._renderCustomViewsSection()}
      </div>
    `;
    }
    // ====================================================================
    // SECTION RENDERERS
    // ====================================================================
    // -- Section order panel -----------------------------------------------
    _getSectionsOrder() {
        return this._config.sections_order || [..._types_strategy__WEBPACK_IMPORTED_MODULE_3__.DEFAULT_SECTIONS_ORDER];
    }
    _updateSectionsOrder(newOrder) {
        const newConfig = {
            ...this._config,
            sections_order: newOrder,
        };
        this._config = newConfig;
        this._fireConfigChanged(newConfig);
    }
    _isSectionDisabled(key) {
        switch (key) {
            case 'custom_cards':
                return (this._config.custom_cards || []).length === 0;
            case 'weather':
                return this._config.show_weather === false;
            case 'energy':
                return this._config.show_energy === false;
            default:
                return false;
        }
    }
    _isSectionToggleable(key) {
        return key === 'weather' || key === 'energy';
    }
    _toggleSectionVisibility(key, visible) {
        if (key === 'weather') {
            this._toggleChanged('show_weather', visible, true);
        }
        else if (key === 'energy') {
            this._toggleChanged('show_energy', visible, true);
        }
    }
    _renderSectionOrderPanel() {
        const order = this._getSectionsOrder();
        const energyLinkDashboard = this._config.energy_link_dashboard !== false;
        const showEnergy = this._config.show_energy !== false;
        return (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `
      <div class="section">
        <div class="section-title">${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.section_order')}</div>
        <div class="description" style="margin-left: 0; margin-bottom: 12px;">
          ${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.section_order_desc')}
        </div>
        <div class="section-order-list" id="section-order-list">
          ${order.map((key) => {
            const meta = Simon42DashboardStrategyEditor._sectionMeta.get(key);
            if (!meta)
                return lit__WEBPACK_IMPORTED_MODULE_0__.nothing;
            const disabled = this._isSectionDisabled(key);
            const toggleable = this._isSectionToggleable(key);
            return (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `
              <div class="section-order-item ${disabled ? 'disabled' : ''}"
                data-section-key=${key}
                draggable="true"
                @dragstart=${this._handleSectionDragStart}
                @dragend=${this._handleSectionDragEnd}
                @dragover=${this._handleSectionDragOver}
                @dragleave=${this._handleSectionDragLeave}
                @drop=${this._handleSectionDrop}>
                <span class="drag-handle" draggable="true">&#x2630;</span>
                <ha-icon class="section-icon" icon=${meta.icon}></ha-icon>
                <span class="section-label">${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)(meta.labelKey)}</span>
                ${disabled && !toggleable ? (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `<span class="section-hidden-tag">(${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.section_hidden')})</span>` : lit__WEBPACK_IMPORTED_MODULE_0__.nothing}
                ${toggleable ? (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `
                  <label class="section-toggle" @mousedown=${(e) => { e.stopPropagation(); }}>
                    <input type="checkbox"
                      ?checked=${!disabled}
                      @change=${(e) => { this._toggleSectionVisibility(key, e.target.checked); }}
                      @dragstart=${(e) => { e.stopPropagation(); }} />
                  </label>
                ` : lit__WEBPACK_IMPORTED_MODULE_0__.nothing}
              </div>
              ${key === 'energy' && showEnergy ? (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `
                <div class="section-order-sub">
                  <input type="checkbox" id="energy-link-dashboard"
                    ?checked=${energyLinkDashboard}
                    @change=${(e) => { this._toggleChanged('energy_link_dashboard', e.target.checked, true); }} />
                  <label for="energy-link-dashboard">${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.energy_link_dashboard')}</label>
                </div>
              ` : lit__WEBPACK_IMPORTED_MODULE_0__.nothing}
            `;
        })}
        </div>
      </div>
    `;
    }
    // -- Overview section --------------------------------------------------
    _renderOverviewSection() {
        const showClockCard = this._config.show_clock_card !== false;
        const showSearchCard = this._config.show_search_card === true;
        const hasSearchCardDeps = this._checkSearchCardDependencies();
        const alarmEntity = this._config.alarm_entity || '';
        const alarmEntities = this._getAlarmEntities();
        return (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `
      <div class="section">
        <div class="section-title">${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.section_overview')}</div>

        ${this._renderCheckbox('show-clock-card', (0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.show_clock_card'), showClockCard, (checked) => this._toggleChanged('show_clock_card', checked, true))}
        <div class="description">${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.show_clock_card_desc')}</div>

        <div class="form-row">
          <label for="alarm-entity" style="margin-right: 8px; min-width: 120px;">${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.alarm_entity')}</label>
          <select id="alarm-entity"
            style="flex: 1;"
            @change=${this._alarmEntityChanged}>
            <option value="" ?selected=${!alarmEntity}>${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.alarm_none')}</option>
            ${alarmEntities.map((entity) => (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `
              <option value=${entity.entity_id} ?selected=${entity.entity_id === alarmEntity}>
                ${entity.name}
              </option>
            `)}
          </select>
        </div>
        <div class="description">${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.alarm_desc')}</div>

        ${this._renderCheckbox('show-search-card', (0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.show_search_card'), showSearchCard, (checked) => this._toggleChanged('show_search_card', checked, false), !hasSearchCardDeps)}
        <div class="description">
          ${hasSearchCardDeps
            ? (0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.show_search_card_desc')
            : (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `<span>&#x26A0;&#xFE0F; ${(0,lit_directives_unsafe_html_js__WEBPACK_IMPORTED_MODULE_1__.unsafeHTML)((0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.show_search_card_missing'))}</span>`}
        </div>
      </div>
    `;
    }
    _renderSummariesSection() {
        const summariesColumns = this._config.summaries_columns || 2;
        const stretchWrappingSummaries = this._config.stretch_wrapping_summaries === true;
        const showLightSummary = this._config.show_light_summary !== false;
        const groupLightsByFloors = this._config.group_lights_by_floors === true;
        const nestedLightGroups = this._config.nested_light_groups === true;
        const showCoversSummary = this._config.show_covers_summary !== false;
        const showPartiallyOpenCovers = this._config.show_partially_open_covers === true;
        const showSecuritySummary = this._config.show_security_summary !== false;
        const showClimateSummary = this._config.show_climate_summary === true;
        const showBatterySummary = this._config.show_battery_summary !== false;
        const hideMobileAppBatteries = this._config.hide_mobile_app_batteries === true;
        const batteryCriticalThreshold = this._config.battery_critical_threshold ?? 20;
        const batteryLowThreshold = this._config.battery_low_threshold ?? 50;
        return (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `
      <div class="section">
        <div class="section-title">${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.section_summaries')}</div>

        <div class="form-row">
          <input type="radio" id="summaries-2-columns" name="summaries-columns" value="2"
            ?checked=${summariesColumns === 2}
            @change=${() => this._summariesColumnsChanged(2)} />
          <label for="summaries-2-columns">${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.columns_2')}</label>
        </div>
        <div class="form-row">
          <input type="radio" id="summaries-4-columns" name="summaries-columns" value="4"
            ?checked=${summariesColumns === 4}
            @change=${() => this._summariesColumnsChanged(4)} />
          <label for="summaries-4-columns">${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.columns_4')}</label>
        </div>
        <div class="description">${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.columns_desc')}</div>

        ${this._renderCheckbox('stretch-wrapping-summaries', (0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.stretch_wrapping_summaries'), stretchWrappingSummaries, (checked) => this._toggleChanged('stretch_wrapping_summaries', checked, false))}
        <div class="description">${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.stretch_wrapping_summaries_desc')}</div>

        ${this._renderCheckbox('show-light-summary', (0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.show_light_summary'), showLightSummary, (checked) => this._toggleChanged('show_light_summary', checked, true))}

        ${this._renderCheckbox('group-lights-by-floors', (0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.group_lights_by_floors'), groupLightsByFloors, (checked) => this._toggleChanged('group_lights_by_floors', checked, false))}
        <div class="description">${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.group_lights_by_floors_desc')}</div>

        ${this._renderCheckbox('nested-light-groups', (0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.nested_light_groups'), nestedLightGroups, (checked) => this._toggleChanged('nested_light_groups', checked, false))}
        <div class="description">${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.nested_light_groups_desc')}</div>

        ${this._renderCheckbox('show-covers-summary', (0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.show_covers_summary'), showCoversSummary, (checked) => this._toggleChanged('show_covers_summary', checked, true))}

        <div style="margin-left: 26px; margin-bottom: 8px;">
          ${this._renderCheckbox('show-partially-open-covers', (0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.show_partially_open_covers'), showPartiallyOpenCovers, (checked) => this._toggleChanged('show_partially_open_covers', checked, false))}
          <div class="description">${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.show_partially_open_covers_desc')}</div>
        </div>

        ${this._renderCheckbox('show-security-summary', (0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.show_security_summary'), showSecuritySummary, (checked) => this._toggleChanged('show_security_summary', checked, true))}

        ${this._renderCheckbox('show-climate-summary', (0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.show_climate_summary'), showClimateSummary, (checked) => this._toggleChanged('show_climate_summary', checked, false))}
        <div class="description">${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.show_climate_summary_desc')}</div>

        ${this._renderCheckbox('show-battery-summary', (0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.show_battery_summary'), showBatterySummary, (checked) => this._toggleChanged('show_battery_summary', checked, true))}

        <div style="margin-left: 26px; margin-bottom: 8px;">
          ${this._renderCheckbox('hide-mobile-app-batteries', (0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.hide_mobile_app_batteries'), hideMobileAppBatteries, (checked) => this._toggleChanged('hide_mobile_app_batteries', checked, false))}
          <div class="description">${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.hide_mobile_app_batteries_desc')}</div>

          <div style="font-size: 13px; font-weight: 500; color: var(--primary-text-color); margin-top: 12px; margin-bottom: 4px;">
            ${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.battery_thresholds')}
          </div>
          <div class="form-row">
            <label for="battery-critical-threshold" style="min-width: 140px;">${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.battery_critical_below')}</label>
            <input type="number" id="battery-critical-threshold" min="1" max="99"
              .value=${String(batteryCriticalThreshold)}
              style="width: 70px;"
              @change=${this._batteryCriticalChanged} /> %
          </div>
          <div class="form-row">
            <label for="battery-low-threshold" style="min-width: 140px;">${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.battery_low_below')}</label>
            <input type="number" id="battery-low-threshold" min="1" max="99"
              .value=${String(batteryLowThreshold)}
              style="width: 70px;"
              @change=${this._batteryLowChanged} /> %
          </div>
          <div class="description">${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.battery_thresholds_desc')}</div>
        </div>
      </div>
    `;
    }
    _renderFavoritesSection() {
        const favoriteEntities = this._config.favorite_entities || [];
        const allEntities = this._getAllEntitiesForSelect();
        const favoritesShowState = this._config.favorites_show_state === true;
        const favoritesHideLastChanged = this._config.favorites_hide_last_changed === true;
        const entityMap = new Map(allEntities.map((e) => [e.entity_id, e.name]));
        const filteredEntities = this._getFilteredEntities(this._favoriteSearch);
        return (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `
      <div class="section">
        <div class="section-title">${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.section_favorites')}</div>

        <div id="favorites-list" style="margin-bottom: 12px;">
          ${favoriteEntities.length === 0
            ? (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `<div class="empty-state">${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.no_favorites')}</div>`
            : (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `
              <div class="entity-list-container">
                ${favoriteEntities.map((entityId) => {
                const name = entityMap.get(entityId) || entityId;
                return (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `
                    <div class="entity-list-item" data-entity-id=${entityId}
                      draggable="true"
                      @dragstart=${(ev) => this._handleEntityDragStart(ev, 'favorites')}
                      @dragend=${this._handleEntityDragEnd}
                      @dragover=${this._handleEntityDragOver}
                      @dragleave=${this._handleEntityDragLeave}
                      @drop=${(ev) => this._handleEntityDrop(ev, 'favorites')}>
                      <span class="drag-icon">&#x2630;</span>
                      <span class="item-info">
                        <span class="item-name">${name}</span>
                        <span class="item-entity-id">${entityId}</span>
                      </span>
                      <button class="btn-remove" @click=${() => this._removeFavoriteEntity(entityId)}>&#x2715;</button>
                    </div>
                  `;
            })}
              </div>
            `}
        </div>

        <div class="entity-search-picker">
          <input type="text" class="entity-search-input"
            placeholder=${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.select_entity') + '...'}
            .value=${this._favoriteSearch}
            @input=${(e) => { this._favoriteSearch = e.target.value; this.requestUpdate(); }}
            @blur=${() => { setTimeout(() => { this._favoriteSearch = ''; this.requestUpdate(); }, 200); }}
          />
          ${this._favoriteSearch.length >= 2 ? (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `
            <div class="entity-search-results">
              ${filteredEntities.length > 0
            ? filteredEntities.map((entity) => (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `
                  <div class="entity-search-result" @mousedown=${(e) => { e.preventDefault(); this._addFavoriteEntity(entity.entity_id); this._favoriteSearch = ''; this.requestUpdate(); }}>
                    <span class="entity-search-name">${entity.name}</span>
                    <span class="entity-search-id">${entity.entity_id}</span>
                  </div>
                `)
            : (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `<div class="entity-search-no-results">${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.no_results')}</div>`}
            </div>
          ` : lit__WEBPACK_IMPORTED_MODULE_0__.nothing}
        </div>
        <div class="description">${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.favorites_desc')}</div>

        ${this._renderCheckbox('favorites-show-state', (0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.show_state'), favoritesShowState, (checked) => this._toggleChanged('favorites_show_state', checked, false))}

        ${this._renderCheckbox('favorites-hide-last-changed', (0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.hide_last_changed'), favoritesHideLastChanged, (checked) => this._toggleChanged('favorites_hide_last_changed', checked, false))}
      </div>
    `;
    }
    _renderAreasSection() {
        const groupByFloors = this._config.group_by_floors === true;
        const showSwitchesOnAreas = this._config.show_switches_on_areas === true;
        const showAlertsOnAreas = this._config.show_alerts_on_areas === true;
        const showLocksInRooms = this._config.show_locks_in_rooms === true;
        const showAutomationsInRooms = this._config.show_automations_in_rooms === true;
        const showScriptsInRooms = this._config.show_scripts_in_rooms === true;
        const useDefaultAreaSort = this._config.use_default_area_sort === true;
        const allAreas = Object.values(this._hass.areas).sort((a, b) => a.name.localeCompare(b.name));
        const hiddenAreas = this._config.areas_display?.hidden || [];
        const areaOrder = this._config.areas_display?.order || [];
        return (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `
      <div class="section">
        <div class="section-title">${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.section_areas')}</div>

        ${this._renderCheckbox('group-by-floors', (0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.group_by_floors'), groupByFloors, (checked) => this._toggleChanged('group_by_floors', checked, false))}
        <div class="description">${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.group_by_floors_desc')}</div>

        ${this._renderCheckbox('show-switches-on-areas', (0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.show_switches_on_areas'), showSwitchesOnAreas, (checked) => this._toggleChanged('show_switches_on_areas', checked, false))}
        <div class="description">${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.show_switches_on_areas_desc')}</div>

        ${this._renderCheckbox('show-alerts-on-areas', (0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.show_alerts_on_areas'), showAlertsOnAreas, (checked) => this._toggleChanged('show_alerts_on_areas', checked, false))}
        <div class="description">${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.show_alerts_on_areas_desc')}</div>

        ${this._renderCheckbox('show-locks-in-rooms', (0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.show_locks_in_rooms'), showLocksInRooms, (checked) => this._toggleChanged('show_locks_in_rooms', checked, false))}
        <div class="description">${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.show_locks_in_rooms_desc')}</div>

        ${this._renderCheckbox('show-automations-in-rooms', (0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.show_automations_in_rooms'), showAutomationsInRooms, (checked) => this._toggleChanged('show_automations_in_rooms', checked, false))}
        <div class="description">${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.show_automations_in_rooms_desc')}</div>

        ${this._renderCheckbox('show-scripts-in-rooms', (0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.show_scripts_in_rooms'), showScriptsInRooms, (checked) => this._toggleChanged('show_scripts_in_rooms', checked, false))}
        <div class="description">${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.show_scripts_in_rooms_desc')}</div>

        ${this._renderCheckbox('use-default-area-sort', (0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.use_default_area_sort'), useDefaultAreaSort, (checked) => this._toggleChanged('use_default_area_sort', checked, false))}
        <div class="description">${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.use_default_area_sort_desc')}</div>

        <div class="description" style="margin-left: 0; margin-top: 16px; margin-bottom: 12px;">
          ${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.areas_manage_desc')}
        </div>

        <div class="area-list" id="area-list">
          ${this._renderAreaItems(allAreas, hiddenAreas, areaOrder)}
        </div>
      </div>
    `;
    }
    _renderRoomPinsSection() {
        const roomPinEntities = this._config.room_pin_entities || [];
        const allEntities = this._getAllEntitiesForSelect();
        const allAreas = Object.values(this._hass.areas).sort((a, b) => a.name.localeCompare(b.name));
        const roomPinsShowState = this._config.room_pins_show_state === true;
        const roomPinsHideLastChanged = this._config.room_pins_hide_last_changed === true;
        const entityMap = new Map(allEntities.map((e) => [e.entity_id, e]));
        const areaMap = new Map(allAreas.map((a) => [a.area_id, a.name]));
        const filteredEntities = this._getFilteredEntities(this._roomPinSearch, true);
        return (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `
      <div class="section">
        <div class="section-title">${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.section_room_pins')}</div>

        <div id="room-pins-list" style="margin-bottom: 12px;">
          ${roomPinEntities.length === 0
            ? (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `<div class="empty-state">${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.no_room_pins')}</div>`
            : (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `
              <div class="entity-list-container">
                ${roomPinEntities.map((entityId) => {
                const entity = entityMap.get(entityId);
                const name = entity?.name || entityId;
                const areaId = entity?.area_id || entity?.device_area_id;
                const areaName = areaId ? areaMap.get(areaId) || areaId : (0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.no_room');
                return (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `
                    <div class="entity-list-item" data-entity-id=${entityId}
                      draggable="true"
                      @dragstart=${(ev) => this._handleEntityDragStart(ev, 'room_pins')}
                      @dragend=${this._handleEntityDragEnd}
                      @dragover=${this._handleEntityDragOver}
                      @dragleave=${this._handleEntityDragLeave}
                      @drop=${(ev) => this._handleEntityDrop(ev, 'room_pins')}>
                      <span class="drag-icon">&#x2630;</span>
                      <span class="item-info">
                        <span class="item-name">${name}</span>
                        <span class="item-entity-id">${entityId}</span>
                        <span class="item-area">&#x1F4CD; ${areaName}</span>
                      </span>
                      <button class="btn-remove" @click=${() => this._removeRoomPinEntity(entityId)}>&#x2715;</button>
                    </div>
                  `;
            })}
              </div>
            `}
        </div>

        <div class="entity-search-picker">
          <input type="text" class="entity-search-input"
            placeholder=${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.select_entity') + '...'}
            .value=${this._roomPinSearch}
            @input=${(e) => { this._roomPinSearch = e.target.value; this.requestUpdate(); }}
            @blur=${() => { setTimeout(() => { this._roomPinSearch = ''; this.requestUpdate(); }, 200); }}
          />
          ${this._roomPinSearch.length >= 2 ? (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `
            <div class="entity-search-results">
              ${filteredEntities.length > 0
            ? filteredEntities.map((entity) => (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `
                  <div class="entity-search-result" @mousedown=${(e) => { e.preventDefault(); this._addRoomPinEntity(entity.entity_id); this._roomPinSearch = ''; this.requestUpdate(); }}>
                    <span class="entity-search-name">${entity.name}</span>
                    <span class="entity-search-id">${entity.entity_id}</span>
                  </div>
                `)
            : (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `<div class="entity-search-no-results">${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.no_results')}</div>`}
            </div>
          ` : lit__WEBPACK_IMPORTED_MODULE_0__.nothing}
        </div>
        <div class="description">${(0,lit_directives_unsafe_html_js__WEBPACK_IMPORTED_MODULE_1__.unsafeHTML)((0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.room_pins_desc'))}</div>

        ${this._renderCheckbox('room-pins-show-state', (0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.show_state'), roomPinsShowState, (checked) => this._toggleChanged('room_pins_show_state', checked, false))}

        ${this._renderCheckbox('room-pins-hide-last-changed', (0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.hide_last_changed'), roomPinsHideLastChanged, (checked) => this._toggleChanged('room_pins_hide_last_changed', checked, false))}
      </div>
    `;
    }
    _renderViewsSection() {
        const showSummaryViews = this._config.show_summary_views === true;
        const showRoomViews = this._config.show_room_views === true;
        return (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `
      <div class="section">
        <div class="section-title">${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.section_views')}</div>

        ${this._renderCheckbox('show-summary-views', (0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.show_summary_views'), showSummaryViews, (checked) => this._toggleChanged('show_summary_views', checked, false))}
        <div class="description">${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.show_summary_views_desc')}</div>

        ${this._renderCheckbox('show-room-views', (0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.show_room_views'), showRoomViews, (checked) => this._toggleChanged('show_room_views', checked, false))}
        <div class="description">${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.show_room_views_desc')}</div>
      </div>
    `;
    }
    _renderCustomCardsSection() {
        const customCards = this._config.custom_cards || [];
        const customCardsHeading = this._config.custom_cards_heading || '';
        const customCardsIcon = this._config.custom_cards_icon || '';
        return (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `
      <div class="section">
        <div class="section-title" style="display: flex; align-items: center; gap: 8px;">
          ${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.section_custom_cards')}
          <a href="https://github.com/TheRealSimon42/simon42-dashboard-strategy/blob/main/assets/Eigene-Karten-hinzufugen.gif"
            target="_blank" rel="noopener"
            style="color: var(--primary-color); text-decoration: none; font-size: 18px;"
            title=${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.video_tutorial')}>&#x1F3AC;</a>
        </div>
        <div class="custom-item-row" style="margin-bottom: 12px;">
          <input type="text" id="custom-cards-heading"
            .value=${customCardsHeading}
            placeholder=${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.custom_cards_heading_placeholder')}
            style="flex: 2;"
            @change=${this._customCardsHeadingChanged} />
          <input type="text" id="custom-cards-icon"
            .value=${customCardsIcon}
            placeholder="mdi:cards"
            style="flex: 1;"
            @change=${this._customCardsIconChanged} />
        </div>
        <div class="description" style="margin-bottom: 8px;">${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.custom_cards_desc')}</div>

        <div id="custom-cards-list">
          ${customCards.length === 0
            ? (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `<div class="empty-state">${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.no_custom_cards')}</div>`
            : customCards.map((card, index) => this._renderCustomCardItem(card, index))}
        </div>

        <button class="btn-primary" style="margin-top: 8px;" @click=${this._addCustomCard}>
          ${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.add_custom_card')}
        </button>
        <div class="description">${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.custom_cards_help')}</div>
      </div>
    `;
    }
    _renderCustomBadgesSection() {
        const customBadges = this._config.custom_badges || [];
        return (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `
      <div class="section">
        <div class="section-title" style="display: flex; align-items: center; gap: 8px;">
          ${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.section_custom_badges')}
          <a href="https://github.com/TheRealSimon42/simon42-dashboard-strategy/blob/main/assets/Custom-Badges-hinzufugen.gif"
            target="_blank" rel="noopener"
            style="color: var(--primary-color); text-decoration: none; font-size: 18px;"
            title=${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.video_tutorial')}>&#x1F3AC;</a>
        </div>

        <div id="custom-badges-list">
          ${customBadges.length === 0
            ? (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `<div class="empty-state">${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.no_custom_badges')}</div>`
            : customBadges.map((badge, index) => this._renderCustomBadgeItem(badge, index))}
        </div>

        <button class="btn-primary" style="margin-top: 8px;" @click=${this._addCustomBadge}>
          ${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.add_custom_badge')}
        </button>
        <div class="description">${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.custom_badges_help')}</div>
      </div>
    `;
    }
    _renderCustomViewsSection() {
        const customViews = this._config.custom_views || [];
        return (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `
      <div class="section">
        <div class="section-title" style="display: flex; align-items: center; gap: 8px;">
          ${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.section_custom_views')}
          <a href="https://github.com/TheRealSimon42/simon42-dashboard-strategy/blob/main/assets/Custom-View-hinzufugen.gif"
            target="_blank" rel="noopener"
            style="color: var(--primary-color); text-decoration: none; font-size: 18px;"
            title=${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.video_tutorial')}>&#x1F3AC;</a>
        </div>

        <div id="custom-views-list">
          ${customViews.length === 0
            ? (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `<div class="empty-state">${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.no_custom_views')}</div>`
            : customViews.map((view, index) => this._renderCustomViewItem(view, index))}
        </div>

        <button class="btn-primary" style="margin-top: 8px;" @click=${this._addCustomView}>
          ${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.add_custom_view')}
        </button>
        <div class="description">${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.custom_views_help')}</div>
      </div>
    `;
    }
    // ====================================================================
    // ITEM RENDERERS
    // ====================================================================
    _renderCheckbox(id, label, checked, onChange, disabled = false) {
        return (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `
      <div class="form-row">
        <input type="checkbox" id=${id}
          ?checked=${checked}
          ?disabled=${disabled}
          @change=${(e) => onChange(e.target.checked)} />
        <label for=${id} class=${disabled ? 'disabled-label' : ''}>${label}</label>
      </div>
    `;
    }
    _renderCustomViewItem(view, index) {
        const validationMsg = view._yaml_error
            ? (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `<span style="color: var(--error-color);">&#x274C; ${view._yaml_error}</span>`
            : view.yaml
                ? (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `<span style="color: var(--success-color, green);">&#x2705; ${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.yaml_valid')}</span>`
                : lit__WEBPACK_IMPORTED_MODULE_0__.nothing;
        return (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `
      <div class="custom-item" data-index=${index}>
        <div class="custom-item-header">
          <strong>${view.title || (0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.new_view')}</strong>
          <button class="btn-remove" @click=${() => this._removeCustomView(index)}>&#x2715;</button>
        </div>
        <div class="custom-item-fields">
          <div class="custom-item-row">
            <input type="text" .value=${view.title || ''} placeholder=${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.title_placeholder')}
              style="flex: 2;"
              @change=${(e) => this._updateCustomViewField(index, 'title', e.target.value)} />
            <input type="text" .value=${view.path || ''} placeholder=${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.path_placeholder')}
              style="flex: 2;"
              @change=${(e) => this._updateCustomViewField(index, 'path', e.target.value)} />
            <input type="text" .value=${view.icon || ''} placeholder="mdi:star"
              style="flex: 1;"
              @change=${(e) => this._updateCustomViewField(index, 'icon', e.target.value)} />
          </div>
          <textarea rows="8" placeholder=${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.yaml_placeholder')}
            .value=${view.yaml || ''}
            style="width: 100%;"
            @change=${(e) => this._updateCustomViewYaml(index, e.target.value)}></textarea>
          <div class="custom-item-validation">
            ${validationMsg}
          </div>
        </div>
      </div>
    `;
    }
    _renderCustomCardItem(card, index) {
        const validationMsg = card._yaml_error
            ? (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `<span style="color: var(--error-color);">&#x274C; ${card._yaml_error}</span>`
            : card.yaml
                ? (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `<span style="color: var(--success-color, green);">&#x2705; ${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.yaml_valid')}</span>`
                : lit__WEBPACK_IMPORTED_MODULE_0__.nothing;
        return (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `
      <div class="custom-item" data-index=${index}>
        <div class="custom-item-header">
          <strong>${card.title || (0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.new_card')}</strong>
          <button class="btn-remove" @click=${() => this._removeCustomCard(index)}>&#x2715;</button>
        </div>
        <div class="custom-item-fields">
          <input type="text" .value=${card.title || ''} placeholder=${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.card_title_placeholder')}
            @change=${(e) => this._updateCustomCardField(index, 'title', e.target.value)} />
          <div class="custom-card-target">
            <label>${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.target_section')}:</label>
            <select
              @change=${(e) => this._updateCustomCardField(index, 'target_section', e.target.value)}>
              ${['custom_cards', 'overview', 'areas', 'weather', 'energy'].map((key) => (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `
                <option value=${key} ?selected=${(card.target_section || 'custom_cards') === key}>
                  ${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)(Simon42DashboardStrategyEditor._sectionMeta.get(key).labelKey)}
                </option>
              `)}
            </select>
          </div>
          <textarea rows="6" placeholder=${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.yaml_placeholder')}
            .value=${card.yaml || ''}
            style="width: 100%;"
            @change=${(e) => this._updateCustomCardYaml(index, e.target.value)}></textarea>
          <div class="custom-item-validation">
            ${validationMsg}
          </div>
        </div>
      </div>
    `;
    }
    _renderCustomBadgeItem(badge, index) {
        const validationMsg = badge._yaml_error
            ? (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `<span style="color: var(--error-color);">&#x274C; ${badge._yaml_error}</span>`
            : badge.yaml
                ? (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `<span style="color: var(--success-color, green);">&#x2705; ${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.yaml_valid')}</span>`
                : lit__WEBPACK_IMPORTED_MODULE_0__.nothing;
        return (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `
      <div class="custom-item" data-index=${index}>
        <div class="custom-item-header">
          <strong>Badge ${index + 1}</strong>
          <button class="btn-remove" @click=${() => this._removeCustomBadge(index)}>&#x2715;</button>
        </div>
        <textarea rows="4" placeholder="type: entity&#10;entity: sun.sun"
          .value=${badge.yaml || ''}
          style="width: 100%;"
          @change=${(e) => this._updateCustomBadgeYaml(index, e.target.value)}></textarea>
        <div class="custom-item-validation">
          ${validationMsg}
        </div>
      </div>
    `;
    }
    // ====================================================================
    // AREA RENDERERS
    // ====================================================================
    _renderAreaItems(allAreas, hiddenAreas, areaOrder) {
        if (allAreas.length === 0) {
            return (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `<div class="empty-state">${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.no_areas')}</div>`;
        }
        // Sort areas by configured order
        const sortedAreas = [...allAreas].sort((a, b) => {
            const orderA = areaOrder.indexOf(a.area_id);
            const orderB = areaOrder.indexOf(b.area_id);
            const effectiveA = orderA !== -1 ? orderA : 9999 + allAreas.indexOf(a);
            const effectiveB = orderB !== -1 ? orderB : 9999 + allAreas.indexOf(b);
            return effectiveA - effectiveB;
        });
        return sortedAreas.map((area) => {
            const isHidden = hiddenAreas.includes(area.area_id);
            const isExpanded = this._expandedAreas.has(area.area_id);
            const cachedData = this._areaEntitiesCache.get(area.area_id);
            return (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `
        <div class="area-item"
          data-area-id=${area.area_id}
          draggable="true"
          @dragstart=${this._handleDragStart}
          @dragend=${this._handleDragEnd}
          @dragover=${this._handleDragOver}
          @dragleave=${this._handleDragLeave}
          @drop=${this._handleDrop}>
          <div class="area-header">
            <span class="drag-handle" draggable="true">&#x2630;</span>
            <input type="checkbox" class="area-checkbox"
              data-area-id=${area.area_id}
              ?checked=${!isHidden}
              @change=${(e) => this._areaVisibilityChanged(area.area_id, e.target.checked)} />
            <span class="area-name">${area.name}</span>
            ${area.icon ? (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `<ha-icon class="area-icon" icon=${area.icon}></ha-icon>` : lit__WEBPACK_IMPORTED_MODULE_0__.nothing}
            <button class="expand-button ${isExpanded ? 'expanded' : ''}"
              data-area-id=${area.area_id}
              ?disabled=${isHidden}
              @click=${(e) => this._toggleAreaExpand(e, area.area_id)}>
              <span class="expand-icon">&#x25B6;</span>
            </button>
          </div>
          ${isExpanded
                ? (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `
              <div class="area-content" data-area-id=${area.area_id}>
                ${cachedData
                    ? this._renderAreaEntities(area.area_id, cachedData)
                    : (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `<div class="loading-placeholder">${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.loading_entities')}</div>`}
              </div>
            `
                : lit__WEBPACK_IMPORTED_MODULE_0__.nothing}
        </div>
      `;
        });
    }
    _renderAreaEntities(areaId, data) {
        const { groupedEntities, hiddenEntities, badgeCandidates, additionalBadges, availableEntities, defaultShowNames, namesVisible, namesHidden, } = data;
        const hass = this._hass;
        const domainGroups = [
            { key: 'lights', label: (0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.domain_lights'), icon: 'mdi:lightbulb' },
            { key: 'climate', label: (0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.domain_climate'), icon: 'mdi:thermostat' },
            { key: 'covers', label: (0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.domain_covers'), icon: 'mdi:window-shutter' },
            { key: 'covers_curtain', label: (0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.domain_covers_curtain'), icon: 'mdi:curtains' },
            { key: 'covers_window', label: (0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.domain_covers_window'), icon: 'mdi:window-open-variant' },
            { key: 'media_player', label: (0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.domain_media_player'), icon: 'mdi:speaker' },
            { key: 'scenes', label: (0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.domain_scenes'), icon: 'mdi:palette' },
            { key: 'vacuum', label: (0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.domain_vacuum'), icon: 'mdi:robot-vacuum' },
            { key: 'fan', label: (0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.domain_fan'), icon: 'mdi:fan' },
            { key: 'switches', label: (0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.domain_switches'), icon: 'mdi:light-switch' },
            { key: 'locks', label: (0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.domain_locks'), icon: 'mdi:lock' },
        ];
        const hasEntities = domainGroups.some((g) => (groupedEntities[g.key]?.length ?? 0) > 0);
        const hasBadges = (badgeCandidates?.length ?? 0) > 0 || (additionalBadges?.length ?? 0) > 0;
        if (!hasEntities && !hasBadges) {
            return (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `<div class="empty-state">${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.no_entities_in_area')}</div>`;
        }
        const expandedGroups = this._expandedGroups.get(areaId) || new Set();
        return (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `
      <div class="entity-groups">
        ${domainGroups.map((group) => {
            const entities = groupedEntities[group.key];
            if (!entities || entities.length === 0)
                return lit__WEBPACK_IMPORTED_MODULE_0__.nothing;
            const hiddenInGroup = (hiddenEntities[group.key] || []);
            const allHidden = entities.every((e) => hiddenInGroup.includes(e));
            const someHidden = entities.some((e) => hiddenInGroup.includes(e)) && !allHidden;
            const isGroupExpanded = expandedGroups.has(group.key);
            return (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `
            <div class="entity-group" data-group=${group.key}>
              <div class="entity-group-header"
                @click=${() => this._toggleGroupExpand(areaId, group.key)}>
                <input type="checkbox" class="group-checkbox"
                  data-area-id=${areaId}
                  data-group=${group.key}
                  ?checked=${!allHidden}
                  .indeterminate=${someHidden}
                  @click=${(e) => e.stopPropagation()}
                  @change=${(e) => {
                e.stopPropagation();
                const checked = e.target.checked;
                this._groupVisibilityChanged(areaId, group.key, checked, entities);
            }} />
                <ha-icon icon=${group.icon}></ha-icon>
                <span class="group-name">${group.label}</span>
                <span class="entity-count">(${entities.length})</span>
                <button class="expand-button-small ${isGroupExpanded ? 'expanded' : ''}"
                  @click=${(e) => { e.stopPropagation(); this._toggleGroupExpand(areaId, group.key); }}>
                  <span class="expand-icon-small">&#x25B6;</span>
                </button>
              </div>
              ${isGroupExpanded
                ? (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `
                  <div class="entity-list" data-area-id=${areaId} data-group=${group.key}>
                    ${entities.map((entityId) => {
                    const stateObj = hass.states[entityId];
                    const name = stateObj?.attributes.friendly_name || entityId.split('.')[1].replace(/_/g, ' ');
                    const isEntityHidden = hiddenInGroup.includes(entityId);
                    return (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `
                        <div class="entity-item">
                          <input type="checkbox" class="entity-checkbox"
                            ?checked=${!isEntityHidden}
                            @change=${(e) => this._entityVisibilityChanged(areaId, group.key, entityId, e.target.checked)} />
                          <span class="entity-name">${name}</span>
                          <span class="entity-id">${entityId}</span>
                        </div>
                      `;
                })}
                  </div>
                `
                : lit__WEBPACK_IMPORTED_MODULE_0__.nothing}
            </div>
          `;
        })}
        ${hasBadges
            ? this._renderBadgeGroup(areaId, badgeCandidates, additionalBadges, availableEntities, hiddenEntities, defaultShowNames, namesVisible, namesHidden, expandedGroups)
            : lit__WEBPACK_IMPORTED_MODULE_0__.nothing}
      </div>
    `;
    }
    _renderBadgeGroup(areaId, badgeCandidates, additionalBadges, availableEntities, hiddenEntities, defaultShowNames, namesVisible, namesHidden, expandedGroups) {
        const hass = this._hass;
        const totalCount = badgeCandidates.length + additionalBadges.length;
        if (totalCount === 0)
            return (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) ``;
        const hiddenInBadges = hiddenEntities['badges'] || [];
        const allHidden = badgeCandidates.length > 0 && badgeCandidates.every((e) => hiddenInBadges.includes(e));
        const someHidden = badgeCandidates.some((e) => hiddenInBadges.includes(e)) && !allHidden;
        const namesVisibleSet = new Set(namesVisible || []);
        const namesHiddenSet = new Set(namesHidden || []);
        const isNameShown = (entityId) => (0,_utils_badge_utils__WEBPACK_IMPORTED_MODULE_5__.resolveShowName)(entityId, defaultShowNames.has(entityId), namesVisibleSet, namesHiddenSet);
        const isGroupExpanded = expandedGroups.has('badges');
        return (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `
      <div class="entity-group" data-group="badges">
        <div class="entity-group-header"
          @click=${() => this._toggleGroupExpand(areaId, 'badges')}>
          <input type="checkbox" class="group-checkbox"
            data-area-id=${areaId}
            data-group="badges"
            ?checked=${!allHidden}
            .indeterminate=${someHidden}
            @click=${(e) => e.stopPropagation()}
            @change=${(e) => {
            e.stopPropagation();
            const checked = e.target.checked;
            this._groupVisibilityChanged(areaId, 'badges', checked, badgeCandidates);
        }} />
          <ha-icon icon="mdi:checkbox-multiple-blank-circle"></ha-icon>
          <span class="group-name">${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.domain_badges')}</span>
          <span class="entity-count">(${totalCount})</span>
          <button class="expand-button-small ${isGroupExpanded ? 'expanded' : ''}"
            @click=${(e) => { e.stopPropagation(); this._toggleGroupExpand(areaId, 'badges'); }}>
            <span class="expand-icon-small">&#x25B6;</span>
          </button>
        </div>
        ${isGroupExpanded
            ? (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `
            <div class="entity-list" data-area-id=${areaId} data-group="badges">
              ${badgeCandidates.map((entityId) => {
                const stateObj = hass.states[entityId];
                const name = stateObj?.attributes.friendly_name || entityId.split('.')[1].replace(/_/g, ' ');
                const isHidden = hiddenInBadges.includes(entityId);
                const showName = isNameShown(entityId);
                return (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `
                  <div class="entity-item">
                    <input type="checkbox" class="entity-checkbox"
                      ?checked=${!isHidden}
                      @change=${(e) => this._entityVisibilityChanged(areaId, 'badges', entityId, e.target.checked)} />
                    <span class="entity-name">${name}</span>
                    <input type="checkbox" class="badge-name-checkbox"
                      ?checked=${showName}
                      title=${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.badges_show_name')}
                      @change=${(e) => this._badgeShowNameChanged(areaId, entityId, e.target.checked)} />
                    <span class="badge-name-label">${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.badges_name_short')}</span>
                    <span class="entity-id">${entityId}</span>
                  </div>
                `;
            })}

              ${additionalBadges.length > 0
                ? (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `
                  <div class="badge-separator">${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.badges_additional')}</div>
                  ${additionalBadges.map((entityId) => {
                    const stateObj = hass.states[entityId];
                    const name = stateObj?.attributes.friendly_name || entityId.split('.')[1].replace(/_/g, ' ');
                    const showName = isNameShown(entityId);
                    return (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `
                      <div class="entity-item badge-additional-item">
                        <span class="entity-name">${name}</span>
                        <input type="checkbox" class="badge-name-checkbox"
                          ?checked=${showName}
                          title=${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.badges_show_name')}
                          @change=${(e) => this._badgeShowNameChanged(areaId, entityId, e.target.checked)} />
                        <span class="badge-name-label">${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.badges_name_short')}</span>
                        <span class="entity-id">${entityId}</span>
                        <button class="badge-remove-btn"
                          title=${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.badges_remove')}
                          @click=${() => this._badgeAdditionalChanged(areaId, entityId, false)}>&#x2715;</button>
                      </div>
                    `;
                })}
                `
                : lit__WEBPACK_IMPORTED_MODULE_0__.nothing}

              ${availableEntities.length > 0
                ? (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `
                  <div class="badge-add-section">
                    <select class="badge-entity-picker" data-area-id=${areaId}>
                      <option value="">${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.badges_select_entity')}</option>
                      ${availableEntities.map((e) => (0,lit__WEBPACK_IMPORTED_MODULE_0__.html) `
                        <option value=${e.entity_id}>${e.name} (${e.entity_id})</option>
                      `)}
                    </select>
                    <button class="badge-add-button"
                      @click=${(e) => this._addBadgeFromPicker(e, areaId)}>
                      ${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_4__.localize)('editor.badges_add')}
                    </button>
                  </div>
                `
                : lit__WEBPACK_IMPORTED_MODULE_0__.nothing}
            </div>
          `
            : lit__WEBPACK_IMPORTED_MODULE_0__.nothing}
      </div>
    `;
    }
    // ====================================================================
    // AREA ENTITY LOADING
    // ====================================================================
    async _loadAreaEntities(areaId) {
        if (!this._hass)
            return;
        const groupedEntities = await getAreaGroupedEntities(areaId, this._hass);
        const hiddenEntities = getHiddenEntitiesForArea(areaId, this._config);
        const entityOrders = getEntityOrdersForArea(areaId, this._config);
        const badgeCandidates = getAreaBadgeCandidates(areaId, this._hass);
        const additionalBadges = getAdditionalBadgesForArea(areaId, this._config);
        const availableEntities = getAvailableBadgeEntities(areaId, this._hass, badgeCandidates, additionalBadges);
        const defaultShowNames = getDefaultShowNameEntities(badgeCandidates, this._hass);
        const { namesVisible, namesHidden } = getBadgeNamesConfig(areaId, this._config);
        this._areaEntitiesCache.set(areaId, {
            groupedEntities,
            hiddenEntities,
            entityOrders,
            badgeCandidates,
            additionalBadges,
            availableEntities,
            defaultShowNames,
            namesVisible,
            namesHidden,
        });
        this.requestUpdate();
    }
    _refreshAreaCache(areaId) {
        if (!this._hass || !this._areaEntitiesCache.has(areaId))
            return;
        const groupedEntities = this._areaEntitiesCache.get(areaId).groupedEntities;
        const hiddenEntities = getHiddenEntitiesForArea(areaId, this._config);
        const entityOrders = getEntityOrdersForArea(areaId, this._config);
        const badgeCandidates = getAreaBadgeCandidates(areaId, this._hass);
        const additionalBadges = getAdditionalBadgesForArea(areaId, this._config);
        const availableEntities = getAvailableBadgeEntities(areaId, this._hass, badgeCandidates, additionalBadges);
        const defaultShowNames = getDefaultShowNameEntities(badgeCandidates, this._hass);
        const { namesVisible, namesHidden } = getBadgeNamesConfig(areaId, this._config);
        this._areaEntitiesCache.set(areaId, {
            groupedEntities,
            hiddenEntities,
            entityOrders,
            badgeCandidates,
            additionalBadges,
            availableEntities,
            defaultShowNames,
            namesVisible,
            namesHidden,
        });
    }
    // ====================================================================
    // EVENT HANDLERS — Toggle / Config changes
    // ====================================================================
    _toggleChanged(key, value, defaultValue) {
        if (!this._hass)
            return;
        const newConfig = {
            ...this._config,
            [key]: value,
        };
        // Remove property when set to default
        if (value === defaultValue) {
            delete newConfig[key];
        }
        this._config = newConfig;
        this._fireConfigChanged(newConfig);
    }
    _summariesColumnsChanged(columns) {
        if (!this._hass)
            return;
        const newConfig = {
            ...this._config,
            summaries_columns: columns,
        };
        if (columns === 2) {
            delete newConfig.summaries_columns;
        }
        this._config = newConfig;
        this._fireConfigChanged(newConfig);
    }
    _alarmEntityChanged(e) {
        if (!this._hass)
            return;
        const entityId = e.target.value;
        const newConfig = {
            ...this._config,
            alarm_entity: entityId,
        };
        if (!entityId || entityId === '') {
            delete newConfig.alarm_entity;
        }
        this._config = newConfig;
        this._fireConfigChanged(newConfig);
    }
    _batteryCriticalChanged(e) {
        const value = parseInt(e.target.value, 10);
        if (isNaN(value) || value < 1 || value > 99)
            return;
        const newConfig = { ...this._config, battery_critical_threshold: value };
        if (value === 20)
            delete newConfig.battery_critical_threshold;
        this._config = newConfig;
        this._fireConfigChanged(newConfig);
    }
    _batteryLowChanged(e) {
        const value = parseInt(e.target.value, 10);
        if (isNaN(value) || value < 1 || value > 99)
            return;
        const newConfig = { ...this._config, battery_low_threshold: value };
        if (value === 50)
            delete newConfig.battery_low_threshold;
        this._config = newConfig;
        this._fireConfigChanged(newConfig);
    }
    // -- Favorites --------------------------------------------------------
    _addFavoriteFromSelect() {
        const select = this.shadowRoot.querySelector('#favorite-entity-select');
        if (!select || !select.value)
            return;
        this._addFavoriteEntity(select.value);
        select.value = '';
    }
    _addFavoriteEntity(entityId) {
        if (!this._hass)
            return;
        const currentFavorites = this._config.favorite_entities || [];
        if (currentFavorites.includes(entityId))
            return;
        const newConfig = {
            ...this._config,
            favorite_entities: [...currentFavorites, entityId],
        };
        this._config = newConfig;
        this._fireConfigChanged(newConfig);
    }
    _removeFavoriteEntity(entityId) {
        if (!this._hass)
            return;
        const currentFavorites = this._config.favorite_entities || [];
        const newFavorites = currentFavorites.filter((id) => id !== entityId);
        const newConfig = {
            ...this._config,
            favorite_entities: newFavorites.length > 0 ? newFavorites : undefined,
        };
        if (newFavorites.length === 0) {
            delete newConfig.favorite_entities;
        }
        this._config = newConfig;
        this._fireConfigChanged(newConfig);
    }
    // -- Room Pins --------------------------------------------------------
    _addRoomPinFromSelect() {
        const select = this.shadowRoot.querySelector('#room-pin-entity-select');
        if (!select || !select.value)
            return;
        this._addRoomPinEntity(select.value);
        select.value = '';
    }
    _addRoomPinEntity(entityId) {
        if (!this._hass)
            return;
        const currentPins = this._config.room_pin_entities || [];
        if (currentPins.includes(entityId))
            return;
        const newConfig = {
            ...this._config,
            room_pin_entities: [...currentPins, entityId],
        };
        this._config = newConfig;
        this._fireConfigChanged(newConfig);
    }
    _removeRoomPinEntity(entityId) {
        if (!this._hass)
            return;
        const currentPins = this._config.room_pin_entities || [];
        const newPins = currentPins.filter((id) => id !== entityId);
        const newConfig = {
            ...this._config,
            room_pin_entities: newPins.length > 0 ? newPins : undefined,
        };
        if (newPins.length === 0) {
            delete newConfig.room_pin_entities;
        }
        this._config = newConfig;
        this._fireConfigChanged(newConfig);
    }
    // -- Custom Views -----------------------------------------------------
    _addCustomView() {
        const customViews = [...(this._config.custom_views || [])];
        customViews.push({
            title: 'Neue View',
            path: `custom-view-${customViews.length + 1}`,
            icon: 'mdi:card-text-outline',
            yaml: '',
            parsed_config: undefined,
        });
        const newConfig = { ...this._config, custom_views: customViews };
        this._config = newConfig;
        this._fireConfigChanged(newConfig);
    }
    _removeCustomView(index) {
        const customViews = [...(this._config.custom_views || [])];
        customViews.splice(index, 1);
        const newConfig = { ...this._config };
        if (customViews.length === 0) {
            delete newConfig.custom_views;
        }
        else {
            newConfig.custom_views = customViews;
        }
        this._config = newConfig;
        this._fireConfigChanged(newConfig);
    }
    _updateCustomViewField(index, field, value) {
        const customViews = [...(this._config.custom_views || [])];
        if (!customViews[index])
            return;
        customViews[index] = { ...customViews[index], [field]: value };
        const newConfig = { ...this._config, custom_views: customViews };
        this._config = newConfig;
        this._fireConfigChanged(newConfig);
    }
    _updateCustomViewYaml(index, yamlString) {
        const customViews = [...(this._config.custom_views || [])];
        if (!customViews[index])
            return;
        const updated = { ...customViews[index], yaml: yamlString };
        delete updated._yaml_error;
        if (yamlString.trim()) {
            try {
                const parsed = js_yaml__WEBPACK_IMPORTED_MODULE_2__["default"].load(yamlString);
                if (parsed && typeof parsed === 'object') {
                    updated.parsed_config = parsed;
                }
                else {
                    updated._yaml_error = 'YAML muss ein Objekt ergeben';
                    updated.parsed_config = undefined;
                }
            }
            catch (e) {
                const message = e instanceof Error ? e.message.split('\n')[0] : 'Ungültiges YAML';
                updated._yaml_error = message || 'Ungültiges YAML';
                updated.parsed_config = undefined;
            }
        }
        else {
            updated.parsed_config = undefined;
        }
        customViews[index] = updated;
        const newConfig = { ...this._config, custom_views: customViews };
        this._config = newConfig;
        this._fireConfigChanged(newConfig);
    }
    // -- Custom Cards -----------------------------------------------------
    _customCardsHeadingChanged(e) {
        const value = e.target.value.trim();
        const newConfig = { ...this._config };
        if (value) {
            newConfig.custom_cards_heading = value;
        }
        else {
            delete newConfig.custom_cards_heading;
        }
        this._config = newConfig;
        this._fireConfigChanged(newConfig);
    }
    _customCardsIconChanged(e) {
        const value = e.target.value.trim();
        const newConfig = { ...this._config };
        if (value) {
            newConfig.custom_cards_icon = value;
        }
        else {
            delete newConfig.custom_cards_icon;
        }
        this._config = newConfig;
        this._fireConfigChanged(newConfig);
    }
    _addCustomCard() {
        const customCards = [...(this._config.custom_cards || [])];
        customCards.push({ title: '', yaml: '', parsed_config: undefined });
        const newConfig = { ...this._config, custom_cards: customCards };
        this._config = newConfig;
        this._fireConfigChanged(newConfig);
    }
    _removeCustomCard(index) {
        const customCards = [...(this._config.custom_cards || [])];
        customCards.splice(index, 1);
        const newConfig = { ...this._config };
        if (customCards.length === 0) {
            delete newConfig.custom_cards;
        }
        else {
            newConfig.custom_cards = customCards;
        }
        this._config = newConfig;
        this._fireConfigChanged(newConfig);
    }
    _updateCustomCardField(index, field, value) {
        const customCards = [...(this._config.custom_cards || [])];
        if (!customCards[index])
            return;
        customCards[index] = { ...customCards[index], [field]: value };
        const newConfig = { ...this._config, custom_cards: customCards };
        this._config = newConfig;
        this._fireConfigChanged(newConfig);
    }
    _updateCustomCardYaml(index, yamlString) {
        const customCards = [...(this._config.custom_cards || [])];
        if (!customCards[index])
            return;
        const updated = { ...customCards[index], yaml: yamlString };
        delete updated._yaml_error;
        if (yamlString.trim()) {
            try {
                const parsed = js_yaml__WEBPACK_IMPORTED_MODULE_2__["default"].load(yamlString);
                if (parsed && typeof parsed === 'object') {
                    updated.parsed_config = parsed;
                }
                else {
                    updated._yaml_error = 'YAML muss ein Objekt oder Array ergeben';
                    updated.parsed_config = undefined;
                }
            }
            catch (e) {
                const message = e instanceof Error ? e.message.split('\n')[0] : 'Ungültiges YAML';
                updated._yaml_error = message || 'Ungültiges YAML';
                updated.parsed_config = undefined;
            }
        }
        else {
            updated.parsed_config = undefined;
        }
        customCards[index] = updated;
        const newConfig = { ...this._config, custom_cards: customCards };
        this._config = newConfig;
        this._fireConfigChanged(newConfig);
    }
    // -- Custom Badges ----------------------------------------------------
    _addCustomBadge() {
        const customBadges = [...(this._config.custom_badges || [])];
        customBadges.push({ yaml: '', parsed_config: undefined });
        const newConfig = { ...this._config, custom_badges: customBadges };
        this._config = newConfig;
        this._fireConfigChanged(newConfig);
    }
    _removeCustomBadge(index) {
        const customBadges = [...(this._config.custom_badges || [])];
        customBadges.splice(index, 1);
        const newConfig = { ...this._config };
        if (customBadges.length === 0) {
            delete newConfig.custom_badges;
        }
        else {
            newConfig.custom_badges = customBadges;
        }
        this._config = newConfig;
        this._fireConfigChanged(newConfig);
    }
    _updateCustomBadgeYaml(index, yamlString) {
        const customBadges = [...(this._config.custom_badges || [])];
        if (!customBadges[index])
            return;
        const updated = { ...customBadges[index], yaml: yamlString };
        delete updated._yaml_error;
        if (yamlString.trim()) {
            try {
                const parsed = js_yaml__WEBPACK_IMPORTED_MODULE_2__["default"].load(yamlString);
                if (parsed && typeof parsed === 'object') {
                    updated.parsed_config = parsed;
                }
                else {
                    updated._yaml_error = 'YAML muss ein Objekt ergeben';
                    updated.parsed_config = undefined;
                }
            }
            catch (e) {
                const message = e instanceof Error ? e.message.split('\n')[0] : 'Ungültiges YAML';
                updated._yaml_error = message || 'Ungültiges YAML';
                updated.parsed_config = undefined;
            }
        }
        else {
            updated.parsed_config = undefined;
        }
        customBadges[index] = updated;
        const newConfig = { ...this._config, custom_badges: customBadges };
        this._config = newConfig;
        this._fireConfigChanged(newConfig);
    }
    // ====================================================================
    // AREA MANAGEMENT
    // ====================================================================
    _areaVisibilityChanged(areaId, isVisible) {
        if (!this._hass)
            return;
        let hiddenAreas = [...(this._config.areas_display?.hidden || [])];
        if (isVisible) {
            hiddenAreas = hiddenAreas.filter((id) => id !== areaId);
        }
        else {
            if (!hiddenAreas.includes(areaId)) {
                hiddenAreas.push(areaId);
            }
            // Collapse area when hidden
            this._expandedAreas.delete(areaId);
            this._expandedGroups.delete(areaId);
            this._areaEntitiesCache.delete(areaId);
        }
        const newConfig = {
            ...this._config,
            areas_display: {
                ...this._config.areas_display,
                hidden: hiddenAreas,
            },
        };
        if (newConfig.areas_display?.hidden?.length === 0) {
            delete newConfig.areas_display.hidden;
        }
        if (newConfig.areas_display && Object.keys(newConfig.areas_display).length === 0) {
            delete newConfig.areas_display;
        }
        this._config = newConfig;
        this._fireConfigChanged(newConfig);
    }
    _toggleAreaExpand(e, areaId) {
        e.stopPropagation();
        const newExpandedAreas = new Set(this._expandedAreas);
        if (newExpandedAreas.has(areaId)) {
            newExpandedAreas.delete(areaId);
            const newExpandedGroups = new Map(this._expandedGroups);
            newExpandedGroups.delete(areaId);
            this._expandedGroups = newExpandedGroups;
        }
        else {
            newExpandedAreas.add(areaId);
            // Load entities if not cached
            if (!this._areaEntitiesCache.has(areaId)) {
                void this._loadAreaEntities(areaId);
            }
        }
        this._expandedAreas = newExpandedAreas;
    }
    _toggleGroupExpand(areaId, groupKey) {
        const newExpandedGroups = new Map(this._expandedGroups);
        const areaGroups = new Set(newExpandedGroups.get(areaId) || []);
        if (areaGroups.has(groupKey)) {
            areaGroups.delete(groupKey);
        }
        else {
            areaGroups.add(groupKey);
        }
        if (areaGroups.size > 0) {
            newExpandedGroups.set(areaId, areaGroups);
        }
        else {
            newExpandedGroups.delete(areaId);
        }
        this._expandedGroups = newExpandedGroups;
    }
    _groupVisibilityChanged(areaId, group, isVisible, entities) {
        if (!this._hass)
            return;
        const currentAreaOptions = this._config.areas_options?.[areaId] || {};
        const currentGroupsOptions = currentAreaOptions.groups_options || {};
        const currentGroupOptions = currentGroupsOptions[group];
        let hiddenEntities = [...(currentGroupOptions?.hidden || [])];
        if (isVisible) {
            hiddenEntities = hiddenEntities.filter((e) => !entities.includes(e));
        }
        else {
            hiddenEntities = [...new Set([...hiddenEntities, ...entities])];
        }
        this._updateEntityConfig(areaId, group, hiddenEntities);
    }
    _entityVisibilityChanged(areaId, group, entityId, isVisible) {
        if (!this._hass)
            return;
        // Handle badge additional entities
        if (group === 'badges_additional') {
            this._badgeAdditionalChanged(areaId, entityId, isVisible);
            return;
        }
        // Handle badge show_name toggle
        if (group === 'badges_show_name') {
            this._badgeShowNameChanged(areaId, entityId, isVisible);
            return;
        }
        const currentAreaOptions = this._config.areas_options?.[areaId] || {};
        const currentGroupsOptions = currentAreaOptions.groups_options || {};
        const currentGroupOptions = currentGroupsOptions[group];
        let hiddenEntities = [...(currentGroupOptions?.hidden || [])];
        if (isVisible) {
            hiddenEntities = hiddenEntities.filter((e) => e !== entityId);
        }
        else {
            if (!hiddenEntities.includes(entityId)) {
                hiddenEntities.push(entityId);
            }
        }
        this._updateEntityConfig(areaId, group, hiddenEntities);
    }
    _updateEntityConfig(areaId, group, hiddenEntities) {
        const currentAreaOptions = this._config.areas_options?.[areaId] || {};
        const currentGroupsOptions = currentAreaOptions.groups_options || {};
        const currentGroupOptions = currentGroupsOptions[group];
        const newGroupOptions = {
            ...currentGroupOptions,
            hidden: hiddenEntities,
        };
        if (newGroupOptions.hidden.length === 0) {
            delete newGroupOptions.hidden;
        }
        const newGroupsOptions = {
            ...currentGroupsOptions,
            [group]: newGroupOptions,
        };
        if (Object.keys(newGroupsOptions[group]).length === 0) {
            delete newGroupsOptions[group];
        }
        const newAreaOptions = {
            ...currentAreaOptions,
            groups_options: newGroupsOptions,
        };
        if (Object.keys(newAreaOptions.groups_options).length === 0) {
            delete newAreaOptions.groups_options;
        }
        const newAreasOptions = {
            ...this._config.areas_options,
            [areaId]: newAreaOptions,
        };
        if (Object.keys(newAreasOptions[areaId]).length === 0) {
            delete newAreasOptions[areaId];
        }
        const newConfig = {
            ...this._config,
            areas_options: newAreasOptions,
        };
        if (newConfig.areas_options && Object.keys(newConfig.areas_options).length === 0) {
            delete newConfig.areas_options;
        }
        this._config = newConfig;
        this._fireConfigChanged(newConfig);
        // Refresh cached data so re-render picks up the changes
        this._refreshAreaCache(areaId);
    }
    // -- Badge additional and show_name -----------------------------------
    _badgeAdditionalChanged(areaId, entityId, isAdd) {
        if (!this._config)
            return;
        const currentAreaOptions = this._config.areas_options?.[areaId] || {};
        const currentGroupsOptions = currentAreaOptions.groups_options || {};
        const currentBadgeOptions = currentGroupsOptions['badges'] || {};
        let additional = [...(currentBadgeOptions.additional || [])];
        if (isAdd) {
            if (!additional.includes(entityId))
                additional.push(entityId);
        }
        else {
            additional = additional.filter((e) => e !== entityId);
        }
        const newBadgeOptions = { ...currentBadgeOptions };
        if (additional.length > 0) {
            newBadgeOptions.additional = additional;
        }
        else {
            delete newBadgeOptions.additional;
        }
        const newGroupsOptions = {
            ...currentGroupsOptions,
            badges: newBadgeOptions,
        };
        if (Object.keys(newGroupsOptions.badges).length === 0) {
            delete newGroupsOptions.badges;
        }
        const newAreaOptions = {
            ...currentAreaOptions,
            groups_options: newGroupsOptions,
        };
        if (Object.keys(newAreaOptions.groups_options).length === 0) {
            delete newAreaOptions.groups_options;
        }
        const newAreasOptions = {
            ...this._config.areas_options,
            [areaId]: newAreaOptions,
        };
        if (Object.keys(newAreasOptions[areaId]).length === 0) {
            delete newAreasOptions[areaId];
        }
        const newConfig = {
            ...this._config,
            areas_options: newAreasOptions,
        };
        if (newConfig.areas_options && Object.keys(newConfig.areas_options).length === 0) {
            delete newConfig.areas_options;
        }
        this._config = newConfig;
        this._fireConfigChanged(newConfig);
        // Refresh cached data
        this._refreshAreaCache(areaId);
    }
    _badgeShowNameChanged(areaId, entityId, showName) {
        if (!this._config || !this._hass)
            return;
        const currentAreaOptions = this._config.areas_options?.[areaId] || {};
        const currentGroupsOptions = currentAreaOptions.groups_options || {};
        const currentBadgeOptions = currentGroupsOptions['badges'] || {};
        let namesVisible = [...(currentBadgeOptions.names_visible || [])];
        let namesHidden = [...(currentBadgeOptions.names_hidden || [])];
        const stateObj = this._hass.states[entityId];
        const dc = stateObj?.attributes?.device_class;
        const defaultShowName = (0,_utils_badge_utils__WEBPACK_IMPORTED_MODULE_5__.isDefaultShowName)(dc);
        if (showName === defaultShowName) {
            namesVisible = namesVisible.filter((e) => e !== entityId);
            namesHidden = namesHidden.filter((e) => e !== entityId);
        }
        else if (showName) {
            if (!namesVisible.includes(entityId))
                namesVisible.push(entityId);
            namesHidden = namesHidden.filter((e) => e !== entityId);
        }
        else {
            namesVisible = namesVisible.filter((e) => e !== entityId);
            if (!namesHidden.includes(entityId))
                namesHidden.push(entityId);
        }
        const newBadgeOptions = { ...currentBadgeOptions };
        if (namesVisible.length > 0)
            newBadgeOptions.names_visible = namesVisible;
        else
            delete newBadgeOptions.names_visible;
        if (namesHidden.length > 0)
            newBadgeOptions.names_hidden = namesHidden;
        else
            delete newBadgeOptions.names_hidden;
        const newGroupsOptions = { ...currentGroupsOptions, badges: newBadgeOptions };
        if (Object.keys(newGroupsOptions.badges).length === 0)
            delete newGroupsOptions.badges;
        const newAreaOptions = { ...currentAreaOptions, groups_options: newGroupsOptions };
        if (Object.keys(newAreaOptions.groups_options).length === 0)
            delete newAreaOptions.groups_options;
        const newAreasOptions = { ...this._config.areas_options, [areaId]: newAreaOptions };
        if (Object.keys(newAreasOptions[areaId]).length === 0)
            delete newAreasOptions[areaId];
        const newConfig = { ...this._config, areas_options: newAreasOptions };
        if (newConfig.areas_options && Object.keys(newConfig.areas_options).length === 0)
            delete newConfig.areas_options;
        this._config = newConfig;
        this._fireConfigChanged(newConfig);
        // Refresh cached data
        this._refreshAreaCache(areaId);
    }
    _addBadgeFromPicker(e, areaId) {
        e.stopPropagation();
        const picker = this.shadowRoot.querySelector(`.badge-entity-picker[data-area-id="${areaId}"]`);
        if (!picker || !picker.value)
            return;
        const entityId = picker.value;
        this._badgeAdditionalChanged(areaId, entityId, true);
        picker.value = '';
    }
    _getAreaOrder() {
        if (!this._hass)
            return [];
        const configOrder = this._config.areas_display?.order;
        if (configOrder && configOrder.length > 0)
            return [...configOrder];
        return Object.keys(this._hass.areas || {});
    }
    _updateAreaOrder(newOrder) {
        const newConfig = {
            ...this._config,
            areas_display: {
                ...this._config.areas_display,
                order: newOrder,
            },
        };
        this._config = newConfig;
        this._fireConfigChanged(newConfig);
    }
    // ====================================================================
    // CONFIG DISPATCH
    // ====================================================================
    _fireConfigChanged(config) {
        this._isUpdatingConfig = true;
        // Strip internal fields before saving
        const cleanConfig = { ...config };
        if (cleanConfig.custom_views) {
            cleanConfig.custom_views = cleanConfig.custom_views.map((cv) => {
                const clean = { ...cv };
                delete clean._yaml_error;
                return clean;
            });
        }
        if (cleanConfig.custom_cards) {
            cleanConfig.custom_cards = cleanConfig.custom_cards.map((cc) => {
                const clean = { ...cc };
                delete clean._yaml_error;
                return clean;
            });
        }
        if (cleanConfig.custom_badges) {
            cleanConfig.custom_badges = cleanConfig.custom_badges.map((cb) => {
                const clean = { ...cb };
                delete clean._yaml_error;
                return clean;
            });
        }
        this._config = cleanConfig;
        const event = new CustomEvent('config-changed', {
            detail: { config: cleanConfig },
            bubbles: true,
            composed: true,
        });
        this.dispatchEvent(event);
        // Reset flag after one tick
        setTimeout(() => {
            this._isUpdatingConfig = false;
        }, 0);
    }
}
Simon42DashboardStrategyEditor.properties = {
    _config: { state: true },
    _expandedAreas: { state: true },
    _expandedGroups: { state: true },
};
// -- Styles -----------------------------------------------------------
Simon42DashboardStrategyEditor.styles = (0,lit__WEBPACK_IMPORTED_MODULE_0__.css) `
    /* -- Base layout --------------------------------------------------- */
    .card-config {
      padding: 16px;
      font-family: var(--paper-font-body1_-_font-family, Roboto, sans-serif);
      font-size: var(--mdc-typography-body1-font-size, 14px);
      color: var(--primary-text-color);
    }
    .section {
      margin-bottom: 16px;
      background: var(--card-background-color, #fff);
      border: 1px solid var(--divider-color, #e8e8e8);
      border-radius: var(--ha-card-border-radius, 12px);
      padding: 16px;
      transition: box-shadow 0.2s ease;
    }
    .section-title {
      font-size: 15px;
      font-weight: 500;
      margin: 0 0 12px 0;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--divider-color, #e8e8e8);
      color: var(--primary-text-color);
      letter-spacing: 0.01em;
    }

    /* -- Form rows ----------------------------------------------------- */
    .form-row {
      display: flex;
      align-items: center;
      margin-bottom: 8px;
    }
    .form-row input[type="checkbox"],
    .form-row input[type="radio"] {
      margin-right: 8px;
      width: 18px;
      height: 18px;
      cursor: pointer;
      accent-color: var(--primary-color);
    }
    .form-row input[type="checkbox"]:disabled,
    .form-row input[type="radio"]:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }
    .form-row label {
      cursor: pointer;
      user-select: none;
      font-size: 14px;
      color: var(--primary-text-color);
    }
    .form-row label.disabled-label {
      cursor: not-allowed;
      opacity: 0.5;
    }
    .form-row .alarm-select {
      flex: 1;
      max-width: 300px;
    }
    .description {
      font-size: 12px;
      color: var(--secondary-text-color);
      margin: 2px 0 12px 26px;
      line-height: 1.4;
    }
    .description strong {
      font-weight: 600;
      color: var(--primary-text-color);
    }

    /* -- Native <select> — HA-like ------------------------------------- */
    select,
    .form-row select {
      cursor: pointer;
      font-family: inherit;
      font-size: 14px;
      padding: 10px 32px 10px 12px;
      border: 1px solid var(--divider-color);
      border-radius: var(--ha-card-border-radius, 12px);
      background-color: var(--card-background-color);
      color: var(--primary-text-color);
      appearance: none;
      -webkit-appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24'%3E%3Cpath fill='%236e6e6e' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 10px center;
      background-size: 16px;
      transition: border-color 0.2s ease;
    }
    select:focus,
    .form-row select:focus {
      outline: none;
      border-color: var(--primary-color);
      box-shadow: 0 0 0 1px var(--primary-color);
    }
    select:hover,
    .form-row select:hover {
      border-color: var(--primary-color);
    }

    /* -- Native <input type="text/number"> — HA-like ------------------- */
    input[type="text"],
    input[type="number"] {
      font-family: inherit;
      font-size: 14px;
      padding: 10px 12px;
      border: 1px solid var(--divider-color);
      border-radius: var(--ha-card-border-radius, 12px);
      background: var(--card-background-color);
      color: var(--primary-text-color);
      transition: border-color 0.2s ease;
      box-sizing: border-box;
    }
    input[type="text"]:focus,
    input[type="number"]:focus {
      outline: none;
      border-color: var(--primary-color);
      box-shadow: 0 0 0 1px var(--primary-color);
    }
    input[type="text"]:hover,
    input[type="number"]:hover {
      border-color: var(--primary-color);
    }
    input[type="text"]::placeholder {
      color: var(--secondary-text-color);
      opacity: 0.7;
    }

    /* -- Native <textarea> — YAML editors ------------------------------ */
    textarea {
      font-family: "Roboto Mono", "SFMono-Regular", "Consolas", "Liberation Mono", monospace;
      font-size: 12px;
      line-height: 1.5;
      padding: 12px;
      border: 1px solid var(--divider-color);
      border-radius: var(--ha-card-border-radius, 12px);
      background: var(--card-background-color);
      color: var(--primary-text-color);
      resize: vertical;
      min-height: 80px;
      box-sizing: border-box;
      transition: border-color 0.2s ease;
      tab-size: 2;
    }
    textarea:focus {
      outline: none;
      border-color: var(--primary-color);
      box-shadow: 0 0 0 1px var(--primary-color);
    }
    textarea:hover {
      border-color: var(--primary-color);
    }
    textarea::placeholder {
      color: var(--secondary-text-color);
      opacity: 0.7;
      font-family: inherit;
    }

    /* -- Buttons — HA-like --------------------------------------------- */
    button {
      font-family: inherit;
      font-size: 14px;
    }
    .btn-primary {
      padding: 10px 20px;
      border-radius: var(--ha-card-border-radius, 12px);
      border: none;
      background: var(--primary-color);
      color: var(--text-primary-color, #fff);
      cursor: pointer;
      font-weight: 500;
      transition: opacity 0.2s ease, box-shadow 0.2s ease;
      white-space: nowrap;
    }
    .btn-primary:hover {
      opacity: 0.85;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
    }
    .btn-primary:active {
      opacity: 0.75;
    }
    .btn-remove {
      padding: 6px 10px;
      border-radius: 8px;
      border: 1px solid var(--divider-color);
      background: var(--card-background-color);
      color: var(--secondary-text-color);
      cursor: pointer;
      font-size: 14px;
      transition: color 0.2s ease, border-color 0.2s ease;
      line-height: 1;
    }
    .btn-remove:hover {
      color: var(--error-color, #db4437);
      border-color: var(--error-color, #db4437);
    }

    /* -- Area list ----------------------------------------------------- */
    .area-list {
      border: 1px solid var(--divider-color);
      border-radius: var(--ha-card-border-radius, 12px);
      overflow: hidden;
    }
    .area-item {
      border-bottom: 1px solid var(--divider-color);
      background: var(--card-background-color);
    }
    .area-item:last-child {
      border-bottom: none;
    }
    .area-item.dragging {
      opacity: 0.5;
    }
    .area-item.drag-over {
      border-top: 2px solid var(--primary-color);
    }
    .area-header {
      display: flex;
      align-items: center;
      padding: 12px 16px;
    }
    .drag-handle {
      margin-right: 12px;
      color: var(--secondary-text-color);
      cursor: grab;
      user-select: none;
      padding: 4px;
    }
    .drag-handle:active {
      cursor: grabbing;
    }
    .area-checkbox {
      margin-right: 12px;
      accent-color: var(--primary-color);
    }
    .area-name {
      flex: 1;
      font-size: 14px;
      font-weight: 500;
    }
    .area-icon {
      margin-left: 8px;
      margin-right: 12px;
      color: var(--secondary-text-color);
    }
    .expand-button {
      background: none;
      border: none;
      padding: 4px 8px;
      cursor: pointer;
      color: var(--secondary-text-color);
      transition: transform 0.2s;
    }
    .expand-button:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }
    .expand-button.expanded .expand-icon {
      transform: rotate(90deg);
    }
    .expand-icon {
      display: inline-block;
      transition: transform 0.2s;
    }
    .area-content {
      padding: 0 12px 12px 48px;
      background: var(--secondary-background-color);
    }
    .loading-placeholder {
      padding: 12px;
      text-align: center;
      color: var(--secondary-text-color);
      font-style: italic;
    }

    /* -- Section order list --------------------------------------------- */
    .section-order-list {
      border: 1px solid var(--divider-color);
      border-radius: var(--ha-card-border-radius, 12px);
      overflow: hidden;
    }
    .section-order-item {
      display: flex;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid var(--divider-color);
      background: var(--card-background-color);
      transition: opacity 0.2s;
    }
    .section-order-item:last-child {
      border-bottom: none;
    }
    .section-order-item.dragging {
      opacity: 0.4;
    }
    .section-order-item.drag-over {
      border-top: 2px solid var(--primary-color);
    }
    .section-order-item.disabled {
      opacity: 0.5;
    }
    .section-order-item .drag-handle {
      margin-right: 12px;
      color: var(--secondary-text-color);
      cursor: grab;
      user-select: none;
      padding: 4px;
    }
    .section-order-item .drag-handle:active {
      cursor: grabbing;
    }
    .section-order-item .section-icon {
      margin-right: 10px;
      color: var(--secondary-text-color);
      --mdc-icon-size: 20px;
    }
    .section-order-item .section-label {
      flex: 1;
      font-size: 14px;
      font-weight: 500;
    }
    .section-order-item .section-hidden-tag {
      font-size: 12px;
      color: var(--secondary-text-color);
      font-style: italic;
      margin-left: 8px;
    }
    .section-order-item .section-toggle {
      margin-left: auto;
      cursor: pointer;
    }
    .section-order-item .section-toggle input {
      cursor: pointer;
      width: 16px;
      height: 16px;
    }
    .section-order-sub {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px 8px 56px;
      border-bottom: 1px solid var(--divider-color);
      font-size: 13px;
      color: var(--secondary-text-color);
    }
    .section-order-sub input {
      cursor: pointer;
    }
    .section-order-sub label {
      cursor: pointer;
    }

    /* -- Entity groups ------------------------------------------------- */
    .entity-groups {
      padding-top: 8px;
    }
    .entity-group {
      margin-bottom: 8px;
      border: 1px solid var(--divider-color);
      border-radius: 8px;
      background: var(--card-background-color);
      overflow: hidden;
    }
    .entity-group-header {
      display: flex;
      align-items: center;
      padding: 10px 12px;
      cursor: pointer;
      user-select: none;
      transition: background-color 0.15s ease;
    }
    .entity-group-header:hover {
      background: var(--secondary-background-color);
    }
    .group-checkbox {
      margin-right: 8px;
      width: 16px;
      height: 16px;
      cursor: pointer;
      accent-color: var(--primary-color);
    }
    .group-checkbox[data-indeterminate="true"] {
      opacity: 0.6;
    }
    .entity-group-header ha-icon {
      margin-right: 8px;
      --mdc-icon-size: 18px;
      color: var(--secondary-text-color);
    }
    .group-name {
      flex: 1;
      font-weight: 500;
      font-size: 14px;
    }
    .entity-count {
      color: var(--secondary-text-color);
      font-size: 12px;
      margin-right: 8px;
    }
    .expand-button-small {
      background: none;
      border: none;
      padding: 4px;
      cursor: pointer;
      color: var(--secondary-text-color);
    }
    .expand-button-small.expanded .expand-icon-small {
      transform: rotate(90deg);
    }
    .expand-icon-small {
      display: inline-block;
      font-size: 12px;
      transition: transform 0.2s;
    }

    /* -- Entity list --------------------------------------------------- */
    .entity-list {
      padding: 8px 12px 8px 36px;
      border-top: 1px solid var(--divider-color);
    }
    .entity-item {
      display: flex;
      align-items: center;
      padding: 6px 0;
    }
    .entity-checkbox {
      margin-right: 8px;
      width: 16px;
      height: 16px;
      cursor: pointer;
      accent-color: var(--primary-color);
    }
    .entity-name {
      flex: 1;
      font-size: 14px;
    }
    .entity-id {
      font-size: 11px;
      color: var(--secondary-text-color);
      font-family: "Roboto Mono", monospace;
      margin-left: 8px;
    }
    .empty-state {
      padding: 24px;
      text-align: center;
      color: var(--secondary-text-color);
      font-style: italic;
    }

    /* -- Badge entity management --------------------------------------- */
    .badge-separator {
      padding: 8px 0 4px;
      font-size: 12px;
      font-weight: 500;
      color: var(--secondary-text-color);
      border-top: 1px dashed var(--divider-color);
      margin-top: 4px;
    }
    .badge-additional-item {
      padding-left: 0;
    }
    .badge-remove-btn {
      background: none;
      border: none;
      padding: 2px 6px;
      cursor: pointer;
      color: var(--error-color, #db4437);
      font-size: 14px;
      margin-left: 8px;
      border-radius: 4px;
      transition: background-color 0.15s ease;
    }
    .badge-remove-btn:hover {
      background: var(--secondary-background-color);
    }
    .badge-add-section {
      display: flex;
      gap: 8px;
      padding: 8px 0 4px;
      align-items: center;
    }
    .badge-entity-picker {
      flex: 1;
      padding: 8px 12px;
      border: 1px solid var(--divider-color);
      border-radius: 8px;
      background: var(--card-background-color);
      color: var(--primary-text-color);
      font-size: 13px;
    }
    .badge-add-button {
      padding: 8px 16px;
      border: none;
      border-radius: 8px;
      background: var(--primary-color);
      color: var(--text-primary-color, #fff);
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      white-space: nowrap;
      transition: opacity 0.2s ease;
    }
    .badge-add-button:hover {
      opacity: 0.85;
    }
    .badge-name-checkbox {
      margin-left: auto;
      margin-right: 2px;
      width: 14px;
      height: 14px;
      cursor: pointer;
      accent-color: var(--primary-color);
    }
    .badge-name-label {
      font-size: 11px;
      color: var(--secondary-text-color);
      margin-right: 8px;
      white-space: nowrap;
    }

    /* -- Entity search picker ------------------------------------------ */
    .entity-search-picker {
      position: relative;
      flex: 1;
      min-width: 0;
    }
    .entity-search-input {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--divider-color);
      border-radius: var(--ha-card-border-radius, 12px);
      background: var(--card-background-color);
      color: var(--primary-text-color);
      font-family: inherit;
      font-size: 14px;
      box-sizing: border-box;
      transition: border-color 0.2s ease;
    }
    .entity-search-input:focus {
      outline: none;
      border-color: var(--primary-color);
      box-shadow: 0 0 0 1px var(--primary-color);
    }
    .entity-search-input::placeholder {
      color: var(--secondary-text-color);
      opacity: 0.7;
    }
    .entity-search-results {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      z-index: 10;
      margin-top: 4px;
      border: 1px solid var(--divider-color);
      border-radius: var(--ha-card-border-radius, 12px);
      background: var(--card-background-color);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
      overflow: hidden;
      max-height: 320px;
      overflow-y: auto;
    }
    .entity-search-result {
      display: flex;
      flex-direction: column;
      padding: 10px 14px;
      cursor: pointer;
      transition: background-color 0.1s ease;
      border-bottom: 1px solid var(--divider-color);
    }
    .entity-search-result:last-child {
      border-bottom: none;
    }
    .entity-search-result:hover {
      background: var(--secondary-background-color);
    }
    .entity-search-result .entity-search-name {
      font-size: 14px;
      font-weight: 500;
      color: var(--primary-text-color);
    }
    .entity-search-result .entity-search-id {
      font-size: 11px;
      color: var(--secondary-text-color);
      font-family: "Roboto Mono", monospace;
      margin-top: 2px;
    }
    .entity-search-no-results {
      padding: 12px 14px;
      color: var(--secondary-text-color);
      font-style: italic;
      font-size: 13px;
    }

    /* -- Favorites / Room Pins list items ------------------------------ */
    .entity-list-container {
      border: 1px solid var(--divider-color);
      border-radius: var(--ha-card-border-radius, 12px);
      overflow: hidden;
    }
    .entity-list-item {
      display: flex;
      align-items: center;
      padding: 10px 14px;
      border-bottom: 1px solid var(--divider-color);
      background: var(--card-background-color);
      transition: background-color 0.1s ease;
    }
    .entity-list-item:last-child {
      border-bottom: none;
    }
    .entity-list-item:hover {
      background: var(--secondary-background-color);
    }
    .entity-list-item .drag-icon {
      margin-right: 12px;
      color: var(--secondary-text-color);
      font-size: 16px;
      cursor: grab;
      user-select: none;
      padding: 4px;
    }
    .entity-list-item .drag-icon:active {
      cursor: grabbing;
    }
    .entity-list-item.dragging {
      opacity: 0.5;
    }
    .entity-list-item.drag-over {
      border-top: 2px solid var(--primary-color);
    }
    .entity-list-item .item-info {
      flex: 1;
      min-width: 0;
      font-size: 14px;
    }
    .entity-list-item .item-name {
      font-weight: 500;
      color: var(--primary-text-color);
    }
    .entity-list-item .item-entity-id {
      margin-left: 8px;
      font-size: 12px;
      color: var(--secondary-text-color);
      font-family: "Roboto Mono", monospace;
    }
    .entity-list-item .item-area {
      display: block;
      font-size: 11px;
      color: var(--secondary-text-color);
      margin-top: 2px;
    }

    /* -- Custom view/card/badge items ---------------------------------- */
    .custom-item {
      border: 1px solid var(--divider-color);
      border-radius: var(--ha-card-border-radius, 12px);
      padding: 16px;
      margin-bottom: 12px;
      background: var(--card-background-color);
    }
    .custom-item-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .custom-item-header strong {
      font-size: 14px;
      font-weight: 500;
    }
    .custom-item-fields {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .custom-card-target {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
    }
    .custom-card-target label {
      color: var(--secondary-text-color);
      white-space: nowrap;
    }
    .custom-card-target select {
      flex: 1;
      padding: 4px 8px;
      border: 1px solid var(--divider-color);
      border-radius: 4px;
      background: var(--card-background-color);
      color: var(--primary-text-color);
      font-size: 13px;
    }
    .custom-item-row {
      display: flex;
      gap: 8px;
    }
    .custom-item-validation {
      font-size: 12px;
      min-height: 16px;
    }

    /* -- Section dividers ---------------------------------------------- */
    .section-divider {
      margin: 28px 0 12px;
      padding: 0;
    }
    .section-divider-title {
      font-size: 13px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--secondary-text-color);
    }

    /* -- Mobile responsive --------------------------------------------- */
    @media (max-width: 600px) {
      .card-config {
        padding: 12px 8px;
      }
      .section {
        margin-bottom: 16px;
      }
      .section-title {
        font-size: 15px;
        margin-bottom: 8px;
      }
      .form-row {
        flex-wrap: wrap;
        gap: 4px;
      }
      .form-row label {
        font-size: 13px;
      }
      .description {
        margin-left: 26px;
        margin-bottom: 12px;
        font-size: 11px;
      }

      select,
      .form-row select {
        width: 100%;
        min-width: 0;
        font-size: 13px;
        padding: 8px 28px 8px 10px;
      }
      input[type="text"],
      input[type="number"] {
        width: 100%;
        font-size: 13px;
        padding: 8px 10px;
      }
      textarea {
        font-size: 11px;
        padding: 10px;
        min-height: 60px;
      }

      .entity-search-picker {
        width: 100%;
      }
      .entity-search-results {
        max-height: 240px;
      }
      .entity-search-result {
        padding: 8px 10px;
      }

      .area-header {
        padding: 10px 12px;
      }
      .area-content {
        padding: 0 8px 8px 24px;
      }
      .entity-list {
        padding: 6px 8px 6px 16px;
      }

      .custom-item {
        padding: 12px;
      }
      .custom-item-row {
        flex-direction: column;
      }

      .entity-list-item {
        padding: 8px 10px;
      }
      .entity-list-item .item-entity-id {
        display: block;
        margin-left: 0;
        margin-top: 2px;
      }

      .badge-add-section {
        flex-wrap: wrap;
      }

      .btn-primary {
        padding: 8px 16px;
        font-size: 13px;
      }
    }
  `;
Simon42DashboardStrategyEditor._sectionMeta = new Map([
    ['overview', { icon: 'mdi:home-outline', labelKey: 'sections.overview' }],
    ['custom_cards', { icon: 'mdi:cards', labelKey: 'sections.custom_cards' }],
    ['areas', { icon: 'mdi:floor-plan', labelKey: 'sections.areas' }],
    ['weather', { icon: 'mdi:weather-partly-cloudy', labelKey: 'sections.weather' }],
    ['energy', { icon: 'mdi:lightning-bolt', labelKey: 'sections.energy' }],
]);
// ====================================================================
// HELPER FUNCTIONS (local to this module)
// ====================================================================
async function getAreaGroupedEntities(areaId, hass) {
    const devices = Object.values(hass.devices || {});
    const entities = Object.values(hass.entities || {});
    const areaDevices = new Set();
    for (const device of devices) {
        if (device.area_id === areaId) {
            areaDevices.add(device.id);
        }
    }
    const roomEntities = {
        lights: [],
        covers: [],
        covers_curtain: [],
        covers_window: [],
        scenes: [],
        climate: [],
        media_player: [],
        vacuum: [],
        fan: [],
        switches: [],
        locks: [],
        automations: [],
        scripts: [],
        cameras: [],
    };
    const excludeLabels = entities
        .filter((e) => e.labels?.includes('no_dboard'))
        .map((e) => e.entity_id);
    for (const entity of entities) {
        let belongsToArea = false;
        if (entity.area_id) {
            belongsToArea = entity.area_id === areaId;
        }
        else if (entity.device_id && areaDevices.has(entity.device_id)) {
            belongsToArea = true;
        }
        if (!belongsToArea)
            continue;
        if (excludeLabels.includes(entity.entity_id))
            continue;
        if (!hass.states[entity.entity_id])
            continue;
        if (entity.hidden)
            continue;
        const entityRegistry = hass.entities?.[entity.entity_id];
        if (entityRegistry?.hidden)
            continue;
        const domain = entity.entity_id.split('.')[0];
        const stateObj = hass.states[entity.entity_id];
        const deviceClass = stateObj.attributes?.device_class;
        if (domain === 'light') {
            roomEntities.lights.push(entity.entity_id);
        }
        else if (domain === 'cover') {
            if (deviceClass === 'curtain') {
                roomEntities.covers_curtain.push(entity.entity_id);
            }
            else if (deviceClass === 'window' || deviceClass === 'door' || deviceClass === 'gate' || deviceClass === 'garage') {
                roomEntities.covers_window.push(entity.entity_id);
            }
            else {
                roomEntities.covers.push(entity.entity_id);
            }
        }
        else if (domain === 'scene') {
            roomEntities.scenes.push(entity.entity_id);
        }
        else if (domain === 'climate') {
            roomEntities.climate.push(entity.entity_id);
        }
        else if (domain === 'media_player') {
            roomEntities.media_player.push(entity.entity_id);
        }
        else if (domain === 'vacuum') {
            roomEntities.vacuum.push(entity.entity_id);
        }
        else if (domain === 'fan') {
            roomEntities.fan.push(entity.entity_id);
        }
        else if (domain === 'switch') {
            roomEntities.switches.push(entity.entity_id);
        }
        else if (domain === 'lock') {
            roomEntities.locks.push(entity.entity_id);
        }
    }
    return roomEntities;
}
function getAreaBadgeCandidates(areaId, hass) {
    const devices = Object.values(hass.devices || {});
    const entities = Object.values(hass.entities || {});
    const areaDevices = new Set();
    for (const device of devices) {
        if (device.area_id === areaId)
            areaDevices.add(device.id);
    }
    const candidates = [];
    for (const entity of entities) {
        let belongsToArea = false;
        if (entity.area_id)
            belongsToArea = entity.area_id === areaId;
        else if (entity.device_id && areaDevices.has(entity.device_id))
            belongsToArea = true;
        if (!belongsToArea)
            continue;
        if (entity.hidden)
            continue;
        if (entity.labels?.includes('no_dboard'))
            continue;
        if (!hass.states[entity.entity_id])
            continue;
        const domain = entity.entity_id.split('.')[0];
        const stateObj = hass.states[entity.entity_id];
        const dc = stateObj.attributes?.device_class;
        const unit = stateObj.attributes?.unit_of_measurement;
        if (!(0,_utils_badge_utils__WEBPACK_IMPORTED_MODULE_5__.isBadgeCandidate)(domain, dc, unit, entity.entity_id))
            continue;
        if (domain === 'sensor' && (dc === 'battery' || entity.entity_id.includes('battery'))) {
            const val = parseFloat(stateObj.state);
            if (!isNaN(val) && val < 20)
                candidates.push(entity.entity_id);
            continue;
        }
        candidates.push(entity.entity_id);
    }
    return candidates;
}
function getAdditionalBadgesForArea(areaId, config) {
    return config.areas_options?.[areaId]?.groups_options?.badges?.additional || [];
}
function getAvailableBadgeEntities(areaId, hass, existingCandidates, existingAdditional) {
    const devices = Object.values(hass.devices || {});
    const entities = Object.values(hass.entities || {});
    const excludeSet = new Set([...existingCandidates, ...existingAdditional]);
    const areaDevices = new Set();
    for (const device of devices) {
        if (device.area_id === areaId)
            areaDevices.add(device.id);
    }
    const available = [];
    for (const entity of entities) {
        let belongsToArea = false;
        if (entity.area_id)
            belongsToArea = entity.area_id === areaId;
        else if (entity.device_id && areaDevices.has(entity.device_id))
            belongsToArea = true;
        if (!belongsToArea)
            continue;
        if (entity.hidden)
            continue;
        if (!hass.states[entity.entity_id])
            continue;
        const domain = entity.entity_id.split('.')[0];
        if (domain !== 'sensor' && domain !== 'binary_sensor')
            continue;
        if (excludeSet.has(entity.entity_id))
            continue;
        const stateObj = hass.states[entity.entity_id];
        const name = stateObj.attributes?.friendly_name || entity.entity_id.split('.')[1].replace(/_/g, ' ');
        available.push({ entity_id: entity.entity_id, name });
    }
    available.sort((a, b) => a.name.localeCompare(b.name));
    return available;
}
function getDefaultShowNameEntities(badgeCandidates, hass) {
    const result = new Set();
    for (const entityId of badgeCandidates) {
        const stateObj = hass.states[entityId];
        if (!stateObj)
            continue;
        const dc = stateObj.attributes?.device_class;
        if ((0,_utils_badge_utils__WEBPACK_IMPORTED_MODULE_5__.isDefaultShowName)(dc))
            result.add(entityId);
    }
    return result;
}
function getBadgeNamesConfig(areaId, config) {
    const opts = config.areas_options?.[areaId]?.groups_options?.badges;
    return {
        namesVisible: opts?.names_visible || [],
        namesHidden: opts?.names_hidden || [],
    };
}
function getHiddenEntitiesForArea(areaId, config) {
    const areaOptions = config.areas_options?.[areaId];
    if (!areaOptions || !areaOptions.groups_options) {
        return {};
    }
    const hidden = {};
    for (const [group, options] of Object.entries(areaOptions.groups_options)) {
        if (options.hidden) {
            hidden[group] = options.hidden;
        }
    }
    return hidden;
}
function getEntityOrdersForArea(areaId, config) {
    const areaOptions = config.areas_options?.[areaId];
    if (!areaOptions || !areaOptions.groups_options) {
        return {};
    }
    const orders = {};
    for (const [group, options] of Object.entries(areaOptions.groups_options)) {
        if (options.order) {
            orders[group] = options.order;
        }
    }
    return orders;
}
// Register custom element
customElements.define('simon42-dashboard-strategy-editor', Simon42DashboardStrategyEditor);


/***/ },

/***/ "./src/sections/AreasSection.ts"
/*!**************************************!*\
  !*** ./src/sections/AreasSection.ts ***!
  \**************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   createAreasSection: () => (/* binding */ createAreasSection)
/* harmony export */ });
/* harmony import */ var _Registry__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../Registry */ "./src/Registry.ts");
/* harmony import */ var _utils_localize__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../utils/localize */ "./src/utils/localize.ts");
// ====================================================================
// Areas Section Builder
// ====================================================================
// Ported from dist/utils/simon42-section-builder.js (createAreasSection)
// with full TypeScript types.
// Creates area cards grouped by floor or as a single flat section.
// ====================================================================


// Area control domains to check (same as HA, with optional 'switch')
const CONTROL_DOMAINS = [
    'light',
    'fan',
    'switch',
    'cover-shutter',
    'cover-blind',
    'cover-curtain',
    'cover-shade',
    'cover-awning',
    'cover-garage',
    'cover-gate',
    'cover-door',
    'cover-window',
    'cover-damper',
];
/**
 * Pre-computes which area-controls actually have entities in this area.
 * This avoids the area card having to scan all entities at render time.
 * Same approach as HA's areas-overview-view-strategy.
 */
function getAreaControls(areaId, hass) {
    const areaEntities = _Registry__WEBPACK_IMPORTED_MODULE_0__.Registry.getVisibleEntitiesForArea(areaId);
    if (areaEntities.length === 0)
        return [];
    const found = new Set();
    for (const entity of areaEntities) {
        const state = hass.states[entity.entity_id];
        if (!state)
            continue;
        const domain = entity.entity_id.split('.')[0];
        const deviceClass = state.attributes?.device_class;
        if (domain === 'light')
            found.add('light');
        else if (domain === 'fan')
            found.add('fan');
        else if (domain === 'switch' && _Registry__WEBPACK_IMPORTED_MODULE_0__.Registry.config.show_switches_on_areas)
            found.add('switch');
        else if (domain === 'cover' && deviceClass) {
            const key = `cover-${deviceClass}`;
            if (CONTROL_DOMAINS.includes(key))
                found.add(key);
        }
    }
    return [...found];
}
// Alert-relevant binary sensor device classes.
// Excludes noisy classes like light, connectivity, battery, plug, power, running, problem.
const ALERT_DEVICE_CLASSES = new Set([
    'motion', 'occupancy', 'sound',
    'moisture',
    'smoke', 'gas', 'heat', 'cold', 'safety', 'tamper', 'vibration',
]);
/**
 * Pre-computes which binary sensor alert classes exist in this area.
 * Only returns device classes from the allowlist that have at least one
 * binary_sensor entity, so the area card doesn't scan all entities at render time.
 */
function getAreaAlertClasses(areaId, hass) {
    const areaEntities = _Registry__WEBPACK_IMPORTED_MODULE_0__.Registry.getVisibleEntitiesForArea(areaId);
    if (areaEntities.length === 0)
        return [];
    const found = new Set();
    for (const entity of areaEntities) {
        const domain = entity.entity_id.split('.')[0];
        if (domain !== 'binary_sensor')
            continue;
        const state = hass.states[entity.entity_id];
        const deviceClass = state?.attributes?.device_class;
        if (deviceClass && ALERT_DEVICE_CLASSES.has(deviceClass))
            found.add(deviceClass);
    }
    return [...found];
}
/**
 * Builds a single area card config for use in area sections.
 * Pre-filters controls and sensor_classes like HA does — the card
 * only gets what actually exists, avoiding expensive entity scanning at render.
 */
function buildAreaCard(area, hass) {
    const controls = getAreaControls(area.area_id, hass);
    // Only include sensor_classes that are configured on the area (like HA does)
    const sensorClasses = [];
    if (area.temperature_entity_id && hass.states[area.temperature_entity_id]) {
        sensorClasses.push('temperature');
    }
    if (area.humidity_entity_id && hass.states[area.humidity_entity_id]) {
        sensorClasses.push('humidity');
    }
    // Pre-filter alert classes if enabled
    const alertClasses = _Registry__WEBPACK_IMPORTED_MODULE_0__.Registry.config.show_alerts_on_areas
        ? getAreaAlertClasses(area.area_id, hass)
        : undefined;
    return {
        type: 'area',
        area: area.area_id,
        display_type: 'compact',
        sensor_classes: sensorClasses.length > 0 ? sensorClasses : undefined,
        alert_classes: alertClasses && alertClasses.length > 0 ? alertClasses : undefined,
        features: controls.length > 0 ? [{ type: 'area-controls', controls }] : [],
        features_position: 'inline',
        navigation_path: area.area_id,
        vertical: false,
        grid_options: { columns: 'full' },
    };
}
/**
 * Fallback floor icons based on HA's floor icons (mdi:home-floor-0 to mdi:home-floor-3, mdi:home-floor-negative-1).
 * HA doesn't provide a default icon for floors, but these are commonly used in custom floor plans.
 */
function getFloorIcon(level) {
    if (level == null)
        return 'mdi:floor-plan';
    if (level === -1)
        return 'mdi:home-floor-negative-1';
    if (level >= 0 && level <= 3)
        return `mdi:home-floor-${level}`;
    return 'mdi:floor-plan';
}
/**
 * Creates the areas section(s).
 *
 * - Without floor grouping: returns a single section with all areas.
 * - With floor grouping: returns an array of sections, one per floor,
 *   plus an optional "Weitere Bereiche" section for areas without a floor.
 */
function createAreasSection(visibleAreas, groupByFloors = false, hass = null) {
    // No floor grouping: flat list
    if (!groupByFloors || !hass) {
        return {
            type: 'grid',
            cards: [
                {
                    type: 'heading',
                    heading_style: 'title',
                    heading: (0,_utils_localize__WEBPACK_IMPORTED_MODULE_1__.localize)('sections.areas'),
                },
                ...visibleAreas.map((area) => buildAreaCard(area, hass)),
            ],
        };
    }
    // Group areas by floor
    const areasByFloor = new Map();
    const areasWithoutFloor = [];
    for (const area of visibleAreas) {
        if (area.floor_id) {
            if (!areasByFloor.has(area.floor_id)) {
                areasByFloor.set(area.floor_id, []);
            }
            areasByFloor.get(area.floor_id)?.push(area);
        }
        else {
            areasWithoutFloor.push(area);
        }
    }
    // Build sections per floor
    const sections = [];
    // Use HA's floor order from the registry. The hass.floors object preserves
    // the user-defined order from HA's "Reorder areas and floors" dialog via
    // Object.keys() insertion order — no separate sort_order field needed.
    const floorOrder = Object.keys(hass.floors);
    const sortedFloors = floorOrder.filter((id) => areasByFloor.has(id));
    for (const floorId of sortedFloors) {
        const areas = areasByFloor.get(floorId) ?? [];
        const floor = hass.floors[floorId];
        const floorName = floor?.name || floorId;
        const floorIcon = floor?.icon || getFloorIcon(floor?.level);
        sections.push({
            type: 'grid',
            cards: [
                {
                    type: 'heading',
                    heading_style: 'title',
                    heading: floorName,
                    icon: floorIcon,
                },
                ...areas.map((area) => buildAreaCard(area, hass)),
            ],
        });
    }
    // Areas without a floor
    if (areasWithoutFloor.length > 0) {
        sections.push({
            type: 'grid',
            cards: [
                {
                    type: 'heading',
                    heading_style: 'title',
                    heading: (0,_utils_localize__WEBPACK_IMPORTED_MODULE_1__.localize)('sections.areas_other'),
                    icon: 'mdi:home-outline',
                },
                ...areasWithoutFloor.map((area) => buildAreaCard(area, hass)),
            ],
        });
    }
    return sections;
}


/***/ },

/***/ "./src/sections/OverviewSection.ts"
/*!*****************************************!*\
  !*** ./src/sections/OverviewSection.ts ***!
  \*****************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   createCustomCardsSection: () => (/* binding */ createCustomCardsSection),
/* harmony export */   createOverviewSection: () => (/* binding */ createOverviewSection)
/* harmony export */ });
/* harmony import */ var _utils_localize__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../utils/localize */ "./src/utils/localize.ts");
/* harmony import */ var _utils_summary_grid__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../utils/summary-grid */ "./src/utils/summary-grid.ts");
// ====================================================================
// Overview Section Builder
// ====================================================================
// Ported from dist/utils/simon42-section-builder.js (createOverviewSection)
// with full TypeScript types.
// Creates the "Übersicht" section with clock, alarm, search, summaries,
// and favorites.
// ====================================================================


/**
 * Creates the overview section with summaries, clock, optional alarm,
 * optional search card, and favorites.
 */
function createOverviewSection(data) {
    const { showSearchCard, config, hass } = data;
    const showClockCard = config.show_clock_card !== false;
    // Check if alarm entity is configured
    const alarmEntity = config.alarm_entity;
    const cards = [];
    // Only show "Übersicht" heading if clock or alarm is visible
    if (showClockCard || alarmEntity) {
        cards.push({
            type: 'heading',
            heading: (0,_utils_localize__WEBPACK_IMPORTED_MODULE_0__.localize)('sections.overview'),
            heading_style: 'title',
            icon: 'mdi:overscan',
        });
    }
    if (showClockCard) {
        if (alarmEntity) {
            // Clock and alarm panel side-by-side
            cards.push({
                type: 'clock',
                clock_size: 'small',
                show_seconds: false,
            });
            cards.push({
                type: 'tile',
                entity: alarmEntity,
                vertical: false,
            });
        }
        else {
            // Clock only, full width
            cards.push({
                type: 'clock',
                clock_size: 'small',
                show_seconds: false,
                grid_options: {
                    columns: 'full',
                },
            });
        }
    }
    else if (alarmEntity) {
        // No clock, but alarm panel full width
        cards.push({
            type: 'tile',
            entity: alarmEntity,
            vertical: false,
            grid_options: {
                columns: 'full',
            },
        });
    }
    // Add search card if enabled
    if (showSearchCard) {
        cards.push({
            type: 'custom:search-card',
            grid_options: {
                columns: 'full',
            },
        });
    }
    // Summaries columns (default: 2)
    const summariesColumns = config.summaries_columns || 2;
    const showCoversSummary = config.show_covers_summary !== false;
    const showLightSummary = config.show_light_summary !== false;
    const showSecuritySummary = config.show_security_summary !== false;
    const showBatterySummary = config.show_battery_summary !== false;
    const showClimateSummary = config.show_climate_summary === true;
    // Build summary cards based on config
    const summaryCards = [];
    if (showLightSummary) {
        summaryCards.push({
            type: 'custom:simon42-summary-card',
            summary_type: 'lights',
            areas_options: config.areas_options || {},
        });
    }
    if (showCoversSummary) {
        summaryCards.push({
            type: 'custom:simon42-summary-card',
            summary_type: 'covers',
            areas_options: config.areas_options || {},
        });
    }
    if (showSecuritySummary) {
        summaryCards.push({
            type: 'custom:simon42-summary-card',
            summary_type: 'security',
            areas_options: config.areas_options || {},
        });
    }
    if (showBatterySummary) {
        summaryCards.push({
            type: 'custom:simon42-summary-card',
            summary_type: 'batteries',
            areas_options: config.areas_options || {},
            hide_mobile_app_batteries: config.hide_mobile_app_batteries,
            battery_critical_threshold: config.battery_critical_threshold,
        });
    }
    if (showClimateSummary) {
        summaryCards.push({
            type: 'custom:simon42-summary-card',
            summary_type: 'climate',
            areas_options: config.areas_options || {},
        });
    }
    // Only show summaries heading and cards if at least one is enabled
    if (summaryCards.length > 0) {
        cards.push({
            type: 'heading',
            heading: (0,_utils_localize__WEBPACK_IMPORTED_MODULE_0__.localize)('sections.summaries'),
        });
        const columnWidths = (0,_utils_summary_grid__WEBPACK_IMPORTED_MODULE_1__.getSummaryCardColumnWidths)(summaryCards.length, summariesColumns, config.stretch_wrapping_summaries === true);
        cards.push(...summaryCards.map((card, index) => ({
            ...card,
            grid_options: {
                columns: columnWidths[index],
            },
        })));
    }
    // Favorites section
    const favoriteEntities = (config.favorite_entities || []).filter((entityId) => hass.states[entityId] !== undefined);
    if (favoriteEntities.length > 0) {
        cards.push({
            type: 'heading',
            heading: (0,_utils_localize__WEBPACK_IMPORTED_MODULE_0__.localize)('sections.favorites'),
        });
        const showState = config.favorites_show_state === true;
        const hideLastChanged = config.favorites_hide_last_changed === true;
        const stateContent = [];
        if (showState)
            stateContent.push('state');
        if (!hideLastChanged)
            stateContent.push('last_changed');
        for (const entityId of favoriteEntities) {
            cards.push({
                type: 'tile',
                entity: entityId,
                show_entity_picture: true,
                vertical: false,
                ...(stateContent.length > 0 ? { state_content: stateContent } : {}),
            });
        }
    }
    // If nothing is visible, skip the entire section
    if (cards.length === 0) {
        return null;
    }
    return {
        type: 'grid',
        cards,
    };
}
/**
 * Creates a section for user-defined custom cards (from YAML config).
 * Returns null if no valid custom cards are configured.
 */
function createCustomCardsSection(customCards, heading, icon) {
    const validCards = customCards.filter((c) => c.parsed_config);
    if (validCards.length === 0)
        return null;
    const cards = [
        { type: 'heading', heading: heading || (0,_utils_localize__WEBPACK_IMPORTED_MODULE_0__.localize)('sections.custom_cards'), icon: icon || 'mdi:cards' },
    ];
    for (const card of validCards) {
        if (Array.isArray(card.parsed_config)) {
            cards.push(...card.parsed_config);
        }
        else {
            if (card.title) {
                cards.push({ type: 'heading', heading: card.title });
            }
            cards.push(card.parsed_config);
        }
    }
    return { type: 'grid', cards };
}


/***/ },

/***/ "./src/sections/WeatherEnergySection.ts"
/*!**********************************************!*\
  !*** ./src/sections/WeatherEnergySection.ts ***!
  \**********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   createEnergySection: () => (/* binding */ createEnergySection),
/* harmony export */   createWeatherSection: () => (/* binding */ createWeatherSection)
/* harmony export */ });
/* harmony import */ var _utils_localize__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../utils/localize */ "./src/utils/localize.ts");
// ====================================================================
// Weather & Energy Section Builders
// ====================================================================
// Independent section builders for weather forecast and energy
// distribution. Each returns a single section or null.
// ====================================================================

/**
 * Creates the weather forecast section.
 * Returns null if weather is disabled or no entity available.
 */
function createWeatherSection(weatherEntity, showWeather) {
    if (!weatherEntity || !showWeather)
        return null;
    return {
        type: 'grid',
        cards: [
            {
                type: 'heading',
                heading: (0,_utils_localize__WEBPACK_IMPORTED_MODULE_0__.localize)('sections.weather'),
                heading_style: 'title',
                icon: 'mdi:weather-partly-cloudy',
            },
            {
                type: 'weather-forecast',
                entity: weatherEntity,
                forecast_type: 'daily',
            },
        ],
    };
}
/**
 * Creates the energy distribution section.
 * Returns null if energy is disabled.
 */
function createEnergySection(showEnergy, linkDashboard = true) {
    if (!showEnergy)
        return null;
    return {
        type: 'grid',
        cards: [
            {
                type: 'heading',
                heading: (0,_utils_localize__WEBPACK_IMPORTED_MODULE_0__.localize)('sections.energy'),
                heading_style: 'title',
                icon: 'mdi:lightning-bolt',
            },
            {
                type: 'energy-distribution',
                link_dashboard: linkDashboard,
            },
        ],
    };
}


/***/ },

/***/ "./src/styles/global-styles.ts"
/*!*************************************!*\
  !*** ./src/styles/global-styles.ts ***!
  \*************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   SIMON42_STRATEGY_GLOBAL_STYLE_ID: () => (/* binding */ SIMON42_STRATEGY_GLOBAL_STYLE_ID),
/* harmony export */   ensureSimon42StrategyGlobalStyles: () => (/* binding */ ensureSimon42StrategyGlobalStyles),
/* harmony export */   ensureSimon42StrategyGlobalStylesForElement: () => (/* binding */ ensureSimon42StrategyGlobalStylesForElement)
/* harmony export */ });
// ====================================================================
// Simon42 Dashboard Strategy — Global Styles
// ====================================================================
// Rules for elements outside component shadow roots (e.g. hui-card).
// Lovelace grid cards live inside hui-grid-section's shadow root, so styles
// must be injected there — document.head alone does not apply.
// ====================================================================
const SIMON42_STRATEGY_GLOBAL_STYLE_ID = 'simon42-dashboard-strategy-global-styles';
const GLOBAL_STYLES = `
  hui-card:has(> simon42-summary-card) {
    display: block;
    height: 100%;
  }

  simon42-summary-card {
    display: block;
    height: 100%;
  }
`;
const injectedRoots = new WeakSet();
function injectStyles(root) {
    if (injectedRoots.has(root)) {
        return;
    }
    const existing = root instanceof Document
        ? root.getElementById(SIMON42_STRATEGY_GLOBAL_STYLE_ID)
        : root.getElementById(SIMON42_STRATEGY_GLOBAL_STYLE_ID);
    if (existing) {
        injectedRoots.add(root);
        return;
    }
    const style = document.createElement('style');
    style.id = SIMON42_STRATEGY_GLOBAL_STYLE_ID;
    style.textContent = GLOBAL_STYLES;
    if (root instanceof Document) {
        root.head.appendChild(style);
    }
    else {
        root.appendChild(style);
    }
    injectedRoots.add(root);
}
/** Injects strategy-wide styles into document and, when possible, HA shadow roots. */
function ensureSimon42StrategyGlobalStyles() {
    injectStyles(document);
    const homeAssistant = document.querySelector('home-assistant');
    if (homeAssistant?.shadowRoot) {
        injectStylesIntoTree(homeAssistant.shadowRoot);
    }
}
/**
 * Injects styles into the shadow root that contains the given element.
 * Call from custom elements on connect so grid-section styles apply.
 */
function ensureSimon42StrategyGlobalStylesForElement(element) {
    const root = element.getRootNode();
    if (root instanceof ShadowRoot) {
        injectStyles(root);
        return;
    }
    if (root instanceof Document) {
        injectStyles(root);
    }
}
function injectStylesIntoTree(root) {
    if (root instanceof ShadowRoot) {
        injectStyles(root);
    }
    const elements = root instanceof Document
        ? Array.from(root.querySelectorAll('*'))
        : root instanceof Element
            ? [root, ...Array.from(root.querySelectorAll('*'))]
            : Array.from(root.querySelectorAll('*'));
    for (const element of elements) {
        if (element.shadowRoot) {
            injectStylesIntoTree(element.shadowRoot);
        }
    }
}


/***/ },

/***/ "./src/types/strategy.ts"
/*!*******************************!*\
  !*** ./src/types/strategy.ts ***!
  \*******************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   DEFAULT_SECTIONS_ORDER: () => (/* binding */ DEFAULT_SECTIONS_ORDER)
/* harmony export */ });
// ====================================================================
// Simon42 Dashboard Strategy Types
// ====================================================================
// All configuration and data types specific to the simon42 strategy.
// These types cover the YAML config schema and internal data structures
// used throughout the strategy codebase.
// ====================================================================
const DEFAULT_SECTIONS_ORDER = [
    'overview',
    'custom_cards',
    'areas',
    'weather',
    'energy',
];


/***/ },

/***/ "./src/utils/badge-builder.ts"
/*!************************************!*\
  !*** ./src/utils/badge-builder.ts ***!
  \************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   createPersonBadges: () => (/* binding */ createPersonBadges)
/* harmony export */ });
// ====================================================================
// Badge Builder - Person Badges
// ====================================================================
// Ported from dist/utils/simon42-badge-builder.js with full TypeScript types.
// Creates entity badges for person presence (home / away).
// ====================================================================
/**
 * Creates Lovelace entity badges for a list of persons.
 *
 * - Home → green badge (default entity color)
 * - Away → accent/orange badge
 * - Hidden entities (registry hidden === true) are excluded
 * - Name is trimmed to first name only
 */
function createPersonBadges(persons, hass) {
    const badges = [];
    for (const person of persons) {
        const state = hass.states[person.entity_id];
        if (!state)
            continue;
        // Registry check: skip if entity is hidden
        const registryEntry = hass.entities[person.entity_id];
        if (registryEntry?.hidden === true)
            continue;
        const firstName = person.name.split(' ')[0];
        badges.push({
            type: 'entity',
            entity: person.entity_id,
            name: firstName,
            show_entity_picture: true,
            show_state: true,
            state_content: 'state',
            show_name: true,
            show_icon: true,
            tap_action: { action: 'more-info' },
        });
    }
    return badges;
}


/***/ },

/***/ "./src/utils/badge-utils.ts"
/*!**********************************!*\
  !*** ./src/utils/badge-utils.ts ***!
  \**********************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   BADGE_COLOR_MAP: () => (/* binding */ BADGE_COLOR_MAP),
/* harmony export */   getColorForEntity: () => (/* binding */ getColorForEntity),
/* harmony export */   isBadgeCandidate: () => (/* binding */ isBadgeCandidate),
/* harmony export */   isDefaultShowName: () => (/* binding */ isDefaultShowName),
/* harmony export */   resolveShowName: () => (/* binding */ resolveShowName)
/* harmony export */ });
// ====================================================================
// BADGE UTILITIES — Shared badge detection, color, and display logic
// ====================================================================
// Single source of truth for badge-related decisions used by both
// RoomViewStrategy (runtime) and the Editor (configuration UI).
// -- Badge color map (device_class → HA color name) -------------------
const BADGE_COLOR_MAP = {
    temperature: 'red',
    humidity: 'indigo',
    pm25: 'orange',
    pm10: 'orange',
    carbon_dioxide: 'green',
    volatile_organic_compounds: 'purple',
    illuminance: 'amber',
    battery: 'red',
    motion: 'yellow',
    occupancy: 'cyan',
    presence: 'cyan',
    moisture: 'blue',
    window: 'teal',
    door: 'teal',
    smoke: 'red',
    gas: 'red',
    wind_speed: 'blue',
    pressure: 'deep-purple',
    power: 'orange',
    energy: 'orange',
};
// -- Badge color for a specific entity --------------------------------
/** Get badge color for an entity based on its device_class, with unit fallbacks */
function getColorForEntity(entityId, hass) {
    const state = hass.states[entityId];
    if (!state)
        return 'grey';
    const dc = state.attributes?.device_class;
    if (dc && BADGE_COLOR_MAP[dc])
        return BADGE_COLOR_MAP[dc];
    const unit = state.attributes?.unit_of_measurement;
    if (unit === 'lx')
        return 'amber';
    if (unit === 'g/m³')
        return 'blue';
    return 'grey';
}
// -- Badge candidate detection ----------------------------------------
/**
 * Check if a sensor/binary_sensor entity qualifies as a badge candidate.
 * Temperature and humidity are excluded (handled by HA area config).
 * Battery detection returns true but threshold check remains with the caller.
 */
function isBadgeCandidate(domain, deviceClass, unit, entityId) {
    if (domain === 'sensor') {
        // Battery (caller must check threshold)
        if (deviceClass === 'battery' || entityId.includes('battery'))
            return true;
        // Skip temperature/humidity (handled by HA area config, not auto-detected)
        if (deviceClass === 'temperature' || unit === '°C' || unit === '°F')
            return false;
        if (deviceClass === 'humidity' || unit === '%')
            return false;
        // Air quality
        if (deviceClass === 'pm25' || entityId.includes('pm_2_5') || entityId.includes('pm25'))
            return true;
        if (deviceClass === 'pm10' || entityId.includes('pm_10') || entityId.includes('pm10'))
            return true;
        if (deviceClass === 'carbon_dioxide' || entityId.includes('co2'))
            return true;
        if (deviceClass === 'volatile_organic_compounds' || entityId.includes('voc'))
            return true;
        // Light / humidity
        if (deviceClass === 'illuminance' || unit === 'lx')
            return true;
        if (unit === 'g/m³')
            return true; // absolute humidity
        return false;
    }
    if (domain === 'binary_sensor') {
        return (deviceClass === 'motion' ||
            deviceClass === 'occupancy' ||
            deviceClass === 'presence' ||
            deviceClass === 'window' ||
            deviceClass === 'door' ||
            deviceClass === 'smoke' ||
            deviceClass === 'gas');
    }
    return false;
}
// -- Default show_name ------------------------------------------------
/** Whether a badge with this device_class shows its entity name by default */
function isDefaultShowName(deviceClass) {
    return deviceClass === 'window' || deviceClass === 'door';
}
// -- Show name resolution ---------------------------------------------
/** Resolve whether a badge should show its entity name (config overrides > defaults) */
function resolveShowName(entityId, defaultShowName, namesVisible, namesHidden) {
    if (namesHidden?.has(entityId))
        return false;
    if (namesVisible?.has(entityId))
        return true;
    return defaultShowName;
}


/***/ },

/***/ "./src/utils/debug.ts"
/*!****************************!*\
  !*** ./src/utils/debug.ts ***!
  \****************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   debugLog: () => (/* binding */ debugLog),
/* harmony export */   isDebugActive: () => (/* binding */ isDebugActive),
/* harmony export */   timeEnd: () => (/* binding */ timeEnd),
/* harmony export */   timeStart: () => (/* binding */ timeStart),
/* harmony export */   trackHassUpdate: () => (/* binding */ trackHassUpdate)
/* harmony export */ });
// ====================================================================
// PERFORMANCE DEBUG — Activated via ?s42_debug=true query parameter
// ====================================================================
// Logs timing data to browser console. Playwright reads console messages
// to analyze performance without modifying production behavior.
// ====================================================================
const DEBUG_PARAM = 's42_debug';
/** Check if debug mode is active (cached after first check) */
let _debugActive = null;
function isDebugActive() {
    if (_debugActive !== null)
        return _debugActive;
    try {
        _debugActive = new URLSearchParams(window.location.search).has(DEBUG_PARAM);
    }
    catch {
        _debugActive = false;
    }
    return _debugActive;
}
/** Start a named performance timer */
function timeStart(label) {
    if (!isDebugActive())
        return;
    performance.mark(`s42-start-${label}`);
}
/** End a named timer and log the duration */
function timeEnd(label) {
    if (!isDebugActive())
        return;
    const startMark = `s42-start-${label}`;
    const endMark = `s42-end-${label}`;
    performance.mark(endMark);
    try {
        const measure = performance.measure(`s42-${label}`, startMark, endMark);
        console.log(`[s42-perf] ${label}: ${measure.duration.toFixed(2)}ms`);
    }
    catch {
        // Start mark missing — timer was never started
    }
}
/** Log a debug message (only when debug active) */
function debugLog(message, ...args) {
    if (!isDebugActive())
        return;
    console.log(`[s42-debug] ${message}`, ...args);
}
/** Track how often set hass() is called on a component */
const _hassCallCounts = new Map();
let _hassLogInterval = null;
function trackHassUpdate(componentName) {
    if (!isDebugActive())
        return;
    _hassCallCounts.set(componentName, (_hassCallCounts.get(componentName) || 0) + 1);
    // Log aggregated counts every 5 seconds
    if (!_hassLogInterval) {
        _hassLogInterval = setInterval(() => {
            if (_hassCallCounts.size === 0)
                return;
            const entries = Array.from(_hassCallCounts.entries())
                .map(([name, count]) => `${name}=${count}`)
                .join(', ');
            console.log(`[s42-perf] hass-updates/5s: ${entries}`);
            _hassCallCounts.clear();
        }, 5000);
    }
}
/** Dump all s42 performance measures to console as sorted table */
function dumpAllMeasures() {
    const entries = performance
        .getEntriesByType('measure')
        .filter((e) => e.name.startsWith('s42-'))
        .sort((a, b) => a.startTime - b.startTime);
    if (entries.length === 0) {
        console.log('[s42-perf] No measures recorded. Load page with ?s42_debug=true');
        return;
    }
    console.table(entries.map((e) => ({
        name: e.name.replace('s42-', ''),
        start: `${e.startTime.toFixed(1)}ms`,
        duration: `${e.duration.toFixed(2)}ms`,
    })));
    const total = entries.reduce((sum, e) => sum + e.duration, 0);
    console.log(`[s42-perf] Total measured: ${total.toFixed(2)}ms across ${entries.length} measures`);
}
// Expose globally for console access
if (typeof window !== 'undefined') {
    window.__s42_dump = dumpAllMeasures;
}


/***/ },

/***/ "./src/utils/entity-filter.ts"
/*!************************************!*\
  !*** ./src/utils/entity-filter.ts ***!
  \************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   SECURITY_EXCLUDED_PLATFORMS: () => (/* binding */ SECURITY_EXCLUDED_PLATFORMS),
/* harmony export */   collectPersons: () => (/* binding */ collectPersons),
/* harmony export */   findDummySensor: () => (/* binding */ findDummySensor),
/* harmony export */   findWeatherEntity: () => (/* binding */ findWeatherEntity),
/* harmony export */   getBatteryEntities: () => (/* binding */ getBatteryEntities)
/* harmony export */ });
/* harmony import */ var _Registry__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../Registry */ "./src/Registry.ts");
// ====================================================================
// ENTITY FILTER — Central entity filtering utilities
// ====================================================================
// Uses Registry for pre-computed exclusion sets and Maps.
// Replaces the scattered filtering logic from data-collectors.js.
// ====================================================================

/**
 * Collects person entities with home/away state.
 * Uses pre-filtered Registry method — no manual exclusion checks needed.
 */
function collectPersons(hass, _config) {
    const personIds = _Registry__WEBPACK_IMPORTED_MODULE_0__.Registry.getVisibleEntityIdsForDomain('person');
    return personIds
        .filter((id) => !!hass.states[id])
        .map((id) => {
        const state = hass.states[id];
        return {
            entity_id: id,
            name: state.attributes?.friendly_name || id.split('.')[1],
            state: state.state,
            isHome: state.state === 'home',
        };
    });
}
/**
 * Finds the first available weather entity.
 * Uses pre-filtered Registry method — no manual exclusion checks needed.
 */
function findWeatherEntity(hass) {
    const weatherIds = _Registry__WEBPACK_IMPORTED_MODULE_0__.Registry.getVisibleEntityIdsForDomain('weather');
    return weatherIds.find((id) => !!hass.states[id]);
}
/**
 * Finds a dummy sensor entity for tile card color rendering.
 * Uses pre-filtered Registry method — no manual exclusion checks needed.
 * Cached per call — should only be called once per generate().
 */
function findDummySensor(hass) {
    const sensorIds = _Registry__WEBPACK_IMPORTED_MODULE_0__.Registry.getVisibleEntityIdsForDomain('sensor');
    for (const id of sensorIds) {
        const state = hass.states[id];
        if (!state)
            continue;
        if (state.state === 'unavailable' || state.state === 'unknown')
            continue;
        return id;
    }
    // Fallback: try any visible light
    const lightIds = _Registry__WEBPACK_IMPORTED_MODULE_0__.Registry.getVisibleEntityIdsForDomain('light');
    for (const id of lightIds) {
        const state = hass.states[id];
        if (state)
            return id;
    }
    return 'sun.sun';
}
/**
 * Platforms that create binary_sensor entities with security-like device_classes
 * (opening, door, window) but are NOT actual physical security sensors.
 * Excluded from SecurityView and security SummaryCard count.
 */
const SECURITY_EXCLUDED_PLATFORMS = new Set(['tankerkoenig']);
function getBatteryEntities(hass, config) {
    const sensorIds = _Registry__WEBPACK_IMPORTED_MODULE_0__.Registry.getEntityIdsForDomain('sensor');
    const binarySensorIds = _Registry__WEBPACK_IMPORTED_MODULE_0__.Registry.getEntityIdsForDomain('binary_sensor');
    // Filter battery entities — exclude hidden/no_dboard but keep diagnostic
    const batteryEntities = [...sensorIds, ...binarySensorIds].filter((entityId) => {
        const state = hass.states[entityId];
        if (!state)
            return false;
        // Exclude hidden and no_dboard entities (but NOT diagnostic — batteries are often diagnostic)
        if (_Registry__WEBPACK_IMPORTED_MODULE_0__.Registry.isExcludedByLabel(entityId))
            return false;
        if (_Registry__WEBPACK_IMPORTED_MODULE_0__.Registry.isHiddenByConfig(entityId))
            return false;
        const entry = _Registry__WEBPACK_IMPORTED_MODULE_0__.Registry.getEntity(entityId);
        if (entry?.hidden)
            return false;
        // Platform-specific filter: hide mobile_app batteries if configured
        if (config.hide_mobile_app_batteries) {
            if (entry?.platform === 'mobile_app')
                return false;
        }
        if (entityId.startsWith('binary_sensor.') && entityId.includes('battery'))
            return true;
        if (state.attributes?.device_class === 'battery' && state.attributes?.unit_of_measurement === '%')
            return true;
        return false;
    });
    // Deduplication: remove binary_sensor if %-sensor exists on same device
    const sensorDeviceIds = new Set();
    for (const id of batteryEntities) {
        if (id.startsWith('sensor.')) {
            const deviceId = hass.entities[id]?.device_id;
            if (deviceId)
                sensorDeviceIds.add(deviceId);
        }
    }
    return batteryEntities.filter((id) => {
        if (!id.startsWith('binary_sensor.'))
            return true;
        const deviceId = hass.entities[id]?.device_id;
        return !deviceId || !sensorDeviceIds.has(deviceId);
    });
}


/***/ },

/***/ "./src/utils/localize.ts"
/*!*******************************!*\
  !*** ./src/utils/localize.ts ***!
  \*******************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

var _translations_de_json__WEBPACK_IMPORTED_MODULE_0___namespace_cache;
var _translations_en_json__WEBPACK_IMPORTED_MODULE_1___namespace_cache;
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   localize: () => (/* binding */ localize),
/* harmony export */   setupLocalize: () => (/* binding */ setupLocalize)
/* harmony export */ });
/* harmony import */ var _translations_de_json__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../translations/de.json */ "./src/translations/de.json");
/* harmony import */ var _translations_en_json__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../translations/en.json */ "./src/translations/en.json");
// ====================================================================
// Localization Utility (i18n)
// ====================================================================
// Singleton localization function. Reads hass.locale.language once at
// setup time. Falls back to English for missing keys/languages.
// Pattern adapted from mushroom-strategy.
// ====================================================================


const languages = { de: /*#__PURE__*/ (_translations_de_json__WEBPACK_IMPORTED_MODULE_0___namespace_cache || (_translations_de_json__WEBPACK_IMPORTED_MODULE_0___namespace_cache = __webpack_require__.t(_translations_de_json__WEBPACK_IMPORTED_MODULE_0__, 2))), en: /*#__PURE__*/ (_translations_en_json__WEBPACK_IMPORTED_MODULE_1___namespace_cache || (_translations_en_json__WEBPACK_IMPORTED_MODULE_1___namespace_cache = __webpack_require__.t(_translations_en_json__WEBPACK_IMPORTED_MODULE_1__, 2))) };
const DEFAULT_LANG = 'en';
function getTranslatedString(key, lang) {
    try {
        return key.split('.').reduce((o, i) => o[i], languages[lang]);
    }
    catch {
        return undefined;
    }
}
let _localize;
/**
 * Initialize localization from the hass object.
 * Must be called once before localize() is used (typically in Registry.initialize).
 */
function setupLocalize(hass) {
    const lang = hass?.locale.language ?? hass?.language ?? DEFAULT_LANG;
    _localize = (key) => getTranslatedString(key, lang) ?? getTranslatedString(key, DEFAULT_LANG) ?? key;
}
/**
 * Translate a key using dot notation (e.g. 'views.lights').
 * Returns the key itself if no translation is found.
 */
function localize(key) {
    if (!_localize)
        return key;
    return _localize(key);
}


/***/ },

/***/ "./src/utils/name-utils.ts"
/*!*********************************!*\
  !*** ./src/utils/name-utils.ts ***!
  \*********************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getVisibleAreas: () => (/* binding */ getVisibleAreas),
/* harmony export */   getVisibleAreasFromHass: () => (/* binding */ getVisibleAreasFromHass),
/* harmony export */   isEntityHiddenOrDisabled: () => (/* binding */ isEntityHiddenOrDisabled),
/* harmony export */   sortByLastChanged: () => (/* binding */ sortByLastChanged),
/* harmony export */   stripAreaName: () => (/* binding */ stripAreaName),
/* harmony export */   stripCoverType: () => (/* binding */ stripCoverType)
/* harmony export */ });
/* harmony import */ var _Registry__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../Registry */ "./src/Registry.ts");
// ====================================================================
// Name & Entity Utility Functions
// ====================================================================
// Ported from dist/utils/simon42-helpers.js with full TypeScript types,
// module-level RegExp caches, and regex-escaping for area names.
// ====================================================================

const _areaRegExpCache = new Map();
const _coverTypeRegExps = [
    'Rollo',
    'Rollos',
    'Rolladen',
    'Rolläden',
    'Vorhang',
    'Vorhänge',
    'Jalousie',
    'Jalousien',
    'Shutter',
    'Shutters',
    'Blind',
    'Blinds',
].map((type) => new RegExp(`\\b${type}\\b`, 'gi'));
// -- Helper: escape special regex characters --------------------------
function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
// -- Helper: extract friendly name or fallback from entity ID ---------
function getFriendlyName(entityId, hass) {
    const state = hass.states[entityId];
    if (!state)
        return null;
    return state.attributes?.friendly_name ?? entityId.split('.')[1].replace(/_/g, ' ');
}
// -- Exported functions -----------------------------------------------
/**
 * Strips the area name from an entity's friendly name.
 * Uses cached, regex-escaped patterns per area name to avoid recompilation
 * and prevent bugs with special characters in area names.
 */
function stripAreaName(entityId, area, hass) {
    const state = hass.states[entityId];
    if (!state)
        return entityId;
    const name = getFriendlyName(entityId, hass);
    if (!name)
        return entityId;
    const areaName = area.name;
    if (!areaName)
        return name;
    // Build and cache RegExps for this area name (compiled once, reused)
    if (!_areaRegExpCache.has(areaName)) {
        const escaped = escapeRegExp(areaName);
        _areaRegExpCache.set(areaName, {
            start: new RegExp(`^${escaped}\\s+`, 'i'),
            end: new RegExp(`\\s+${escaped}$`, 'i'),
            middle: new RegExp(`\\s+${escaped}\\s+`, 'i'),
        });
    }
    const re = _areaRegExpCache.get(areaName);
    if (!re)
        return name;
    const cleanName = name.replace(re.start, '').replace(re.end, '').replace(re.middle, ' ').trim();
    // Only use cleaned name if something meaningful remains
    if (cleanName.length > 0 && cleanName.toLowerCase() !== areaName.toLowerCase()) {
        return cleanName;
    }
    return name;
}
/**
 * Strips cover type terms (Rollo, Jalousie, Shutter, etc.) from an entity's
 * friendly name. Uses pre-compiled RegExps for performance.
 */
function stripCoverType(entityId, hass) {
    const state = hass.states[entityId];
    if (!state)
        return entityId;
    let name = getFriendlyName(entityId, hass);
    if (!name)
        return entityId;
    // Remove cover type terms using pre-compiled patterns
    for (const regex of _coverTypeRegExps) {
        regex.lastIndex = 0;
        name = name.replace(regex, '').trim();
    }
    // Collapse multiple whitespace
    name = name.replace(/\s+/g, ' ').trim();
    // Only use cleaned name if something meaningful remains
    if (name.length > 0) {
        return name;
    }
    // Fallback to original friendly name
    return state.attributes?.friendly_name ?? entityId.split('.')[1].replace(/_/g, ' ');
}
/**
 * Filters areas based on display configuration (hidden list) and sorts them
 * by the configured order or alphabetically as fallback.
 */
function getVisibleAreas(areas, displayConfig, useDefaultSort) {
    const hiddenAreas = displayConfig?.hidden ?? [];
    // Filter out hidden areas
    const visibleAreas = areas.filter((area) => !hiddenAreas.includes(area.area_id));
    // If useDefaultSort is true, use HA's native area order (as-is from registry)
    if (useDefaultSort) {
        return visibleAreas;
    }
    const orderConfig = displayConfig?.order ?? [];
    // Sort by configured order, then alphabetically for unordered
    if (orderConfig.length > 0) {
        visibleAreas.sort((a, b) => {
            const indexA = orderConfig.indexOf(a.area_id);
            const indexB = orderConfig.indexOf(b.area_id);
            if (indexA !== -1 && indexB !== -1)
                return indexA - indexB;
            if (indexA !== -1)
                return -1;
            if (indexB !== -1)
                return 1;
            return a.name.localeCompare(b.name);
        });
    }
    else {
        visibleAreas.sort((a, b) => a.name.localeCompare(b.name));
    }
    return visibleAreas;
}
/**
 * Like getVisibleAreas but reads from hass.areas (synchronous Record)
 * instead of Registry.areas (requires WebSocket init).
 * Used by the dashboard entry point to avoid blocking on Registry.
 */
function getVisibleAreasFromHass(hass, displayConfig, useDefaultSort) {
    return getVisibleAreas(Object.values(hass.areas), displayConfig, useDefaultSort);
}
/**
 * Checks whether an entity should be excluded from the dashboard based on
 * its registry flags: hidden, entity_category, labels, and config.
 *
 * Delegates to Registry.isEntityExcludedWithStateCategory() which covers
 * all exclusion criteria including state attribute fallback.
 */
function isEntityHiddenOrDisabled(entity, _hass) {
    return _Registry__WEBPACK_IMPORTED_MODULE_0__.Registry.isEntityExcludedWithStateCategory(entity.entity_id);
}
/**
 * Comparator that sorts entity IDs by last_changed timestamp,
 * most recently changed first.
 */
function sortByLastChanged(a, b, hass) {
    const stateA = hass.states[a];
    const stateB = hass.states[b];
    if (!stateA || !stateB)
        return 0;
    const dateA = new Date(stateA.last_changed).getTime();
    const dateB = new Date(stateB.last_changed).getTime();
    return dateB - dateA; // Newest first
}


/***/ },

/***/ "./src/utils/summary-grid.ts"
/*!***********************************!*\
  !*** ./src/utils/summary-grid.ts ***!
  \***********************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getSummaryCardColumnWidths: () => (/* binding */ getSummaryCardColumnWidths)
/* harmony export */ });
const GRID_COLUMNS = 12;
/**
 * Returns per-card grid column widths for summary cards on the overview.
 * When stretchWrappingSummaries is enabled, cards on the last incomplete row
 * share the full grid width evenly instead of keeping the configured column width.
 */
function getSummaryCardColumnWidths(cardCount, summariesColumns, stretchWrappingSummaries) {
    if (cardCount === 0) {
        return [];
    }
    const defaultColumnWidth = GRID_COLUMNS / summariesColumns;
    if (!stretchWrappingSummaries) {
        return Array.from({ length: cardCount }, () => defaultColumnWidth);
    }
    const remainder = cardCount % summariesColumns;
    if (remainder === 0) {
        return Array.from({ length: cardCount }, () => defaultColumnWidth);
    }
    const stretchedColumnWidth = GRID_COLUMNS / remainder;
    const fullRowCardCount = cardCount - remainder;
    return Array.from({ length: cardCount }, (_, index) => index < fullRowCardCount ? defaultColumnWidth : stretchedColumnWidth);
}


/***/ },

/***/ "./src/utils/view-builder.ts"
/*!***********************************!*\
  !*** ./src/utils/view-builder.ts ***!
  \***********************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   createOverviewView: () => (/* binding */ createOverviewView)
/* harmony export */ });
/* harmony import */ var _localize__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./localize */ "./src/utils/localize.ts");
// ====================================================================
// View Builder - Creates View Definitions
// ====================================================================

/**
 * Creates the main overview view.
 *
 * - Badges and header are only included when personBadges has entries.
 * - Type "sections" with max 3 columns.
 */
function createOverviewView(sections, personBadges) {
    return {
        title: (0,_localize__WEBPACK_IMPORTED_MODULE_0__.localize)('views.overview'),
        path: 'home',
        icon: 'mdi:home',
        type: 'sections',
        max_columns: 3,
        badges: personBadges.length > 0 ? personBadges : undefined,
        header: personBadges.length > 0
            ? {
                layout: 'center',
                badges_position: 'bottom',
                badges_wrap: 'wrap',
            }
            : undefined,
        sections,
    };
}


/***/ },

/***/ "./src/views/BatteriesViewStrategy.ts"
/*!********************************************!*\
  !*** ./src/views/BatteriesViewStrategy.ts ***!
  \********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _Registry__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../Registry */ "./src/Registry.ts");
/* harmony import */ var _utils_localize__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../utils/localize */ "./src/utils/localize.ts");
/* harmony import */ var _utils_entity_filter__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../utils/entity-filter */ "./src/utils/entity-filter.ts");
// ====================================================================
// VIEW STRATEGY — BATTERIES (Battery Status Overview)
// ====================================================================



function createBatterySection(entities, status, rangeText) {
    if (entities.length === 0)
        return null;
    const emoji = status === 'critical' ? '🔴' : status === 'low' ? '🟡' : '🟢';
    const color = status === 'critical' ? 'red' : status === 'low' ? 'yellow' : 'green';
    return {
        type: 'grid',
        cards: [
            {
                type: 'heading',
                heading: `${emoji} ${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_1__.localize)('batteries.' + status)} (${rangeText}) - ${entities.length} ${(0,_utils_localize__WEBPACK_IMPORTED_MODULE_1__.localize)(entities.length === 1 ? 'batteries.battery_one' : 'batteries.battery_many')}`,
                heading_style: 'title',
            },
            ...entities.map((e) => ({
                type: 'tile',
                entity: e,
                vertical: false,
                state_content: ['state', 'last_changed'],
                color,
            })),
        ],
    };
}
class Simon42ViewBatteriesStrategy extends HTMLElement {
    static async generate(config, hass) {
        // Ensure Registry is initialized (idempotent — no-op if already done)
        _Registry__WEBPACK_IMPORTED_MODULE_0__.Registry.initialize(hass, config.config || {});
        const batteryEntities = (0,_utils_entity_filter__WEBPACK_IMPORTED_MODULE_2__.getBatteryEntities)(hass, config.config);
        // Group by status
        const strategyConfig = config.config || {};
        const criticalThreshold = strategyConfig.battery_critical_threshold ?? 20;
        const lowThreshold = strategyConfig.battery_low_threshold ?? 50;
        const critical = [];
        const low = [];
        const good = [];
        for (const entityId of batteryEntities) {
            const state = hass.states[entityId];
            if (entityId.startsWith('binary_sensor.')) {
                (state.state === 'on' ? critical : good).push(entityId);
                continue;
            }
            const value = parseFloat(state.state);
            const unit = state.attributes?.unit_of_measurement;
            // Only apply percentage thresholds to %-based sensors.
            // Voltage sensors (V, mV) have device-specific ranges and cannot be
            // meaningfully compared against percentage thresholds (e.g. 3V would
            // be "critical" at < 20 which is wrong). Skip them entirely.
            if (unit && unit !== '%')
                continue;
            if (isNaN(value))
                critical.push(entityId);
            else if (value < criticalThreshold)
                critical.push(entityId);
            else if (value <= lowThreshold)
                low.push(entityId);
            else
                good.push(entityId);
        }
        // Sort each group by battery level (lowest first)
        const sortByLevel = (a, b) => {
            const valA = parseFloat(hass.states[a]?.state);
            const valB = parseFloat(hass.states[b]?.state);
            if (isNaN(valA))
                return -1;
            if (isNaN(valB))
                return 1;
            return valA - valB;
        };
        critical.sort(sortByLevel);
        low.sort(sortByLevel);
        good.sort(sortByLevel);
        const sections = [];
        const criticalSection = createBatterySection(critical, 'critical', `< ${criticalThreshold}%`);
        if (criticalSection)
            sections.push(criticalSection);
        const lowSection = createBatterySection(low, 'low', `${criticalThreshold}% - ${lowThreshold}%`);
        if (lowSection)
            sections.push(lowSection);
        const goodSection = createBatterySection(good, 'good', `> ${lowThreshold}%`);
        if (goodSection)
            sections.push(goodSection);
        return { type: 'sections', sections };
    }
}
customElements.define('ll-strategy-simon42-view-batteries', Simon42ViewBatteriesStrategy);


/***/ },

/***/ "./src/views/ClimateViewStrategy.ts"
/*!******************************************!*\
  !*** ./src/views/ClimateViewStrategy.ts ***!
  \******************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _Registry__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../Registry */ "./src/Registry.ts");
/* harmony import */ var _utils_localize__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../utils/localize */ "./src/utils/localize.ts");
// ====================================================================
// VIEW STRATEGY — CLIMATE (Climate/Thermostat Overview)
// ====================================================================


class Simon42ViewClimateStrategy extends HTMLElement {
    static async generate(config, hass) {
        // Ensure Registry is initialized (idempotent — no-op if already done)
        _Registry__WEBPACK_IMPORTED_MODULE_0__.Registry.initialize(hass, config.config || {});
        const climateIds = _Registry__WEBPACK_IMPORTED_MODULE_0__.Registry.getVisibleEntityIdsForDomain('climate').filter((id) => hass.states[id] !== undefined);
        // Group by hvac_action or state
        const heating = [];
        const cooling = [];
        const idle = [];
        const off = [];
        for (const id of climateIds) {
            const state = hass.states[id];
            const hvacAction = state.attributes?.hvac_action;
            const hvacState = state.state;
            if (hvacState === 'off' || hvacState === 'unavailable' || hvacState === 'unknown') {
                off.push(id);
            }
            else if (hvacAction === 'heating' || (!hvacAction && hvacState === 'heat')) {
                heating.push(id);
            }
            else if (hvacAction === 'cooling' || (!hvacAction && hvacState === 'cool')) {
                cooling.push(id);
            }
            else {
                // idle, drying, fan, auto without action, etc.
                idle.push(id);
            }
        }
        const sections = [];
        const buildSection = (entities, heading, icon) => {
            if (entities.length === 0)
                return;
            sections.push({
                type: 'grid',
                cards: [
                    {
                        type: 'heading',
                        heading: `${heading} (${entities.length})`,
                        heading_style: 'title',
                        icon,
                    },
                    ...entities.map((e) => ({
                        type: 'tile',
                        entity: e,
                        vertical: false,
                        features: [{ type: 'climate-hvac-modes' }],
                        features_position: 'inline',
                        state_content: ['hvac_action', 'current_temperature'],
                    })),
                ],
            });
        };
        buildSection(heating, (0,_utils_localize__WEBPACK_IMPORTED_MODULE_1__.localize)('climate.heating'), 'mdi:fire');
        buildSection(cooling, (0,_utils_localize__WEBPACK_IMPORTED_MODULE_1__.localize)('climate.cooling'), 'mdi:snowflake');
        buildSection(idle, (0,_utils_localize__WEBPACK_IMPORTED_MODULE_1__.localize)('climate.idle'), 'mdi:thermostat');
        buildSection(off, (0,_utils_localize__WEBPACK_IMPORTED_MODULE_1__.localize)('climate.off'), 'mdi:power-off');
        return { type: 'sections', sections };
    }
}
customElements.define('ll-strategy-simon42-view-climate', Simon42ViewClimateStrategy);


/***/ },

/***/ "./src/views/CoversViewStrategy.ts"
/*!*****************************************!*\
  !*** ./src/views/CoversViewStrategy.ts ***!
  \*****************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _utils_localize__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../utils/localize */ "./src/utils/localize.ts");
// ====================================================================
// VIEW STRATEGY — COVERS (reactive group cards)
// ====================================================================

class Simon42ViewCoversStrategy extends HTMLElement {
    static async generate(config, _hass) {
        const strategyConfig = config.config || {};
        const showPartiallyOpen = strategyConfig.show_partially_open_covers === true;
        // Separate awnings and windows from other covers — they have different semantics
        const allDeviceClasses = config.device_classes || ['awning', 'blind', 'curtain', 'shade', 'shutter', 'window'];
        const coverClasses = allDeviceClasses.filter((dc) => dc !== 'awning' && dc !== 'window');
        const hasAwnings = allDeviceClasses.includes('awning');
        const hasWindows = allDeviceClasses.includes('window');
        const baseConfig = { entities: config.entities, config: config.config };
        // Rollos & Vorhänge
        const cards = [
            {
                type: 'custom:simon42-covers-group-card',
                ...baseConfig,
                device_classes: coverClasses,
                group_type: 'open',
                show_partially_open: showPartiallyOpen,
            },
        ];
        if (showPartiallyOpen) {
            cards.push({
                type: 'custom:simon42-covers-group-card',
                ...baseConfig,
                device_classes: coverClasses,
                group_type: 'partially_open',
                show_partially_open: true,
            });
        }
        cards.push({
            type: 'custom:simon42-covers-group-card',
            ...baseConfig,
            device_classes: coverClasses,
            group_type: 'closed',
            show_partially_open: showPartiallyOpen,
        });
        // Markisen (separate group with own headings/batch actions)
        if (hasAwnings) {
            const awningConfig = {
                ...baseConfig,
                device_classes: ['awning'],
                heading_open: (0,_utils_localize__WEBPACK_IMPORTED_MODULE_0__.localize)('covers.awnings_open'),
                heading_closed: (0,_utils_localize__WEBPACK_IMPORTED_MODULE_0__.localize)('covers.awnings_closed'),
                heading_partial: (0,_utils_localize__WEBPACK_IMPORTED_MODULE_0__.localize)('covers.awnings_partial'),
                batch_open_text: (0,_utils_localize__WEBPACK_IMPORTED_MODULE_0__.localize)('covers.awnings_open_all'),
                batch_close_text: (0,_utils_localize__WEBPACK_IMPORTED_MODULE_0__.localize)('covers.awnings_close_all'),
            };
            cards.push({
                type: 'custom:simon42-covers-group-card',
                ...awningConfig,
                group_type: 'open',
                show_partially_open: showPartiallyOpen,
            });
            if (showPartiallyOpen) {
                cards.push({
                    type: 'custom:simon42-covers-group-card',
                    ...awningConfig,
                    group_type: 'partially_open',
                    show_partially_open: true,
                });
            }
            cards.push({
                type: 'custom:simon42-covers-group-card',
                ...awningConfig,
                group_type: 'closed',
                show_partially_open: showPartiallyOpen,
            });
        }
        // Fenster (separate group — windows are not shading)
        if (hasWindows) {
            const windowConfig = {
                ...baseConfig,
                device_classes: ['window'],
                heading_open: (0,_utils_localize__WEBPACK_IMPORTED_MODULE_0__.localize)('covers.windows_open'),
                heading_closed: (0,_utils_localize__WEBPACK_IMPORTED_MODULE_0__.localize)('covers.windows_closed'),
                heading_partial: (0,_utils_localize__WEBPACK_IMPORTED_MODULE_0__.localize)('covers.windows_partial'),
                batch_open_text: (0,_utils_localize__WEBPACK_IMPORTED_MODULE_0__.localize)('covers.windows_open_all'),
                batch_close_text: (0,_utils_localize__WEBPACK_IMPORTED_MODULE_0__.localize)('covers.windows_close_all'),
            };
            cards.push({
                type: 'custom:simon42-covers-group-card',
                ...windowConfig,
                group_type: 'open',
                show_partially_open: showPartiallyOpen,
            });
            if (showPartiallyOpen) {
                cards.push({
                    type: 'custom:simon42-covers-group-card',
                    ...windowConfig,
                    group_type: 'partially_open',
                    show_partially_open: true,
                });
            }
            cards.push({
                type: 'custom:simon42-covers-group-card',
                ...windowConfig,
                group_type: 'closed',
                show_partially_open: showPartiallyOpen,
            });
        }
        return {
            type: 'sections',
            sections: [{ type: 'grid', cards }],
        };
    }
}
customElements.define('ll-strategy-simon42-view-covers', Simon42ViewCoversStrategy);


/***/ },

/***/ "./src/views/LightsViewStrategy.ts"
/*!*****************************************!*\
  !*** ./src/views/LightsViewStrategy.ts ***!
  \*****************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
// ====================================================================
// VIEW STRATEGY — LIGHTS (reactive group cards)
// ====================================================================
class Simon42ViewLightsStrategy extends HTMLElement {
    static async generate(config, _hass) {
        const dashboardConfig = config.dashboardConfig || config.config || {};
        const groupByFloors = dashboardConfig.group_lights_by_floors === true;
        const nestedGroups = dashboardConfig.nested_light_groups === true;
        return {
            type: 'sections',
            sections: [
                {
                    type: 'grid',
                    cards: [
                        {
                            type: 'custom:simon42-lights-group-card',
                            entities: config.entities,
                            config: config.config,
                            group_type: 'on',
                            group_by_floors: groupByFloors,
                            nested_groups: nestedGroups,
                        },
                        {
                            type: 'custom:simon42-lights-group-card',
                            entities: config.entities,
                            config: config.config,
                            group_type: 'off',
                            group_by_floors: groupByFloors,
                            nested_groups: nestedGroups,
                        },
                    ],
                },
            ],
        };
    }
}
customElements.define('ll-strategy-simon42-view-lights', Simon42ViewLightsStrategy);



/***/ },

/***/ "./src/views/OverviewViewStrategy.ts"
/*!*******************************************!*\
  !*** ./src/views/OverviewViewStrategy.ts ***!
  \*******************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _types_strategy__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../types/strategy */ "./src/types/strategy.ts");
/* harmony import */ var _Registry__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../Registry */ "./src/Registry.ts");
/* harmony import */ var _utils_entity_filter__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../utils/entity-filter */ "./src/utils/entity-filter.ts");
/* harmony import */ var _utils_name_utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../utils/name-utils */ "./src/utils/name-utils.ts");
/* harmony import */ var _utils_badge_builder__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../utils/badge-builder */ "./src/utils/badge-builder.ts");
/* harmony import */ var _sections_OverviewSection__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../sections/OverviewSection */ "./src/sections/OverviewSection.ts");
/* harmony import */ var _sections_AreasSection__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../sections/AreasSection */ "./src/sections/AreasSection.ts");
/* harmony import */ var _sections_WeatherEnergySection__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ../sections/WeatherEnergySection */ "./src/sections/WeatherEnergySection.ts");
/* harmony import */ var _utils_view_builder__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ../utils/view-builder */ "./src/utils/view-builder.ts");
/* harmony import */ var _utils_debug__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ../utils/debug */ "./src/utils/debug.ts");
// ====================================================================
// VIEW STRATEGY — OVERVIEW (main dashboard view)
// ====================================================================
// Extracted from the dashboard entry point so HA can resolve this view
// concurrently with other view strategies via Promise.all, enabling
// progressive rendering instead of blocking on Registry init.
// ====================================================================










/**
 * Normalizes a sections_order array: removes invalid/duplicate keys,
 * appends any missing keys at the end (forward compatibility).
 */
function normalizeSectionsOrder(order) {
    const validKeys = new Set(['overview', 'custom_cards', 'areas', 'weather', 'energy']);
    const seen = new Set();
    const result = [];
    for (const key of order) {
        if (validKeys.has(key) && !seen.has(key)) {
            result.push(key);
            seen.add(key);
        }
    }
    for (const key of _types_strategy__WEBPACK_IMPORTED_MODULE_0__.DEFAULT_SECTIONS_ORDER) {
        if (!seen.has(key))
            result.push(key);
    }
    return result;
}
/**
 * Renders custom cards into an array of LovelaceCardConfigs (without section wrapper).
 * Used to append assigned custom cards to existing sections.
 */
function renderCustomCards(cards) {
    const result = [];
    for (const card of cards) {
        if (!card.parsed_config)
            continue;
        if (Array.isArray(card.parsed_config)) {
            result.push(...card.parsed_config);
        }
        else {
            if (card.title) {
                result.push({ type: 'heading', heading: card.title, heading_style: 'subtitle' });
            }
            result.push(card.parsed_config);
        }
    }
    return result;
}
class Simon42ViewOverviewStrategy extends HTMLElement {
    static async generate(config, hass) {
        (0,_utils_debug__WEBPACK_IMPORTED_MODULE_9__.timeStart)('overview-generate');
        const dashboardConfig = config.dashboardConfig || {};
        // Initialize Registry (idempotent — skips if already done by another view)
        _Registry__WEBPACK_IMPORTED_MODULE_1__.Registry.initialize(hass, dashboardConfig);
        // Visible areas (filtered + sorted by config)
        const visibleAreas = (0,_utils_name_utils__WEBPACK_IMPORTED_MODULE_3__.getVisibleAreas)(_Registry__WEBPACK_IMPORTED_MODULE_1__.Registry.areas, dashboardConfig.areas_display, dashboardConfig.use_default_area_sort);
        // Collect data for overview
        const persons = (0,_utils_entity_filter__WEBPACK_IMPORTED_MODULE_2__.collectPersons)(hass, dashboardConfig);
        const weatherEntity = (0,_utils_entity_filter__WEBPACK_IMPORTED_MODULE_2__.findWeatherEntity)(hass);
        const someSensorId = (0,_utils_entity_filter__WEBPACK_IMPORTED_MODULE_2__.findDummySensor)(hass);
        // Person badges
        const personBadges = (0,_utils_badge_builder__WEBPACK_IMPORTED_MODULE_4__.createPersonBadges)(persons, hass);
        // Config flags
        const showWeather = dashboardConfig.show_weather !== false;
        const showEnergy = dashboardConfig.show_energy !== false;
        const showSearchCard = dashboardConfig.show_search_card === true;
        const groupByFloors = dashboardConfig.group_by_floors === true;
        // Group custom cards by target section
        const allCustomCards = dashboardConfig.custom_cards || [];
        const customCardsBySection = new Map();
        for (const card of allCustomCards) {
            const target = card.target_section || 'custom_cards';
            const list = customCardsBySection.get(target) || [];
            list.push(card);
            customCardsBySection.set(target, list);
        }
        // Build sections
        const overviewSection = (0,_sections_OverviewSection__WEBPACK_IMPORTED_MODULE_5__.createOverviewSection)({ someSensorId, showSearchCard, config: dashboardConfig, hass });
        const customCardsSection = (0,_sections_OverviewSection__WEBPACK_IMPORTED_MODULE_5__.createCustomCardsSection)(customCardsBySection.get('custom_cards') || [], dashboardConfig.custom_cards_heading, dashboardConfig.custom_cards_icon);
        const areasSections = (0,_sections_AreasSection__WEBPACK_IMPORTED_MODULE_6__.createAreasSection)(visibleAreas, groupByFloors, hass);
        // Section map: key → section(s) or null
        const sectionMap = new Map([
            ['overview', overviewSection],
            ['custom_cards', customCardsSection],
            ['areas', areasSections],
            ['weather', (0,_sections_WeatherEnergySection__WEBPACK_IMPORTED_MODULE_7__.createWeatherSection)(weatherEntity ?? null, showWeather)],
            ['energy', (0,_sections_WeatherEnergySection__WEBPACK_IMPORTED_MODULE_7__.createEnergySection)(showEnergy, dashboardConfig.energy_link_dashboard !== false)],
        ]);
        // Assemble in configured order, appending assigned custom cards to each section
        const sectionsOrder = normalizeSectionsOrder(dashboardConfig.sections_order ?? _types_strategy__WEBPACK_IMPORTED_MODULE_0__.DEFAULT_SECTIONS_ORDER);
        const overviewSections = [];
        for (const key of sectionsOrder) {
            const result = sectionMap.get(key);
            if (!result)
                continue;
            if (Array.isArray(result)) {
                overviewSections.push(...result);
            }
            else {
                overviewSections.push(result);
            }
            // Append custom cards assigned to this section (skip 'custom_cards' — handled by createCustomCardsSection)
            if (key !== 'custom_cards') {
                const assigned = customCardsBySection.get(key);
                if (assigned && assigned.length > 0) {
                    const extraCards = renderCustomCards(assigned);
                    if (extraCards.length > 0) {
                        // Append to the last section added (handles array sections like areas)
                        const lastSection = overviewSections[overviewSections.length - 1];
                        if (lastSection.cards) {
                            lastSection.cards.push(...extraCards);
                        }
                    }
                }
            }
        }
        const totalCards = overviewSections.reduce((sum, s) => sum + (s.cards?.length || 0), 0);
        (0,_utils_debug__WEBPACK_IMPORTED_MODULE_9__.timeEnd)('overview-generate');
        (0,_utils_debug__WEBPACK_IMPORTED_MODULE_9__.debugLog)(`Overview: ${overviewSections.length} sections, ${totalCards} cards, ${personBadges.length} badges`);
        // Custom badges from YAML config
        const customBadges = (dashboardConfig.custom_badges || [])
            .filter((b) => b.parsed_config)
            .map((b) => b.parsed_config);
        return (0,_utils_view_builder__WEBPACK_IMPORTED_MODULE_8__.createOverviewView)(overviewSections, [...personBadges, ...customBadges]);
    }
}
customElements.define('ll-strategy-simon42-view-overview', Simon42ViewOverviewStrategy);


/***/ },

/***/ "./src/views/RoomViewStrategy.ts"
/*!***************************************!*\
  !*** ./src/views/RoomViewStrategy.ts ***!
  \***************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _utils_name_utils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../utils/name-utils */ "./src/utils/name-utils.ts");
/* harmony import */ var _Registry__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../Registry */ "./src/Registry.ts");
/* harmony import */ var _utils_debug__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../utils/debug */ "./src/utils/debug.ts");
/* harmony import */ var _utils_localize__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../utils/localize */ "./src/utils/localize.ts");
/* harmony import */ var _utils_badge_utils__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../utils/badge-utils */ "./src/utils/badge-utils.ts");
// ====================================================================
// VIEW STRATEGY — ROOM (Room detail with sensor badges + cameras)
// ====================================================================





// HA supported_features bitmask values
const FAN_SET_SPEED = 1;
const MEDIA_PAUSE = 1;
const MEDIA_PLAY = 16384;
const MEDIA_STOP = 4096;
/** Check if a fan supports speed control */
function fanSupportsSpeed(state) {
    return (state.attributes?.supported_features & FAN_SET_SPEED) !== 0;
}
/** Check if a media player supports playback controls */
function mediaPlayerSupportsPlayback(state) {
    const f = state.attributes?.supported_features || 0;
    return (f & (MEDIA_PAUSE | MEDIA_PLAY | MEDIA_STOP)) !== 0;
}
class Simon42ViewRoomStrategy extends HTMLElement {
    static async generate(config, hass) {
        const area = config.area;
        (0,_utils_debug__WEBPACK_IMPORTED_MODULE_2__.debugLog)(`room-generate-${area.area_id}: called at ${performance.now().toFixed(1)}ms after page load`);
        (0,_utils_debug__WEBPACK_IMPORTED_MODULE_2__.timeStart)(`room-generate-${area.area_id}`);
        const dashboardConfig = config.dashboardConfig || {};
        // Ensure Registry is initialized (idempotent — no-op if already done)
        _Registry__WEBPACK_IMPORTED_MODULE_1__.Registry.initialize(hass, dashboardConfig);
        const groupsOptions = config.groups_options || {};
        const roomEntities = {
            lights: [],
            covers: [],
            covers_curtain: [],
            covers_window: [],
            scenes: [],
            climate: [],
            media_player: [],
            vacuum: [],
            fan: [],
            switches: [],
            locks: [],
            automations: [],
            scripts: [],
            cameras: [],
        };
        const sensorEntities = {
            temperature: [],
            humidity: [],
            pm25: [],
            pm10: [],
            co2: [],
            voc: [],
            motion: [],
            occupancy: [],
            illuminance: [],
            absolute_humidity: [],
            battery: [],
            window: [],
            door: [],
            smoke: [],
            gas: [],
        };
        // Main categorization loop — use pre-filtered visible entities from Registry
        // (no hidden, no_dboard, config/diagnostic, config-hidden)
        const visibleEntities = _Registry__WEBPACK_IMPORTED_MODULE_1__.Registry.getVisibleEntitiesForArea(area.area_id);
        for (const entity of visibleEntities) {
            const entityId = entity.entity_id;
            // State check
            const state = hass.states[entityId];
            if (!state)
                continue;
            // Domain categorization
            const domain = entityId.split('.')[0];
            const deviceClass = state.attributes?.device_class;
            const unit = state.attributes?.unit_of_measurement;
            if (domain === 'light') {
                roomEntities.lights.push(entityId);
                continue;
            }
            if (domain === 'cover') {
                if (deviceClass === 'curtain')
                    roomEntities.covers_curtain.push(entityId);
                else if (deviceClass === 'window' || deviceClass === 'door' || deviceClass === 'gate' || deviceClass === 'garage')
                    roomEntities.covers_window.push(entityId);
                else
                    roomEntities.covers.push(entityId);
                continue;
            }
            if (domain === 'scene') {
                roomEntities.scenes.push(entityId);
                continue;
            }
            if (domain === 'climate') {
                roomEntities.climate.push(entityId);
                continue;
            }
            if (domain === 'media_player') {
                roomEntities.media_player.push(entityId);
                continue;
            }
            if (domain === 'vacuum') {
                roomEntities.vacuum.push(entityId);
                continue;
            }
            if (domain === 'fan') {
                roomEntities.fan.push(entityId);
                continue;
            }
            if (domain === 'switch') {
                roomEntities.switches.push(entityId);
                continue;
            }
            if (domain === 'lock' && dashboardConfig.show_locks_in_rooms) {
                roomEntities.locks.push(entityId);
                continue;
            }
            if (domain === 'automation' && dashboardConfig.show_automations_in_rooms) {
                roomEntities.automations.push(entityId);
                continue;
            }
            if (domain === 'script' && dashboardConfig.show_scripts_in_rooms) {
                roomEntities.scripts.push(entityId);
                continue;
            }
            if (domain === 'camera') {
                roomEntities.cameras.push(entityId);
                continue;
            }
            // Sensors for badges
            if (domain === 'sensor') {
                if (entityId.includes('battery') || deviceClass === 'battery') {
                    const val = parseFloat(state.state);
                    if (!isNaN(val) && val < 20)
                        sensorEntities.battery.push(entityId);
                    continue;
                }
                // Temperature and humidity badges are only shown when explicitly
                // assigned in HA area settings (area.temperature_entity_id / humidity_entity_id).
                // No auto-detection — avoids wrong sensors (e.g. heater temperature).
                if (deviceClass === 'temperature' || unit === '°C' || unit === '°F')
                    continue;
                if (deviceClass === 'humidity' || unit === '%')
                    continue;
                if (unit === 'g/m³') {
                    sensorEntities.absolute_humidity.push(entityId);
                    continue;
                }
                if (deviceClass === 'pm25' || entityId.includes('pm_2_5') || entityId.includes('pm25')) {
                    sensorEntities.pm25.push(entityId);
                    continue;
                }
                if (deviceClass === 'pm10' || entityId.includes('pm_10') || entityId.includes('pm10')) {
                    sensorEntities.pm10.push(entityId);
                    continue;
                }
                if (deviceClass === 'carbon_dioxide' || entityId.includes('co2')) {
                    sensorEntities.co2.push(entityId);
                    continue;
                }
                if (deviceClass === 'volatile_organic_compounds' || entityId.includes('voc')) {
                    sensorEntities.voc.push(entityId);
                    continue;
                }
                if (deviceClass === 'illuminance' || unit === 'lx') {
                    sensorEntities.illuminance.push(entityId);
                    continue;
                }
            }
            if (domain === 'binary_sensor') {
                if (deviceClass === 'motion') {
                    sensorEntities.motion.push(entityId);
                    continue;
                }
                if (deviceClass === 'occupancy' || deviceClass === 'presence') {
                    sensorEntities.occupancy.push(entityId);
                    continue;
                }
                if (deviceClass === 'window') {
                    sensorEntities.window.push(entityId);
                    continue;
                }
                if (deviceClass === 'door') {
                    sensorEntities.door.push(entityId);
                    continue;
                }
                if (deviceClass === 'smoke') {
                    sensorEntities.smoke.push(entityId);
                    continue;
                }
                if (deviceClass === 'gas') {
                    sensorEntities.gas.push(entityId);
                    continue;
                }
            }
        }
        // Apply groups_options filters
        const applyGroupFilter = (groupKey) => {
            const groupOpts = groupsOptions[groupKey];
            if (!groupOpts)
                return roomEntities[groupKey];
            let filtered = roomEntities[groupKey];
            if (groupOpts.hidden?.length > 0) {
                const hiddenSet = new Set(groupOpts.hidden);
                filtered = filtered.filter((e) => !hiddenSet.has(e));
            }
            if (groupOpts.order?.length > 0) {
                const orderMap = new Map(groupOpts.order.map((id, i) => [id, i]));
                filtered.sort((a, b) => (orderMap.get(a) ?? 9999) - (orderMap.get(b) ?? 9999));
            }
            return filtered;
        };
        for (const key of Object.keys(roomEntities)) {
            roomEntities[key] = applyGroupFilter(key);
        }
        // === BADGES ===
        // Primary temp/humidity from area config (always shown, not filterable)
        let primaryTemp = null;
        let primaryHumidity = null;
        if (area.temperature_entity_id &&
            hass.states[area.temperature_entity_id] &&
            !_Registry__WEBPACK_IMPORTED_MODULE_1__.Registry.isEntityExcluded(area.temperature_entity_id)) {
            primaryTemp = area.temperature_entity_id;
        }
        if (area.humidity_entity_id &&
            hass.states[area.humidity_entity_id] &&
            !_Registry__WEBPACK_IMPORTED_MODULE_1__.Registry.isEntityExcluded(area.humidity_entity_id)) {
            primaryHumidity = area.humidity_entity_id;
        }
        // Build auto-detected badge candidates
        const badgeOpts = groupsOptions.badges;
        const hasBadgeConfig = !!badgeOpts;
        const candidates = [];
        // Auto-detected sensors (first match per type, except window/door which show all)
        // Colors from shared BADGE_COLOR_MAP, show_name from shared isDefaultShowName()
        const addCandidate = (entityId, colorKey, dcOverride) => {
            const dc = dcOverride || hass.states[entityId]?.attributes?.device_class;
            candidates.push({
                entity: entityId,
                color: _utils_badge_utils__WEBPACK_IMPORTED_MODULE_4__.BADGE_COLOR_MAP[colorKey] || 'grey',
                ...((0,_utils_badge_utils__WEBPACK_IMPORTED_MODULE_4__.isDefaultShowName)(dc) ? { showName: true } : {}),
            });
        };
        // Single-match sensor types
        const singleTypes = [
            [sensorEntities.pm25, 'pm25'],
            [sensorEntities.pm10, 'pm10'],
            [sensorEntities.co2, 'carbon_dioxide'],
            [sensorEntities.voc, 'volatile_organic_compounds'],
            [sensorEntities.illuminance, 'illuminance'],
            [sensorEntities.battery, 'battery'],
            [sensorEntities.motion, 'motion'],
            [sensorEntities.occupancy, 'occupancy'],
            [sensorEntities.absolute_humidity, 'moisture'],
            [sensorEntities.smoke, 'smoke'],
            [sensorEntities.gas, 'gas'],
        ];
        for (const [entities, colorKey] of singleTypes) {
            if (entities[0])
                addCandidate(entities[0], colorKey);
        }
        // Window/door: show ALL matches (not just first), users control via per-area hidden[]
        for (const id of sensorEntities.window)
            addCandidate(id, 'window', 'window');
        for (const id of sensorEntities.door)
            addCandidate(id, 'door', 'door');
        // Apply per-area badge config: filter hidden, append additional
        let filteredCandidates = candidates;
        if (hasBadgeConfig) {
            if (badgeOpts.hidden?.length) {
                const hiddenSet = new Set(badgeOpts.hidden);
                filteredCandidates = filteredCandidates.filter((b) => !hiddenSet.has(b.entity));
            }
            if (badgeOpts.additional?.length) {
                for (const entityId of badgeOpts.additional) {
                    if (hass.states[entityId] && !filteredCandidates.some((b) => b.entity === entityId)) {
                        filteredCandidates.push({ entity: entityId, color: (0,_utils_badge_utils__WEBPACK_IMPORTED_MODULE_4__.getColorForEntity)(entityId, hass) });
                    }
                }
            }
        }
        // Resolve show_name per badge: default + config overrides
        const namesVisible = hasBadgeConfig ? new Set(badgeOpts.names_visible || []) : null;
        const namesHidden = hasBadgeConfig ? new Set(badgeOpts.names_hidden || []) : null;
        // Convert to LovelaceBadgeConfig
        const badges = [];
        if (primaryTemp)
            badges.push({ type: 'entity', entity: primaryTemp, color: 'red', tap_action: { action: 'more-info' } });
        if (primaryHumidity)
            badges.push({ type: 'entity', entity: primaryHumidity, color: 'indigo', tap_action: { action: 'more-info' } });
        for (const b of filteredCandidates) {
            const showName = (0,_utils_badge_utils__WEBPACK_IMPORTED_MODULE_4__.resolveShowName)(b.entity, !!b.showName, namesVisible, namesHidden);
            badges.push({
                type: 'entity',
                entity: b.entity,
                color: b.color,
                tap_action: { action: 'more-info' },
                ...(showName ? { show_name: true } : {}),
            });
        }
        // === SECTIONS ===
        const sections = [];
        // Cameras
        if (roomEntities.cameras.length > 0) {
            const cameraCards = [];
            for (const cameraId of roomEntities.cameras) {
                if (!hass.states[cameraId])
                    continue;
                const camEntity = _Registry__WEBPACK_IMPORTED_MODULE_1__.Registry.getEntity(cameraId);
                const deviceId = camEntity?.device_id;
                let isReolink = false;
                let isAqara = false;
                if (deviceId) {
                    const device = _Registry__WEBPACK_IMPORTED_MODULE_1__.Registry.getDevice(deviceId);
                    if (device) {
                        const mfr = (device.manufacturer || '').toLowerCase();
                        const model = (device.model || '').toLowerCase();
                        isReolink = mfr.includes('reolink') || model.includes('reolink');
                        isAqara = mfr.includes('aqara') || model.includes('aqara');
                    }
                }
                if ((isReolink || isAqara) && deviceId) {
                    const devEntities = _Registry__WEBPACK_IMPORTED_MODULE_1__.Registry.getEntityIdsForDevice(deviceId);
                    // Reolink-specific entities
                    const spotlight = devEntities.find((id) => id.startsWith('light.') && hass.states[id] && !_Registry__WEBPACK_IMPORTED_MODULE_1__.Registry.isEntityExcluded(id));
                    const motion = devEntities.find((id) => id.startsWith('binary_sensor.') &&
                        hass.states[id]?.attributes?.device_class === 'motion' &&
                        !_Registry__WEBPACK_IMPORTED_MODULE_1__.Registry.isEntityExcluded(id));
                    const siren = devEntities.find((id) => id.startsWith('siren.') && hass.states[id] && !_Registry__WEBPACK_IMPORTED_MODULE_1__.Registry.isEntityExcluded(id));
                    // Aqara-specific entities
                    const battery = devEntities.find((id) => id.startsWith('sensor.') &&
                        hass.states[id]?.attributes?.device_class === 'battery' &&
                        !_Registry__WEBPACK_IMPORTED_MODULE_1__.Registry.isEntityExcluded(id));
                    const doorbell = devEntities.find((id) => id.startsWith('event.') &&
                        hass.states[id]?.attributes?.device_class === 'doorbell' &&
                        !_Registry__WEBPACK_IMPORTED_MODULE_1__.Registry.isEntityExcluded(id));
                    const glanceEntities = [];
                    if (isReolink) {
                        if (spotlight)
                            glanceEntities.push({ entity: spotlight });
                        if (motion)
                            glanceEntities.push({ entity: motion });
                        if (siren)
                            glanceEntities.push({ entity: siren });
                    }
                    if (isAqara) {
                        if (battery)
                            glanceEntities.push({ entity: battery });
                        if (doorbell)
                            glanceEntities.push({ entity: doorbell });
                    }
                    cameraCards.push({
                        type: 'picture-glance',
                        camera_image: cameraId,
                        camera_view: isAqara ? 'live' : 'auto',
                        fit_mode: 'cover',
                        title: (0,_utils_name_utils__WEBPACK_IMPORTED_MODULE_0__.stripAreaName)(cameraId, area, hass),
                        entities: glanceEntities,
                    });
                }
                else {
                    cameraCards.push({
                        type: 'picture-entity',
                        entity: cameraId,
                        camera_image: cameraId,
                        camera_view: 'auto',
                        name: (0,_utils_name_utils__WEBPACK_IMPORTED_MODULE_0__.stripAreaName)(cameraId, area, hass),
                        show_name: true,
                        show_state: false,
                    });
                }
            }
            if (cameraCards.length > 0) {
                sections.push({
                    type: 'grid',
                    cards: [{ type: 'heading', heading: (0,_utils_localize__WEBPACK_IMPORTED_MODULE_3__.localize)('room.cameras'), heading_style: 'title', icon: 'mdi:cctv' }, ...cameraCards],
                });
            }
        }
        // Sort lights by last_changed (unless custom order)
        if (!groupsOptions.lights?.order) {
            roomEntities.lights.sort((a, b) => (0,_utils_name_utils__WEBPACK_IMPORTED_MODULE_0__.sortByLastChanged)(a, b, hass));
        }
        // Helper: create a domain section
        const domainSection = (entities, heading, icon, tileConfig) => {
            if (entities.length === 0)
                return;
            sections.push({
                type: 'grid',
                cards: [{ type: 'heading', heading, heading_style: 'title', icon }, ...entities.map(tileConfig)],
            });
        };
        if (roomEntities.lights.length > 0) {
            sections.push({
                type: 'grid',
                cards: [
                    {
                        type: 'custom:simon42-lights-group-card',
                        entities: roomEntities.lights,
                        group_type: 'all',
                        heading_label: (0,_utils_localize__WEBPACK_IMPORTED_MODULE_3__.localize)('room.lighting'),
                        heading_icon: 'mdi:lightbulb',
                        area,
                        default_expanded: true,
                        nested_groups: dashboardConfig.nested_light_groups === true,
                    },
                ],
            });
        }
        domainSection(roomEntities.locks, (0,_utils_localize__WEBPACK_IMPORTED_MODULE_3__.localize)('room.locks'), 'mdi:lock', (e) => ({
            type: 'tile',
            entity: e,
            name: (0,_utils_name_utils__WEBPACK_IMPORTED_MODULE_0__.stripAreaName)(e, area, hass),
            features: [{ type: 'lock-commands' }],
            features_position: 'inline',
            vertical: false,
            state_content: 'last_changed',
        }));
        domainSection(roomEntities.climate, (0,_utils_localize__WEBPACK_IMPORTED_MODULE_3__.localize)('room.climate'), 'mdi:thermostat', (e) => ({
            type: 'tile',
            entity: e,
            name: (0,_utils_name_utils__WEBPACK_IMPORTED_MODULE_0__.stripAreaName)(e, area, hass),
            features: [{ type: 'climate-hvac-modes' }],
            features_position: 'inline',
            vertical: false,
            state_content: ['hvac_action', 'current_temperature'],
        }));
        domainSection(roomEntities.covers, (0,_utils_localize__WEBPACK_IMPORTED_MODULE_3__.localize)('room.covers'), 'mdi:window-shutter', (e) => ({
            type: 'tile',
            entity: e,
            name: (0,_utils_name_utils__WEBPACK_IMPORTED_MODULE_0__.stripAreaName)(e, area, hass),
            features: [{ type: 'cover-open-close' }],
            vertical: false,
            features_position: 'inline',
            state_content: ['current_position', 'last_changed'],
        }));
        domainSection(roomEntities.covers_curtain, (0,_utils_localize__WEBPACK_IMPORTED_MODULE_3__.localize)('room.curtains'), 'mdi:curtains', (e) => ({
            type: 'tile',
            entity: e,
            name: (0,_utils_name_utils__WEBPACK_IMPORTED_MODULE_0__.stripAreaName)(e, area, hass),
            features: [{ type: 'cover-open-close' }],
            vertical: false,
            features_position: 'inline',
            state_content: ['current_position', 'last_changed'],
        }));
        domainSection(roomEntities.covers_window, (0,_utils_localize__WEBPACK_IMPORTED_MODULE_3__.localize)('room.windows'), 'mdi:window-open-variant', (e) => ({
            type: 'tile',
            entity: e,
            name: (0,_utils_name_utils__WEBPACK_IMPORTED_MODULE_0__.stripAreaName)(e, area, hass),
            features: [{ type: 'cover-open-close' }],
            vertical: false,
            features_position: 'inline',
            state_content: ['current_position', 'last_changed'],
        }));
        domainSection(roomEntities.media_player, (0,_utils_localize__WEBPACK_IMPORTED_MODULE_3__.localize)('room.media'), 'mdi:speaker', (e) => {
            const state = hass.states[e];
            const hasPlayback = state && mediaPlayerSupportsPlayback(state);
            return {
                type: 'tile',
                entity: e,
                name: (0,_utils_name_utils__WEBPACK_IMPORTED_MODULE_0__.stripAreaName)(e, area, hass),
                vertical: false,
                ...(hasPlayback ? { features: [{ type: 'media-player-playback' }], features_position: 'inline' } : {}),
                state_content: ['media_title', 'media_artist'],
            };
        });
        domainSection(roomEntities.scenes, (0,_utils_localize__WEBPACK_IMPORTED_MODULE_3__.localize)('room.scenes'), 'mdi:palette', (e) => ({
            type: 'tile',
            entity: e,
            name: (0,_utils_name_utils__WEBPACK_IMPORTED_MODULE_0__.stripAreaName)(e, area, hass),
            vertical: false,
            state_content: 'last_changed',
        }));
        // Misc (vacuum, fan, switches)
        const miscCards = [];
        for (const e of roomEntities.vacuum)
            miscCards.push({
                type: 'tile',
                entity: e,
                name: (0,_utils_name_utils__WEBPACK_IMPORTED_MODULE_0__.stripAreaName)(e, area, hass),
                features: [{ type: 'vacuum-commands' }],
                features_position: 'inline',
                vertical: false,
                state_content: 'last_changed',
            });
        for (const e of roomEntities.fan) {
            const state = hass.states[e];
            const hasSpeed = state && fanSupportsSpeed(state);
            miscCards.push({
                type: 'tile',
                entity: e,
                name: (0,_utils_name_utils__WEBPACK_IMPORTED_MODULE_0__.stripAreaName)(e, area, hass),
                ...(hasSpeed ? { features: [{ type: 'fan-speed' }], features_position: 'inline' } : {}),
                vertical: false,
                state_content: 'last_changed',
            });
        }
        for (const e of roomEntities.switches)
            miscCards.push({
                type: 'tile',
                entity: e,
                name: (0,_utils_name_utils__WEBPACK_IMPORTED_MODULE_0__.stripAreaName)(e, area, hass),
                vertical: false,
                state_content: 'last_changed',
            });
        miscCards.sort((a, b) => {
            const sA = hass.states[a.entity];
            const sB = hass.states[b.entity];
            if (!sA || !sB)
                return 0;
            return new Date(sB.last_changed).getTime() - new Date(sA.last_changed).getTime();
        });
        if (miscCards.length > 0) {
            sections.push({
                type: 'grid',
                cards: [
                    { type: 'heading', heading: (0,_utils_localize__WEBPACK_IMPORTED_MODULE_3__.localize)('room.misc'), heading_style: 'title', icon: 'mdi:dots-horizontal' },
                    ...miscCards,
                ],
            });
        }
        domainSection(roomEntities.automations, (0,_utils_localize__WEBPACK_IMPORTED_MODULE_3__.localize)('room.automations'), 'mdi:robot', (e) => ({
            type: 'tile',
            entity: e,
            name: (0,_utils_name_utils__WEBPACK_IMPORTED_MODULE_0__.stripAreaName)(e, area, hass),
            vertical: false,
            state_content: 'last_changed',
        }));
        domainSection(roomEntities.scripts, (0,_utils_localize__WEBPACK_IMPORTED_MODULE_3__.localize)('room.scripts'), 'mdi:script-text', (e) => ({
            type: 'tile',
            entity: e,
            name: (0,_utils_name_utils__WEBPACK_IMPORTED_MODULE_0__.stripAreaName)(e, area, hass),
            vertical: false,
        }));
        // Room Pins
        const roomPinEntities = dashboardConfig.room_pin_entities || [];
        const pinsForArea = roomPinEntities.filter((entityId) => {
            const entity = _Registry__WEBPACK_IMPORTED_MODULE_1__.Registry.getEntity(entityId);
            if (!entity)
                return false;
            if (entity.area_id === area.area_id)
                return true;
            if (entity.device_id) {
                const device = _Registry__WEBPACK_IMPORTED_MODULE_1__.Registry.getDevice(entity.device_id);
                if (device?.area_id === area.area_id)
                    return true;
            }
            return false;
        });
        if (pinsForArea.length > 0) {
            sections.push({
                type: 'grid',
                cards: [
                    { type: 'heading', heading: (0,_utils_localize__WEBPACK_IMPORTED_MODULE_3__.localize)('room.room_pins'), heading_style: 'title', icon: 'mdi:pin' },
                    ...pinsForArea.map((e) => {
                        const pinStateContent = [];
                        if (dashboardConfig.room_pins_show_state === true)
                            pinStateContent.push('state');
                        if (dashboardConfig.room_pins_hide_last_changed !== true)
                            pinStateContent.push('last_changed');
                        return {
                            type: 'tile',
                            entity: e,
                            name: (0,_utils_name_utils__WEBPACK_IMPORTED_MODULE_0__.stripAreaName)(e, area, hass),
                            vertical: false,
                            ...(pinStateContent.length > 0 ? { state_content: pinStateContent } : {}),
                        };
                    }),
                ],
            });
        }
        (0,_utils_debug__WEBPACK_IMPORTED_MODULE_2__.debugLog)(`Room ${area.area_id}: ${visibleEntities.length} visible entities, ${sections.length} sections, ${badges.length} badges`);
        (0,_utils_debug__WEBPACK_IMPORTED_MODULE_2__.timeEnd)(`room-generate-${area.area_id}`);
        return { type: 'sections', header: { badges_position: 'bottom' }, sections, badges };
    }
}
customElements.define('ll-strategy-simon42-view-room', Simon42ViewRoomStrategy);


/***/ },

/***/ "./src/views/SecurityViewStrategy.ts"
/*!*******************************************!*\
  !*** ./src/views/SecurityViewStrategy.ts ***!
  \*******************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _Registry__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../Registry */ "./src/Registry.ts");
/* harmony import */ var _utils_localize__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../utils/localize */ "./src/utils/localize.ts");
/* harmony import */ var _utils_entity_filter__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../utils/entity-filter */ "./src/utils/entity-filter.ts");
// ====================================================================
// VIEW STRATEGY — SECURITY (Locks, Doors, Garages, Windows, Smoke/Gas)
// ====================================================================



class Simon42ViewSecurityStrategy extends HTMLElement {
    static async generate(config, hass) {
        // Ensure Registry is initialized (idempotent — no-op if already done)
        _Registry__WEBPACK_IMPORTED_MODULE_0__.Registry.initialize(hass, config.config || {});
        // Use pre-filtered visible entities from Registry
        // Covers lock, cover, binary_sensor domains across all areas
        const allVisibleByDomain = (domain) => _Registry__WEBPACK_IMPORTED_MODULE_0__.Registry.getVisibleEntityIdsForDomain(domain);
        // Categorize entities
        const locks = [];
        const doors = [];
        const garages = [];
        const windows = [];
        const smokeGas = [];
        for (const id of [
            ...allVisibleByDomain('lock'),
            ...allVisibleByDomain('cover'),
            ...allVisibleByDomain('binary_sensor'),
        ]) {
            if (!hass.states[id])
                continue;
            const state = hass.states[id];
            const deviceClass = state.attributes?.device_class;
            if (id.startsWith('lock.')) {
                locks.push(id);
            }
            else if (id.startsWith('cover.')) {
                if (deviceClass === 'garage')
                    garages.push(id);
                else if (deviceClass === 'door' || deviceClass === 'gate' || deviceClass === 'window')
                    doors.push(id);
            }
            else if (id.startsWith('binary_sensor.')) {
                const entry = _Registry__WEBPACK_IMPORTED_MODULE_0__.Registry.getEntity(id);
                if (entry?.platform && _utils_entity_filter__WEBPACK_IMPORTED_MODULE_2__.SECURITY_EXCLUDED_PLATFORMS.has(entry.platform))
                    continue;
                if (deviceClass && ['door', 'window', 'garage_door', 'opening'].includes(deviceClass))
                    windows.push(id);
                else if (deviceClass && ['smoke', 'gas'].includes(deviceClass))
                    smokeGas.push(id);
            }
        }
        const sections = [];
        // Locks
        if (locks.length > 0) {
            const unlocked = locks.filter((e) => hass.states[e]?.state === 'unlocked');
            const locked = locks.filter((e) => hass.states[e]?.state === 'locked');
            const cards = [];
            if (unlocked.length > 0) {
                cards.push({
                    type: 'heading',
                    heading: (0,_utils_localize__WEBPACK_IMPORTED_MODULE_1__.localize)('security.locks_unlocked'),
                    heading_style: 'subtitle',
                    icon: 'mdi:lock-open',
                    badges: [
                        {
                            type: 'entity',
                            entity: unlocked[0],
                            show_name: false,
                            show_state: false,
                            tap_action: { action: 'perform-action', perform_action: 'lock.lock', target: { entity_id: unlocked } },
                            icon: 'mdi:lock',
                        },
                    ],
                });
                cards.push(...unlocked.map((e) => ({
                    type: 'tile',
                    entity: e,
                    features: [{ type: 'lock-commands' }],
                    state_content: 'last_changed',
                })));
            }
            if (locked.length > 0) {
                cards.push({ type: 'heading', heading: (0,_utils_localize__WEBPACK_IMPORTED_MODULE_1__.localize)('security.locks_locked'), heading_style: 'subtitle', icon: 'mdi:lock' });
                cards.push(...locked.map((e) => ({
                    type: 'tile',
                    entity: e,
                    features: [{ type: 'lock-commands' }],
                    state_content: 'last_changed',
                })));
            }
            if (cards.length > 0)
                sections.push({ type: 'grid', cards });
        }
        // Doors/Gates
        if (doors.length > 0) {
            const open = doors.filter((e) => hass.states[e]?.state === 'open');
            const closed = doors.filter((e) => hass.states[e]?.state === 'closed');
            const cards = [];
            if (open.length > 0) {
                cards.push({
                    type: 'heading',
                    heading: (0,_utils_localize__WEBPACK_IMPORTED_MODULE_1__.localize)('security.doors_open'),
                    heading_style: 'subtitle',
                    icon: 'mdi:door-open',
                    badges: [
                        {
                            type: 'entity',
                            entity: open[0],
                            show_name: false,
                            show_state: false,
                            tap_action: {
                                action: 'perform-action',
                                perform_action: 'cover.close_cover',
                                target: { entity_id: open },
                            },
                            icon: 'mdi:arrow-down',
                        },
                    ],
                });
                cards.push(...open.map((e) => ({
                    type: 'tile',
                    entity: e,
                    features: [{ type: 'cover-open-close' }],
                    features_position: 'inline',
                    state_content: 'last_changed',
                })));
            }
            if (closed.length > 0) {
                cards.push({ type: 'heading', heading: (0,_utils_localize__WEBPACK_IMPORTED_MODULE_1__.localize)('security.doors_closed'), heading_style: 'subtitle', icon: 'mdi:door-closed' });
                cards.push(...closed.map((e) => ({
                    type: 'tile',
                    entity: e,
                    features: [{ type: 'cover-open-close' }],
                    features_position: 'inline',
                    state_content: 'last_changed',
                })));
            }
            if (cards.length > 0)
                sections.push({ type: 'grid', cards });
        }
        // Garages
        if (garages.length > 0) {
            const open = garages.filter((e) => hass.states[e]?.state === 'open');
            const closed = garages.filter((e) => hass.states[e]?.state === 'closed');
            const cards = [];
            if (open.length > 0) {
                cards.push({
                    type: 'heading',
                    heading: (0,_utils_localize__WEBPACK_IMPORTED_MODULE_1__.localize)('security.garages_open'),
                    heading_style: 'subtitle',
                    icon: 'mdi:garage-open',
                    badges: [
                        {
                            type: 'entity',
                            entity: open[0],
                            show_name: false,
                            show_state: false,
                            tap_action: {
                                action: 'perform-action',
                                perform_action: 'cover.close_cover',
                                target: { entity_id: open },
                            },
                            icon: 'mdi:arrow-down',
                        },
                    ],
                });
                cards.push(...open.map((e) => ({
                    type: 'tile',
                    entity: e,
                    features: [{ type: 'cover-open-close' }],
                    features_position: 'inline',
                    state_content: 'last_changed',
                })));
            }
            if (closed.length > 0) {
                cards.push({ type: 'heading', heading: (0,_utils_localize__WEBPACK_IMPORTED_MODULE_1__.localize)('security.garages_closed'), heading_style: 'subtitle', icon: 'mdi:garage' });
                cards.push(...closed.map((e) => ({
                    type: 'tile',
                    entity: e,
                    features: [{ type: 'cover-open-close' }],
                    features_position: 'inline',
                    state_content: 'last_changed',
                })));
            }
            if (cards.length > 0)
                sections.push({ type: 'grid', cards });
        }
        // Windows/Openings
        if (windows.length > 0) {
            const open = windows.filter((e) => hass.states[e]?.state === 'on');
            const closed = windows.filter((e) => hass.states[e]?.state === 'off');
            const cards = [];
            if (open.length > 0) {
                cards.push({ type: 'heading', heading: (0,_utils_localize__WEBPACK_IMPORTED_MODULE_1__.localize)('security.windows_open'), heading_style: 'subtitle', icon: 'mdi:window-open' });
                cards.push(...open.map((e) => ({ type: 'tile', entity: e, state_content: 'last_changed' })));
            }
            if (closed.length > 0) {
                cards.push({ type: 'heading', heading: (0,_utils_localize__WEBPACK_IMPORTED_MODULE_1__.localize)('security.windows_closed'), heading_style: 'subtitle', icon: 'mdi:window-closed' });
                cards.push(...closed.map((e) => ({ type: 'tile', entity: e, state_content: 'last_changed' })));
            }
            if (cards.length > 0)
                sections.push({ type: 'grid', cards });
        }
        // Smoke/Gas detectors
        if (smokeGas.length > 0) {
            const active = smokeGas.filter((e) => hass.states[e]?.state === 'on');
            const inactive = smokeGas.filter((e) => hass.states[e]?.state === 'off');
            const cards = [];
            if (active.length > 0) {
                cards.push({ type: 'heading', heading: (0,_utils_localize__WEBPACK_IMPORTED_MODULE_1__.localize)('security.smoke_gas_active'), heading_style: 'subtitle', icon: 'mdi:smoke-detector-alert' });
                cards.push(...active.map((e) => ({ type: 'tile', entity: e, state_content: 'last_changed' })));
            }
            if (inactive.length > 0) {
                cards.push({ type: 'heading', heading: (0,_utils_localize__WEBPACK_IMPORTED_MODULE_1__.localize)('security.smoke_gas_inactive'), heading_style: 'subtitle', icon: 'mdi:smoke-detector' });
                cards.push(...inactive.map((e) => ({ type: 'tile', entity: e, state_content: 'last_changed' })));
            }
            if (cards.length > 0)
                sections.push({ type: 'grid', cards });
        }
        return { type: 'sections', sections };
    }
}
customElements.define('ll-strategy-simon42-view-security', Simon42ViewSecurityStrategy);


/***/ },

/***/ "./node_modules/@lit/reactive-element/development/css-tag.js"
/*!*******************************************************************!*\
  !*** ./node_modules/@lit/reactive-element/development/css-tag.js ***!
  \*******************************************************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   CSSResult: () => (/* binding */ CSSResult),
/* harmony export */   adoptStyles: () => (/* binding */ adoptStyles),
/* harmony export */   css: () => (/* binding */ css),
/* harmony export */   getCompatibleStyle: () => (/* binding */ getCompatibleStyle),
/* harmony export */   supportsAdoptingStyleSheets: () => (/* binding */ supportsAdoptingStyleSheets),
/* harmony export */   unsafeCSS: () => (/* binding */ unsafeCSS)
/* harmony export */ });
/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const NODE_MODE = false;
// Allows minifiers to rename references to globalThis
const global = globalThis;
/**
 * Whether the current browser supports `adoptedStyleSheets`.
 */
const supportsAdoptingStyleSheets = global.ShadowRoot &&
    (global.ShadyCSS === undefined || global.ShadyCSS.nativeShadow) &&
    'adoptedStyleSheets' in Document.prototype &&
    'replace' in CSSStyleSheet.prototype;
const constructionToken = Symbol();
const cssTagCache = new WeakMap();
/**
 * A container for a string of CSS text, that may be used to create a CSSStyleSheet.
 *
 * CSSResult is the return value of `css`-tagged template literals and
 * `unsafeCSS()`. In order to ensure that CSSResults are only created via the
 * `css` tag and `unsafeCSS()`, CSSResult cannot be constructed directly.
 */
class CSSResult {
    constructor(cssText, strings, safeToken) {
        // This property needs to remain unminified.
        this['_$cssResult$'] = true;
        if (safeToken !== constructionToken) {
            throw new Error('CSSResult is not constructable. Use `unsafeCSS` or `css` instead.');
        }
        this.cssText = cssText;
        this._strings = strings;
    }
    // This is a getter so that it's lazy. In practice, this means stylesheets
    // are not created until the first element instance is made.
    get styleSheet() {
        // If `supportsAdoptingStyleSheets` is true then we assume CSSStyleSheet is
        // constructable.
        let styleSheet = this._styleSheet;
        const strings = this._strings;
        if (supportsAdoptingStyleSheets && styleSheet === undefined) {
            const cacheable = strings !== undefined && strings.length === 1;
            if (cacheable) {
                styleSheet = cssTagCache.get(strings);
            }
            if (styleSheet === undefined) {
                (this._styleSheet = styleSheet = new CSSStyleSheet()).replaceSync(this.cssText);
                if (cacheable) {
                    cssTagCache.set(strings, styleSheet);
                }
            }
        }
        return styleSheet;
    }
    toString() {
        return this.cssText;
    }
}
const textFromCSSResult = (value) => {
    // This property needs to remain unminified.
    if (value['_$cssResult$'] === true) {
        return value.cssText;
    }
    else if (typeof value === 'number') {
        return value;
    }
    else {
        throw new Error(`Value passed to 'css' function must be a 'css' function result: ` +
            `${value}. Use 'unsafeCSS' to pass non-literal values, but take care ` +
            `to ensure page security.`);
    }
};
/**
 * Wrap a value for interpolation in a {@linkcode css} tagged template literal.
 *
 * This is unsafe because untrusted CSS text can be used to phone home
 * or exfiltrate data to an attacker controlled site. Take care to only use
 * this with trusted input.
 */
const unsafeCSS = (value) => new CSSResult(typeof value === 'string' ? value : String(value), undefined, constructionToken);
/**
 * A template literal tag which can be used with LitElement's
 * {@linkcode LitElement.styles} property to set element styles.
 *
 * For security reasons, only literal string values and number may be used in
 * embedded expressions. To incorporate non-literal values {@linkcode unsafeCSS}
 * may be used inside an expression.
 */
const css = (strings, ...values) => {
    const cssText = strings.length === 1
        ? strings[0]
        : values.reduce((acc, v, idx) => acc + textFromCSSResult(v) + strings[idx + 1], strings[0]);
    return new CSSResult(cssText, strings, constructionToken);
};
/**
 * Applies the given styles to a `shadowRoot`. When Shadow DOM is
 * available but `adoptedStyleSheets` is not, styles are appended to the
 * `shadowRoot` to [mimic the native feature](https://developer.mozilla.org/en-US/docs/Web/API/ShadowRoot/adoptedStyleSheets).
 * Note, when shimming is used, any styles that are subsequently placed into
 * the shadowRoot should be placed *before* any shimmed adopted styles. This
 * will match spec behavior that gives adopted sheets precedence over styles in
 * shadowRoot.
 */
const adoptStyles = (renderRoot, styles) => {
    if (supportsAdoptingStyleSheets) {
        renderRoot.adoptedStyleSheets = styles.map((s) => s instanceof CSSStyleSheet ? s : s.styleSheet);
    }
    else {
        for (const s of styles) {
            const style = document.createElement('style');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const nonce = global['litNonce'];
            if (nonce !== undefined) {
                style.setAttribute('nonce', nonce);
            }
            style.textContent = s.cssText;
            renderRoot.appendChild(style);
        }
    }
};
const cssResultFromStyleSheet = (sheet) => {
    let cssText = '';
    for (const rule of sheet.cssRules) {
        cssText += rule.cssText;
    }
    return unsafeCSS(cssText);
};
const getCompatibleStyle = supportsAdoptingStyleSheets ||
    (NODE_MODE && global.CSSStyleSheet === undefined)
    ? (s) => s
    : (s) => s instanceof CSSStyleSheet ? cssResultFromStyleSheet(s) : s;
//# sourceMappingURL=css-tag.js.map

/***/ },

/***/ "./node_modules/@lit/reactive-element/development/reactive-element.js"
/*!****************************************************************************!*\
  !*** ./node_modules/@lit/reactive-element/development/reactive-element.js ***!
  \****************************************************************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   CSSResult: () => (/* reexport safe */ _css_tag_js__WEBPACK_IMPORTED_MODULE_0__.CSSResult),
/* harmony export */   ReactiveElement: () => (/* binding */ ReactiveElement),
/* harmony export */   adoptStyles: () => (/* reexport safe */ _css_tag_js__WEBPACK_IMPORTED_MODULE_0__.adoptStyles),
/* harmony export */   css: () => (/* reexport safe */ _css_tag_js__WEBPACK_IMPORTED_MODULE_0__.css),
/* harmony export */   defaultConverter: () => (/* binding */ defaultConverter),
/* harmony export */   getCompatibleStyle: () => (/* reexport safe */ _css_tag_js__WEBPACK_IMPORTED_MODULE_0__.getCompatibleStyle),
/* harmony export */   notEqual: () => (/* binding */ notEqual),
/* harmony export */   supportsAdoptingStyleSheets: () => (/* reexport safe */ _css_tag_js__WEBPACK_IMPORTED_MODULE_0__.supportsAdoptingStyleSheets),
/* harmony export */   unsafeCSS: () => (/* reexport safe */ _css_tag_js__WEBPACK_IMPORTED_MODULE_0__.unsafeCSS)
/* harmony export */ });
/* harmony import */ var _css_tag_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./css-tag.js */ "./node_modules/@lit/reactive-element/development/css-tag.js");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
/**
 * Use this module if you want to create your own base class extending
 * {@link ReactiveElement}.
 * @packageDocumentation
 */

// In the Node build, this import will be injected by Rollup:
// import {HTMLElement, customElements} from '@lit-labs/ssr-dom-shim';

// TODO (justinfagnani): Add `hasOwn` here when we ship ES2022
const { is, defineProperty, getOwnPropertyDescriptor, getOwnPropertyNames, getOwnPropertySymbols, getPrototypeOf, } = Object;
const NODE_MODE = false;
// Lets a minifier replace globalThis references with a minified name
const global = globalThis;
if (NODE_MODE) {
    global.customElements ??= customElements;
}
const DEV_MODE = true;
let issueWarning;
const trustedTypes = global
    .trustedTypes;
// Temporary workaround for https://crbug.com/993268
// Currently, any attribute starting with "on" is considered to be a
// TrustedScript source. Such boolean attributes must be set to the equivalent
// trusted emptyScript value.
const emptyStringForBooleanAttribute = trustedTypes
    ? trustedTypes.emptyScript
    : '';
const polyfillSupport = DEV_MODE
    ? global.reactiveElementPolyfillSupportDevMode
    : global.reactiveElementPolyfillSupport;
if (DEV_MODE) {
    // Ensure warnings are issued only 1x, even if multiple versions of Lit
    // are loaded.
    global.litIssuedWarnings ??= new Set();
    /**
     * Issue a warning if we haven't already, based either on `code` or `warning`.
     * Warnings are disabled automatically only by `warning`; disabling via `code`
     * can be done by users.
     */
    issueWarning = (code, warning) => {
        warning += ` See https://lit.dev/msg/${code} for more information.`;
        if (!global.litIssuedWarnings.has(warning) &&
            !global.litIssuedWarnings.has(code)) {
            console.warn(warning);
            global.litIssuedWarnings.add(warning);
        }
    };
    queueMicrotask(() => {
        issueWarning('dev-mode', `Lit is in dev mode. Not recommended for production!`);
        // Issue polyfill support warning.
        if (global.ShadyDOM?.inUse && polyfillSupport === undefined) {
            issueWarning('polyfill-support-missing', `Shadow DOM is being polyfilled via \`ShadyDOM\` but ` +
                `the \`polyfill-support\` module has not been loaded.`);
        }
    });
}
/**
 * Useful for visualizing and logging insights into what the Lit template system is doing.
 *
 * Compiled out of prod mode builds.
 */
const debugLogEvent = DEV_MODE
    ? (event) => {
        const shouldEmit = global
            .emitLitDebugLogEvents;
        if (!shouldEmit) {
            return;
        }
        global.dispatchEvent(new CustomEvent('lit-debug', {
            detail: event,
        }));
    }
    : undefined;
/*
 * When using Closure Compiler, JSCompiler_renameProperty(property, object) is
 * replaced at compile time by the munged name for object[property]. We cannot
 * alias this function, so we have to use a small shim that has the same
 * behavior when not compiling.
 */
/*@__INLINE__*/
const JSCompiler_renameProperty = (prop, _obj) => prop;
const defaultConverter = {
    toAttribute(value, type) {
        switch (type) {
            case Boolean:
                value = value ? emptyStringForBooleanAttribute : null;
                break;
            case Object:
            case Array:
                // if the value is `null` or `undefined` pass this through
                // to allow removing/no change behavior.
                value = value == null ? value : JSON.stringify(value);
                break;
        }
        return value;
    },
    fromAttribute(value, type) {
        let fromValue = value;
        switch (type) {
            case Boolean:
                fromValue = value !== null;
                break;
            case Number:
                fromValue = value === null ? null : Number(value);
                break;
            case Object:
            case Array:
                // Do *not* generate exception when invalid JSON is set as elements
                // don't normally complain on being mis-configured.
                // TODO(sorvell): Do generate exception in *dev mode*.
                try {
                    // Assert to adhere to Bazel's "must type assert JSON parse" rule.
                    fromValue = JSON.parse(value);
                }
                catch (e) {
                    fromValue = null;
                }
                break;
        }
        return fromValue;
    },
};
/**
 * Change function that returns true if `value` is different from `oldValue`.
 * This method is used as the default for a property's `hasChanged` function.
 */
const notEqual = (value, old) => !is(value, old);
const defaultPropertyDeclaration = {
    attribute: true,
    type: String,
    converter: defaultConverter,
    reflect: false,
    useDefault: false,
    hasChanged: notEqual,
};
// Ensure metadata is enabled. TypeScript does not polyfill
// Symbol.metadata, so we must ensure that it exists.
Symbol.metadata ??= Symbol('metadata');
// Map from a class's metadata object to property options
// Note that we must use nullish-coalescing assignment so that we only use one
// map even if we load multiple version of this module.
global.litPropertyMetadata ??= new WeakMap();
/**
 * Base element class which manages element properties and attributes. When
 * properties change, the `update` method is asynchronously called. This method
 * should be supplied by subclasses to render updates as desired.
 * @noInheritDoc
 */
class ReactiveElement
// In the Node build, this `extends` clause will be substituted with
// `(globalThis.HTMLElement ?? HTMLElement)`.
//
// This way, we will first prefer any global `HTMLElement` polyfill that the
// user has assigned, and then fall back to the `HTMLElement` shim which has
// been imported (see note at the top of this file about how this import is
// generated by Rollup). Note that the `HTMLElement` variable has been
// shadowed by this import, so it no longer refers to the global.
 extends HTMLElement {
    /**
     * Adds an initializer function to the class that is called during instance
     * construction.
     *
     * This is useful for code that runs against a `ReactiveElement`
     * subclass, such as a decorator, that needs to do work for each
     * instance, such as setting up a `ReactiveController`.
     *
     * ```ts
     * const myDecorator = (target: typeof ReactiveElement, key: string) => {
     *   target.addInitializer((instance: ReactiveElement) => {
     *     // This is run during construction of the element
     *     new MyController(instance);
     *   });
     * }
     * ```
     *
     * Decorating a field will then cause each instance to run an initializer
     * that adds a controller:
     *
     * ```ts
     * class MyElement extends LitElement {
     *   @myDecorator foo;
     * }
     * ```
     *
     * Initializers are stored per-constructor. Adding an initializer to a
     * subclass does not add it to a superclass. Since initializers are run in
     * constructors, initializers will run in order of the class hierarchy,
     * starting with superclasses and progressing to the instance's class.
     *
     * @nocollapse
     */
    static addInitializer(initializer) {
        this.__prepare();
        (this._initializers ??= []).push(initializer);
    }
    /**
     * Returns a list of attributes corresponding to the registered properties.
     * @nocollapse
     * @category attributes
     */
    static get observedAttributes() {
        // Ensure we've created all properties
        this.finalize();
        // this.__attributeToPropertyMap is only undefined after finalize() in
        // ReactiveElement itself. ReactiveElement.observedAttributes is only
        // accessed with ReactiveElement as the receiver when a subclass or mixin
        // calls super.observedAttributes
        return (this.__attributeToPropertyMap && [...this.__attributeToPropertyMap.keys()]);
    }
    /**
     * Creates a property accessor on the element prototype if one does not exist
     * and stores a {@linkcode PropertyDeclaration} for the property with the
     * given options. The property setter calls the property's `hasChanged`
     * property option or uses a strict identity check to determine whether or not
     * to request an update.
     *
     * This method may be overridden to customize properties; however,
     * when doing so, it's important to call `super.createProperty` to ensure
     * the property is setup correctly. This method calls
     * `getPropertyDescriptor` internally to get a descriptor to install.
     * To customize what properties do when they are get or set, override
     * `getPropertyDescriptor`. To customize the options for a property,
     * implement `createProperty` like this:
     *
     * ```ts
     * static createProperty(name, options) {
     *   options = Object.assign(options, {myOption: true});
     *   super.createProperty(name, options);
     * }
     * ```
     *
     * @nocollapse
     * @category properties
     */
    static createProperty(name, options = defaultPropertyDeclaration) {
        // If this is a state property, force the attribute to false.
        if (options.state) {
            options.attribute = false;
        }
        this.__prepare();
        // Whether this property is wrapping accessors.
        // Helps control the initial value change and reflection logic.
        if (this.prototype.hasOwnProperty(name)) {
            options = Object.create(options);
            options.wrapped = true;
        }
        this.elementProperties.set(name, options);
        if (!options.noAccessor) {
            const key = DEV_MODE
                ? // Use Symbol.for in dev mode to make it easier to maintain state
                    // when doing HMR.
                    Symbol.for(`${String(name)} (@property() cache)`)
                : Symbol();
            const descriptor = this.getPropertyDescriptor(name, key, options);
            if (descriptor !== undefined) {
                defineProperty(this.prototype, name, descriptor);
            }
        }
    }
    /**
     * Returns a property descriptor to be defined on the given named property.
     * If no descriptor is returned, the property will not become an accessor.
     * For example,
     *
     * ```ts
     * class MyElement extends LitElement {
     *   static getPropertyDescriptor(name, key, options) {
     *     const defaultDescriptor =
     *         super.getPropertyDescriptor(name, key, options);
     *     const setter = defaultDescriptor.set;
     *     return {
     *       get: defaultDescriptor.get,
     *       set(value) {
     *         setter.call(this, value);
     *         // custom action.
     *       },
     *       configurable: true,
     *       enumerable: true
     *     }
     *   }
     * }
     * ```
     *
     * @nocollapse
     * @category properties
     */
    static getPropertyDescriptor(name, key, options) {
        const { get, set } = getOwnPropertyDescriptor(this.prototype, name) ?? {
            get() {
                return this[key];
            },
            set(v) {
                this[key] = v;
            },
        };
        if (DEV_MODE && get == null) {
            if ('value' in (getOwnPropertyDescriptor(this.prototype, name) ?? {})) {
                throw new Error(`Field ${JSON.stringify(String(name))} on ` +
                    `${this.name} was declared as a reactive property ` +
                    `but it's actually declared as a value on the prototype. ` +
                    `Usually this is due to using @property or @state on a method.`);
            }
            issueWarning('reactive-property-without-getter', `Field ${JSON.stringify(String(name))} on ` +
                `${this.name} was declared as a reactive property ` +
                `but it does not have a getter. This will be an error in a ` +
                `future version of Lit.`);
        }
        return {
            get,
            set(value) {
                const oldValue = get?.call(this);
                set?.call(this, value);
                this.requestUpdate(name, oldValue, options);
            },
            configurable: true,
            enumerable: true,
        };
    }
    /**
     * Returns the property options associated with the given property.
     * These options are defined with a `PropertyDeclaration` via the `properties`
     * object or the `@property` decorator and are registered in
     * `createProperty(...)`.
     *
     * Note, this method should be considered "final" and not overridden. To
     * customize the options for a given property, override
     * {@linkcode createProperty}.
     *
     * @nocollapse
     * @final
     * @category properties
     */
    static getPropertyOptions(name) {
        return this.elementProperties.get(name) ?? defaultPropertyDeclaration;
    }
    /**
     * Initializes static own properties of the class used in bookkeeping
     * for element properties, initializers, etc.
     *
     * Can be called multiple times by code that needs to ensure these
     * properties exist before using them.
     *
     * This method ensures the superclass is finalized so that inherited
     * property metadata can be copied down.
     * @nocollapse
     */
    static __prepare() {
        if (this.hasOwnProperty(JSCompiler_renameProperty('elementProperties', this))) {
            // Already prepared
            return;
        }
        // Finalize any superclasses
        const superCtor = getPrototypeOf(this);
        superCtor.finalize();
        // Create own set of initializers for this class if any exist on the
        // superclass and copy them down. Note, for a small perf boost, avoid
        // creating initializers unless needed.
        if (superCtor._initializers !== undefined) {
            this._initializers = [...superCtor._initializers];
        }
        // Initialize elementProperties from the superclass
        this.elementProperties = new Map(superCtor.elementProperties);
    }
    /**
     * Finishes setting up the class so that it's ready to be registered
     * as a custom element and instantiated.
     *
     * This method is called by the ReactiveElement.observedAttributes getter.
     * If you override the observedAttributes getter, you must either call
     * super.observedAttributes to trigger finalization, or call finalize()
     * yourself.
     *
     * @nocollapse
     */
    static finalize() {
        if (this.hasOwnProperty(JSCompiler_renameProperty('finalized', this))) {
            return;
        }
        this.finalized = true;
        this.__prepare();
        // Create properties from the static properties block:
        if (this.hasOwnProperty(JSCompiler_renameProperty('properties', this))) {
            const props = this.properties;
            const propKeys = [
                ...getOwnPropertyNames(props),
                ...getOwnPropertySymbols(props),
            ];
            for (const p of propKeys) {
                this.createProperty(p, props[p]);
            }
        }
        // Create properties from standard decorator metadata:
        const metadata = this[Symbol.metadata];
        if (metadata !== null) {
            const properties = litPropertyMetadata.get(metadata);
            if (properties !== undefined) {
                for (const [p, options] of properties) {
                    this.elementProperties.set(p, options);
                }
            }
        }
        // Create the attribute-to-property map
        this.__attributeToPropertyMap = new Map();
        for (const [p, options] of this.elementProperties) {
            const attr = this.__attributeNameForProperty(p, options);
            if (attr !== undefined) {
                this.__attributeToPropertyMap.set(attr, p);
            }
        }
        this.elementStyles = this.finalizeStyles(this.styles);
        if (DEV_MODE) {
            if (this.hasOwnProperty('createProperty')) {
                issueWarning('no-override-create-property', 'Overriding ReactiveElement.createProperty() is deprecated. ' +
                    'The override will not be called with standard decorators');
            }
            if (this.hasOwnProperty('getPropertyDescriptor')) {
                issueWarning('no-override-get-property-descriptor', 'Overriding ReactiveElement.getPropertyDescriptor() is deprecated. ' +
                    'The override will not be called with standard decorators');
            }
        }
    }
    /**
     * Takes the styles the user supplied via the `static styles` property and
     * returns the array of styles to apply to the element.
     * Override this method to integrate into a style management system.
     *
     * Styles are deduplicated preserving the _last_ instance in the list. This
     * is a performance optimization to avoid duplicated styles that can occur
     * especially when composing via subclassing. The last item is kept to try
     * to preserve the cascade order with the assumption that it's most important
     * that last added styles override previous styles.
     *
     * @nocollapse
     * @category styles
     */
    static finalizeStyles(styles) {
        const elementStyles = [];
        if (Array.isArray(styles)) {
            // Dedupe the flattened array in reverse order to preserve the last items.
            // Casting to Array<unknown> works around TS error that
            // appears to come from trying to flatten a type CSSResultArray.
            const set = new Set(styles.flat(Infinity).reverse());
            // Then preserve original order by adding the set items in reverse order.
            for (const s of set) {
                elementStyles.unshift((0,_css_tag_js__WEBPACK_IMPORTED_MODULE_0__.getCompatibleStyle)(s));
            }
        }
        else if (styles !== undefined) {
            elementStyles.push((0,_css_tag_js__WEBPACK_IMPORTED_MODULE_0__.getCompatibleStyle)(styles));
        }
        return elementStyles;
    }
    /**
     * Returns the property name for the given attribute `name`.
     * @nocollapse
     */
    static __attributeNameForProperty(name, options) {
        const attribute = options.attribute;
        return attribute === false
            ? undefined
            : typeof attribute === 'string'
                ? attribute
                : typeof name === 'string'
                    ? name.toLowerCase()
                    : undefined;
    }
    constructor() {
        super();
        this.__instanceProperties = undefined;
        /**
         * True if there is a pending update as a result of calling `requestUpdate()`.
         * Should only be read.
         * @category updates
         */
        this.isUpdatePending = false;
        /**
         * Is set to `true` after the first update. The element code cannot assume
         * that `renderRoot` exists before the element `hasUpdated`.
         * @category updates
         */
        this.hasUpdated = false;
        /**
         * Name of currently reflecting property
         */
        this.__reflectingProperty = null;
        this.__initialize();
    }
    /**
     * Internal only override point for customizing work done when elements
     * are constructed.
     */
    __initialize() {
        this.__updatePromise = new Promise((res) => (this.enableUpdating = res));
        this._$changedProperties = new Map();
        // This enqueues a microtask that must run before the first update, so it
        // must be called before requestUpdate()
        this.__saveInstanceProperties();
        // ensures first update will be caught by an early access of
        // `updateComplete`
        this.requestUpdate();
        this.constructor._initializers?.forEach((i) => i(this));
    }
    /**
     * Registers a `ReactiveController` to participate in the element's reactive
     * update cycle. The element automatically calls into any registered
     * controllers during its lifecycle callbacks.
     *
     * If the element is connected when `addController()` is called, the
     * controller's `hostConnected()` callback will be immediately called.
     * @category controllers
     */
    addController(controller) {
        (this.__controllers ??= new Set()).add(controller);
        // If a controller is added after the element has been connected,
        // call hostConnected. Note, re-using existence of `renderRoot` here
        // (which is set in connectedCallback) to avoid the need to track a
        // first connected state.
        if (this.renderRoot !== undefined && this.isConnected) {
            controller.hostConnected?.();
        }
    }
    /**
     * Removes a `ReactiveController` from the element.
     * @category controllers
     */
    removeController(controller) {
        this.__controllers?.delete(controller);
    }
    /**
     * Fixes any properties set on the instance before upgrade time.
     * Otherwise these would shadow the accessor and break these properties.
     * The properties are stored in a Map which is played back after the
     * constructor runs.
     */
    __saveInstanceProperties() {
        const instanceProperties = new Map();
        const elementProperties = this.constructor
            .elementProperties;
        for (const p of elementProperties.keys()) {
            if (this.hasOwnProperty(p)) {
                instanceProperties.set(p, this[p]);
                delete this[p];
            }
        }
        if (instanceProperties.size > 0) {
            this.__instanceProperties = instanceProperties;
        }
    }
    /**
     * Returns the node into which the element should render and by default
     * creates and returns an open shadowRoot. Implement to customize where the
     * element's DOM is rendered. For example, to render into the element's
     * childNodes, return `this`.
     *
     * @return Returns a node into which to render.
     * @category rendering
     */
    createRenderRoot() {
        const renderRoot = this.shadowRoot ??
            this.attachShadow(this.constructor.shadowRootOptions);
        (0,_css_tag_js__WEBPACK_IMPORTED_MODULE_0__.adoptStyles)(renderRoot, this.constructor.elementStyles);
        return renderRoot;
    }
    /**
     * On first connection, creates the element's renderRoot, sets up
     * element styling, and enables updating.
     * @category lifecycle
     */
    connectedCallback() {
        // Create renderRoot before controllers `hostConnected`
        this.renderRoot ??=
            this.createRenderRoot();
        this.enableUpdating(true);
        this.__controllers?.forEach((c) => c.hostConnected?.());
    }
    /**
     * Note, this method should be considered final and not overridden. It is
     * overridden on the element instance with a function that triggers the first
     * update.
     * @category updates
     */
    enableUpdating(_requestedUpdate) { }
    /**
     * Allows for `super.disconnectedCallback()` in extensions while
     * reserving the possibility of making non-breaking feature additions
     * when disconnecting at some point in the future.
     * @category lifecycle
     */
    disconnectedCallback() {
        this.__controllers?.forEach((c) => c.hostDisconnected?.());
    }
    /**
     * Synchronizes property values when attributes change.
     *
     * Specifically, when an attribute is set, the corresponding property is set.
     * You should rarely need to implement this callback. If this method is
     * overridden, `super.attributeChangedCallback(name, _old, value)` must be
     * called.
     *
     * See [responding to attribute changes](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements#responding_to_attribute_changes)
     * on MDN for more information about the `attributeChangedCallback`.
     * @category attributes
     */
    attributeChangedCallback(name, _old, value) {
        this._$attributeToProperty(name, value);
    }
    __propertyToAttribute(name, value) {
        const elemProperties = this.constructor.elementProperties;
        const options = elemProperties.get(name);
        const attr = this.constructor.__attributeNameForProperty(name, options);
        if (attr !== undefined && options.reflect === true) {
            const converter = options.converter?.toAttribute !==
                undefined
                ? options.converter
                : defaultConverter;
            const attrValue = converter.toAttribute(value, options.type);
            if (DEV_MODE &&
                this.constructor.enabledWarnings.includes('migration') &&
                attrValue === undefined) {
                issueWarning('undefined-attribute-value', `The attribute value for the ${name} property is ` +
                    `undefined on element ${this.localName}. The attribute will be ` +
                    `removed, but in the previous version of \`ReactiveElement\`, ` +
                    `the attribute would not have changed.`);
            }
            // Track if the property is being reflected to avoid
            // setting the property again via `attributeChangedCallback`. Note:
            // 1. this takes advantage of the fact that the callback is synchronous.
            // 2. will behave incorrectly if multiple attributes are in the reaction
            // stack at time of calling. However, since we process attributes
            // in `update` this should not be possible (or an extreme corner case
            // that we'd like to discover).
            // mark state reflecting
            this.__reflectingProperty = name;
            if (attrValue == null) {
                this.removeAttribute(attr);
            }
            else {
                this.setAttribute(attr, attrValue);
            }
            // mark state not reflecting
            this.__reflectingProperty = null;
        }
    }
    /** @internal */
    _$attributeToProperty(name, value) {
        const ctor = this.constructor;
        // Note, hint this as an `AttributeMap` so closure clearly understands
        // the type; it has issues with tracking types through statics
        const propName = ctor.__attributeToPropertyMap.get(name);
        // Use tracking info to avoid reflecting a property value to an attribute
        // if it was just set because the attribute changed.
        if (propName !== undefined && this.__reflectingProperty !== propName) {
            const options = ctor.getPropertyOptions(propName);
            const converter = typeof options.converter === 'function'
                ? { fromAttribute: options.converter }
                : options.converter?.fromAttribute !== undefined
                    ? options.converter
                    : defaultConverter;
            // mark state reflecting
            this.__reflectingProperty = propName;
            const convertedValue = converter.fromAttribute(value, options.type);
            this[propName] =
                convertedValue ??
                    this.__defaultValues?.get(propName) ??
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    convertedValue;
            // mark state not reflecting
            this.__reflectingProperty = null;
        }
    }
    /**
     * Requests an update which is processed asynchronously. This should be called
     * when an element should update based on some state not triggered by setting
     * a reactive property. In this case, pass no arguments. It should also be
     * called when manually implementing a property setter. In this case, pass the
     * property `name` and `oldValue` to ensure that any configured property
     * options are honored.
     *
     * @param name name of requesting property
     * @param oldValue old value of requesting property
     * @param options property options to use instead of the previously
     *     configured options
     * @param useNewValue if true, the newValue argument is used instead of
     *     reading the property value. This is important to use if the reactive
     *     property is a standard private accessor, as opposed to a plain
     *     property, since private members can't be dynamically read by name.
     * @param newValue the new value of the property. This is only used if
     *     `useNewValue` is true.
     * @category updates
     */
    requestUpdate(name, oldValue, options, useNewValue = false, newValue) {
        // If we have a property key, perform property update steps.
        if (name !== undefined) {
            if (DEV_MODE && name instanceof Event) {
                issueWarning(``, `The requestUpdate() method was called with an Event as the property name. This is probably a mistake caused by binding this.requestUpdate as an event listener. Instead bind a function that will call it with no arguments: () => this.requestUpdate()`);
            }
            const ctor = this.constructor;
            if (useNewValue === false) {
                newValue = this[name];
            }
            options ??= ctor.getPropertyOptions(name);
            const changed = (options.hasChanged ?? notEqual)(newValue, oldValue) ||
                // When there is no change, check a corner case that can occur when
                // 1. there's a initial value which was not reflected
                // 2. the property is subsequently set to this value.
                // For example, `prop: {useDefault: true, reflect: true}`
                // and el.prop = 'foo'. This should be considered a change if the
                // attribute is not set because we will now reflect the property to the attribute.
                (options.useDefault &&
                    options.reflect &&
                    newValue === this.__defaultValues?.get(name) &&
                    !this.hasAttribute(ctor.__attributeNameForProperty(name, options)));
            if (changed) {
                this._$changeProperty(name, oldValue, options);
            }
            else {
                // Abort the request if the property should not be considered changed.
                return;
            }
        }
        if (this.isUpdatePending === false) {
            this.__updatePromise = this.__enqueueUpdate();
        }
    }
    /**
     * @internal
     */
    _$changeProperty(name, oldValue, { useDefault, reflect, wrapped }, initializeValue) {
        // Record default value when useDefault is used. This allows us to
        // restore this value when the attribute is removed.
        if (useDefault && !(this.__defaultValues ??= new Map()).has(name)) {
            this.__defaultValues.set(name, initializeValue ?? oldValue ?? this[name]);
            // if this is not wrapping an accessor, it must be an initial setting
            // and in this case we do not want to record the change or reflect.
            if (wrapped !== true || initializeValue !== undefined) {
                return;
            }
        }
        // TODO (justinfagnani): Create a benchmark of Map.has() + Map.set(
        // vs just Map.set()
        if (!this._$changedProperties.has(name)) {
            // On the initial change, the old value should be `undefined`, except
            // with `useDefault`
            if (!this.hasUpdated && !useDefault) {
                oldValue = undefined;
            }
            this._$changedProperties.set(name, oldValue);
        }
        // Add to reflecting properties set.
        // Note, it's important that every change has a chance to add the
        // property to `__reflectingProperties`. This ensures setting
        // attribute + property reflects correctly.
        if (reflect === true && this.__reflectingProperty !== name) {
            (this.__reflectingProperties ??= new Set()).add(name);
        }
    }
    /**
     * Sets up the element to asynchronously update.
     */
    async __enqueueUpdate() {
        this.isUpdatePending = true;
        try {
            // Ensure any previous update has resolved before updating.
            // This `await` also ensures that property changes are batched.
            await this.__updatePromise;
        }
        catch (e) {
            // Refire any previous errors async so they do not disrupt the update
            // cycle. Errors are refired so developers have a chance to observe
            // them, and this can be done by implementing
            // `window.onunhandledrejection`.
            Promise.reject(e);
        }
        const result = this.scheduleUpdate();
        // If `scheduleUpdate` returns a Promise, we await it. This is done to
        // enable coordinating updates with a scheduler. Note, the result is
        // checked to avoid delaying an additional microtask unless we need to.
        if (result != null) {
            await result;
        }
        return !this.isUpdatePending;
    }
    /**
     * Schedules an element update. You can override this method to change the
     * timing of updates by returning a Promise. The update will await the
     * returned Promise, and you should resolve the Promise to allow the update
     * to proceed. If this method is overridden, `super.scheduleUpdate()`
     * must be called.
     *
     * For instance, to schedule updates to occur just before the next frame:
     *
     * ```ts
     * override protected async scheduleUpdate(): Promise<unknown> {
     *   await new Promise((resolve) => requestAnimationFrame(() => resolve()));
     *   super.scheduleUpdate();
     * }
     * ```
     * @category updates
     */
    scheduleUpdate() {
        const result = this.performUpdate();
        if (DEV_MODE &&
            this.constructor.enabledWarnings.includes('async-perform-update') &&
            typeof result?.then ===
                'function') {
            issueWarning('async-perform-update', `Element ${this.localName} returned a Promise from performUpdate(). ` +
                `This behavior is deprecated and will be removed in a future ` +
                `version of ReactiveElement.`);
        }
        return result;
    }
    /**
     * Performs an element update. Note, if an exception is thrown during the
     * update, `firstUpdated` and `updated` will not be called.
     *
     * Call `performUpdate()` to immediately process a pending update. This should
     * generally not be needed, but it can be done in rare cases when you need to
     * update synchronously.
     *
     * @category updates
     */
    performUpdate() {
        // Abort any update if one is not pending when this is called.
        // This can happen if `performUpdate` is called early to "flush"
        // the update.
        if (!this.isUpdatePending) {
            return;
        }
        debugLogEvent?.({ kind: 'update' });
        if (!this.hasUpdated) {
            // Create renderRoot before first update. This occurs in `connectedCallback`
            // but is done here to support out of tree calls to `enableUpdating`/`performUpdate`.
            this.renderRoot ??=
                this.createRenderRoot();
            if (DEV_MODE) {
                // Produce warning if any reactive properties on the prototype are
                // shadowed by class fields. Instance fields set before upgrade are
                // deleted by this point, so any own property is caused by class field
                // initialization in the constructor.
                const ctor = this.constructor;
                const shadowedProperties = [...ctor.elementProperties.keys()].filter((p) => this.hasOwnProperty(p) && p in getPrototypeOf(this));
                if (shadowedProperties.length) {
                    throw new Error(`The following properties on element ${this.localName} will not ` +
                        `trigger updates as expected because they are set using class ` +
                        `fields: ${shadowedProperties.join(', ')}. ` +
                        `Native class fields and some compiled output will overwrite ` +
                        `accessors used for detecting changes. See ` +
                        `https://lit.dev/msg/class-field-shadowing ` +
                        `for more information.`);
                }
            }
            // Mixin instance properties once, if they exist.
            if (this.__instanceProperties) {
                // TODO (justinfagnani): should we use the stored value? Could a new value
                // have been set since we stored the own property value?
                for (const [p, value] of this.__instanceProperties) {
                    this[p] = value;
                }
                this.__instanceProperties = undefined;
            }
            // Trigger initial value reflection and populate the initial
            // `changedProperties` map, but only for the case of properties created
            // via `createProperty` on accessors, which will not have already
            // populated the `changedProperties` map since they are not set.
            // We can't know if these accessors had initializers, so we just set
            // them anyway - a difference from experimental decorators on fields and
            // standard decorators on auto-accessors.
            // For context see:
            // https://github.com/lit/lit/pull/4183#issuecomment-1711959635
            const elementProperties = this.constructor
                .elementProperties;
            if (elementProperties.size > 0) {
                for (const [p, options] of elementProperties) {
                    const { wrapped } = options;
                    const value = this[p];
                    if (wrapped === true &&
                        !this._$changedProperties.has(p) &&
                        value !== undefined) {
                        this._$changeProperty(p, undefined, options, value);
                    }
                }
            }
        }
        let shouldUpdate = false;
        const changedProperties = this._$changedProperties;
        try {
            shouldUpdate = this.shouldUpdate(changedProperties);
            if (shouldUpdate) {
                this.willUpdate(changedProperties);
                this.__controllers?.forEach((c) => c.hostUpdate?.());
                this.update(changedProperties);
            }
            else {
                this.__markUpdated();
            }
        }
        catch (e) {
            // Prevent `firstUpdated` and `updated` from running when there's an
            // update exception.
            shouldUpdate = false;
            // Ensure element can accept additional updates after an exception.
            this.__markUpdated();
            throw e;
        }
        // The update is no longer considered pending and further updates are now allowed.
        if (shouldUpdate) {
            this._$didUpdate(changedProperties);
        }
    }
    /**
     * Invoked before `update()` to compute values needed during the update.
     *
     * Implement `willUpdate` to compute property values that depend on other
     * properties and are used in the rest of the update process.
     *
     * ```ts
     * willUpdate(changedProperties) {
     *   // only need to check changed properties for an expensive computation.
     *   if (changedProperties.has('firstName') || changedProperties.has('lastName')) {
     *     this.sha = computeSHA(`${this.firstName} ${this.lastName}`);
     *   }
     * }
     *
     * render() {
     *   return html`SHA: ${this.sha}`;
     * }
     * ```
     *
     * @category updates
     */
    willUpdate(_changedProperties) { }
    // Note, this is an override point for polyfill-support.
    // @internal
    _$didUpdate(changedProperties) {
        this.__controllers?.forEach((c) => c.hostUpdated?.());
        if (!this.hasUpdated) {
            this.hasUpdated = true;
            this.firstUpdated(changedProperties);
        }
        this.updated(changedProperties);
        if (DEV_MODE &&
            this.isUpdatePending &&
            this.constructor.enabledWarnings.includes('change-in-update')) {
            issueWarning('change-in-update', `Element ${this.localName} scheduled an update ` +
                `(generally because a property was set) ` +
                `after an update completed, causing a new update to be scheduled. ` +
                `This is inefficient and should be avoided unless the next update ` +
                `can only be scheduled as a side effect of the previous update.`);
        }
    }
    __markUpdated() {
        this._$changedProperties = new Map();
        this.isUpdatePending = false;
    }
    /**
     * Returns a Promise that resolves when the element has completed updating.
     * The Promise value is a boolean that is `true` if the element completed the
     * update without triggering another update. The Promise result is `false` if
     * a property was set inside `updated()`. If the Promise is rejected, an
     * exception was thrown during the update.
     *
     * To await additional asynchronous work, override the `getUpdateComplete`
     * method. For example, it is sometimes useful to await a rendered element
     * before fulfilling this Promise. To do this, first await
     * `super.getUpdateComplete()`, then any subsequent state.
     *
     * @return A promise of a boolean that resolves to true if the update completed
     *     without triggering another update.
     * @category updates
     */
    get updateComplete() {
        return this.getUpdateComplete();
    }
    /**
     * Override point for the `updateComplete` promise.
     *
     * It is not safe to override the `updateComplete` getter directly due to a
     * limitation in TypeScript which means it is not possible to call a
     * superclass getter (e.g. `super.updateComplete.then(...)`) when the target
     * language is ES5 (https://github.com/microsoft/TypeScript/issues/338).
     * This method should be overridden instead. For example:
     *
     * ```ts
     * class MyElement extends LitElement {
     *   override async getUpdateComplete() {
     *     const result = await super.getUpdateComplete();
     *     await this._myChild.updateComplete;
     *     return result;
     *   }
     * }
     * ```
     *
     * @return A promise of a boolean that resolves to true if the update completed
     *     without triggering another update.
     * @category updates
     */
    getUpdateComplete() {
        return this.__updatePromise;
    }
    /**
     * Controls whether or not `update()` should be called when the element requests
     * an update. By default, this method always returns `true`, but this can be
     * customized to control when to update.
     *
     * @param _changedProperties Map of changed properties with old values
     * @category updates
     */
    shouldUpdate(_changedProperties) {
        return true;
    }
    /**
     * Updates the element. This method reflects property values to attributes.
     * It can be overridden to render and keep updated element DOM.
     * Setting properties inside this method will *not* trigger
     * another update.
     *
     * @param _changedProperties Map of changed properties with old values
     * @category updates
     */
    update(_changedProperties) {
        // The forEach() expression will only run when __reflectingProperties is
        // defined, and it returns undefined, setting __reflectingProperties to
        // undefined
        this.__reflectingProperties &&= this.__reflectingProperties.forEach((p) => this.__propertyToAttribute(p, this[p]));
        this.__markUpdated();
    }
    /**
     * Invoked whenever the element is updated. Implement to perform
     * post-updating tasks via DOM APIs, for example, focusing an element.
     *
     * Setting properties inside this method will trigger the element to update
     * again after this update cycle completes.
     *
     * @param _changedProperties Map of changed properties with old values
     * @category updates
     */
    updated(_changedProperties) { }
    /**
     * Invoked when the element is first updated. Implement to perform one time
     * work on the element after update.
     *
     * ```ts
     * firstUpdated() {
     *   this.renderRoot.getElementById('my-text-area').focus();
     * }
     * ```
     *
     * Setting properties inside this method will trigger the element to update
     * again after this update cycle completes.
     *
     * @param _changedProperties Map of changed properties with old values
     * @category updates
     */
    firstUpdated(_changedProperties) { }
}
/**
 * Memoized list of all element styles.
 * Created lazily on user subclasses when finalizing the class.
 * @nocollapse
 * @category styles
 */
ReactiveElement.elementStyles = [];
/**
 * Options used when calling `attachShadow`. Set this property to customize
 * the options for the shadowRoot; for example, to create a closed
 * shadowRoot: `{mode: 'closed'}`.
 *
 * Note, these options are used in `createRenderRoot`. If this method
 * is customized, options should be respected if possible.
 * @nocollapse
 * @category rendering
 */
ReactiveElement.shadowRootOptions = { mode: 'open' };
// Assigned here to work around a jscompiler bug with static fields
// when compiling to ES5.
// https://github.com/google/closure-compiler/issues/3177
ReactiveElement[JSCompiler_renameProperty('elementProperties', ReactiveElement)] = new Map();
ReactiveElement[JSCompiler_renameProperty('finalized', ReactiveElement)] = new Map();
// Apply polyfills if available
polyfillSupport?.({ ReactiveElement });
// Dev mode warnings...
if (DEV_MODE) {
    // Default warning set.
    ReactiveElement.enabledWarnings = [
        'change-in-update',
        'async-perform-update',
    ];
    const ensureOwnWarnings = function (ctor) {
        if (!ctor.hasOwnProperty(JSCompiler_renameProperty('enabledWarnings', ctor))) {
            ctor.enabledWarnings = ctor.enabledWarnings.slice();
        }
    };
    ReactiveElement.enableWarning = function (warning) {
        ensureOwnWarnings(this);
        if (!this.enabledWarnings.includes(warning)) {
            this.enabledWarnings.push(warning);
        }
    };
    ReactiveElement.disableWarning = function (warning) {
        ensureOwnWarnings(this);
        const i = this.enabledWarnings.indexOf(warning);
        if (i >= 0) {
            this.enabledWarnings.splice(i, 1);
        }
    };
}
// IMPORTANT: do not change the property name or the assignment expression.
// This line will be used in regexes to search for ReactiveElement usage.
(global.reactiveElementVersions ??= []).push('2.1.2');
if (DEV_MODE && global.reactiveElementVersions.length > 1) {
    queueMicrotask(() => {
        issueWarning('multiple-versions', `Multiple versions of Lit loaded. Loading multiple versions ` +
            `is not recommended.`);
    });
}
//# sourceMappingURL=reactive-element.js.map

/***/ },

/***/ "./node_modules/js-yaml/dist/js-yaml.mjs"
/*!***********************************************!*\
  !*** ./node_modules/js-yaml/dist/js-yaml.mjs ***!
  \***********************************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   CORE_SCHEMA: () => (/* binding */ CORE_SCHEMA),
/* harmony export */   DEFAULT_SCHEMA: () => (/* binding */ DEFAULT_SCHEMA),
/* harmony export */   FAILSAFE_SCHEMA: () => (/* binding */ FAILSAFE_SCHEMA),
/* harmony export */   JSON_SCHEMA: () => (/* binding */ JSON_SCHEMA),
/* harmony export */   Schema: () => (/* binding */ Schema),
/* harmony export */   Type: () => (/* binding */ Type),
/* harmony export */   YAMLException: () => (/* binding */ YAMLException),
/* harmony export */   "default": () => (/* binding */ jsYaml),
/* harmony export */   dump: () => (/* binding */ dump),
/* harmony export */   load: () => (/* binding */ load),
/* harmony export */   loadAll: () => (/* binding */ loadAll),
/* harmony export */   safeDump: () => (/* binding */ safeDump),
/* harmony export */   safeLoad: () => (/* binding */ safeLoad),
/* harmony export */   safeLoadAll: () => (/* binding */ safeLoadAll),
/* harmony export */   types: () => (/* binding */ types)
/* harmony export */ });

/*! js-yaml 4.1.1 https://github.com/nodeca/js-yaml @license MIT */
function isNothing(subject) {
  return (typeof subject === 'undefined') || (subject === null);
}


function isObject(subject) {
  return (typeof subject === 'object') && (subject !== null);
}


function toArray(sequence) {
  if (Array.isArray(sequence)) return sequence;
  else if (isNothing(sequence)) return [];

  return [ sequence ];
}


function extend(target, source) {
  var index, length, key, sourceKeys;

  if (source) {
    sourceKeys = Object.keys(source);

    for (index = 0, length = sourceKeys.length; index < length; index += 1) {
      key = sourceKeys[index];
      target[key] = source[key];
    }
  }

  return target;
}


function repeat(string, count) {
  var result = '', cycle;

  for (cycle = 0; cycle < count; cycle += 1) {
    result += string;
  }

  return result;
}


function isNegativeZero(number) {
  return (number === 0) && (Number.NEGATIVE_INFINITY === 1 / number);
}


var isNothing_1      = isNothing;
var isObject_1       = isObject;
var toArray_1        = toArray;
var repeat_1         = repeat;
var isNegativeZero_1 = isNegativeZero;
var extend_1         = extend;

var common = {
	isNothing: isNothing_1,
	isObject: isObject_1,
	toArray: toArray_1,
	repeat: repeat_1,
	isNegativeZero: isNegativeZero_1,
	extend: extend_1
};

// YAML error class. http://stackoverflow.com/questions/8458984


function formatError(exception, compact) {
  var where = '', message = exception.reason || '(unknown reason)';

  if (!exception.mark) return message;

  if (exception.mark.name) {
    where += 'in "' + exception.mark.name + '" ';
  }

  where += '(' + (exception.mark.line + 1) + ':' + (exception.mark.column + 1) + ')';

  if (!compact && exception.mark.snippet) {
    where += '\n\n' + exception.mark.snippet;
  }

  return message + ' ' + where;
}


function YAMLException$1(reason, mark) {
  // Super constructor
  Error.call(this);

  this.name = 'YAMLException';
  this.reason = reason;
  this.mark = mark;
  this.message = formatError(this, false);

  // Include stack trace in error object
  if (Error.captureStackTrace) {
    // Chrome and NodeJS
    Error.captureStackTrace(this, this.constructor);
  } else {
    // FF, IE 10+ and Safari 6+. Fallback for others
    this.stack = (new Error()).stack || '';
  }
}


// Inherit from Error
YAMLException$1.prototype = Object.create(Error.prototype);
YAMLException$1.prototype.constructor = YAMLException$1;


YAMLException$1.prototype.toString = function toString(compact) {
  return this.name + ': ' + formatError(this, compact);
};


var exception = YAMLException$1;

// get snippet for a single line, respecting maxLength
function getLine(buffer, lineStart, lineEnd, position, maxLineLength) {
  var head = '';
  var tail = '';
  var maxHalfLength = Math.floor(maxLineLength / 2) - 1;

  if (position - lineStart > maxHalfLength) {
    head = ' ... ';
    lineStart = position - maxHalfLength + head.length;
  }

  if (lineEnd - position > maxHalfLength) {
    tail = ' ...';
    lineEnd = position + maxHalfLength - tail.length;
  }

  return {
    str: head + buffer.slice(lineStart, lineEnd).replace(/\t/g, '→') + tail,
    pos: position - lineStart + head.length // relative position
  };
}


function padStart(string, max) {
  return common.repeat(' ', max - string.length) + string;
}


function makeSnippet(mark, options) {
  options = Object.create(options || null);

  if (!mark.buffer) return null;

  if (!options.maxLength) options.maxLength = 79;
  if (typeof options.indent      !== 'number') options.indent      = 1;
  if (typeof options.linesBefore !== 'number') options.linesBefore = 3;
  if (typeof options.linesAfter  !== 'number') options.linesAfter  = 2;

  var re = /\r?\n|\r|\0/g;
  var lineStarts = [ 0 ];
  var lineEnds = [];
  var match;
  var foundLineNo = -1;

  while ((match = re.exec(mark.buffer))) {
    lineEnds.push(match.index);
    lineStarts.push(match.index + match[0].length);

    if (mark.position <= match.index && foundLineNo < 0) {
      foundLineNo = lineStarts.length - 2;
    }
  }

  if (foundLineNo < 0) foundLineNo = lineStarts.length - 1;

  var result = '', i, line;
  var lineNoLength = Math.min(mark.line + options.linesAfter, lineEnds.length).toString().length;
  var maxLineLength = options.maxLength - (options.indent + lineNoLength + 3);

  for (i = 1; i <= options.linesBefore; i++) {
    if (foundLineNo - i < 0) break;
    line = getLine(
      mark.buffer,
      lineStarts[foundLineNo - i],
      lineEnds[foundLineNo - i],
      mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo - i]),
      maxLineLength
    );
    result = common.repeat(' ', options.indent) + padStart((mark.line - i + 1).toString(), lineNoLength) +
      ' | ' + line.str + '\n' + result;
  }

  line = getLine(mark.buffer, lineStarts[foundLineNo], lineEnds[foundLineNo], mark.position, maxLineLength);
  result += common.repeat(' ', options.indent) + padStart((mark.line + 1).toString(), lineNoLength) +
    ' | ' + line.str + '\n';
  result += common.repeat('-', options.indent + lineNoLength + 3 + line.pos) + '^' + '\n';

  for (i = 1; i <= options.linesAfter; i++) {
    if (foundLineNo + i >= lineEnds.length) break;
    line = getLine(
      mark.buffer,
      lineStarts[foundLineNo + i],
      lineEnds[foundLineNo + i],
      mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo + i]),
      maxLineLength
    );
    result += common.repeat(' ', options.indent) + padStart((mark.line + i + 1).toString(), lineNoLength) +
      ' | ' + line.str + '\n';
  }

  return result.replace(/\n$/, '');
}


var snippet = makeSnippet;

var TYPE_CONSTRUCTOR_OPTIONS = [
  'kind',
  'multi',
  'resolve',
  'construct',
  'instanceOf',
  'predicate',
  'represent',
  'representName',
  'defaultStyle',
  'styleAliases'
];

var YAML_NODE_KINDS = [
  'scalar',
  'sequence',
  'mapping'
];

function compileStyleAliases(map) {
  var result = {};

  if (map !== null) {
    Object.keys(map).forEach(function (style) {
      map[style].forEach(function (alias) {
        result[String(alias)] = style;
      });
    });
  }

  return result;
}

function Type$1(tag, options) {
  options = options || {};

  Object.keys(options).forEach(function (name) {
    if (TYPE_CONSTRUCTOR_OPTIONS.indexOf(name) === -1) {
      throw new exception('Unknown option "' + name + '" is met in definition of "' + tag + '" YAML type.');
    }
  });

  // TODO: Add tag format check.
  this.options       = options; // keep original options in case user wants to extend this type later
  this.tag           = tag;
  this.kind          = options['kind']          || null;
  this.resolve       = options['resolve']       || function () { return true; };
  this.construct     = options['construct']     || function (data) { return data; };
  this.instanceOf    = options['instanceOf']    || null;
  this.predicate     = options['predicate']     || null;
  this.represent     = options['represent']     || null;
  this.representName = options['representName'] || null;
  this.defaultStyle  = options['defaultStyle']  || null;
  this.multi         = options['multi']         || false;
  this.styleAliases  = compileStyleAliases(options['styleAliases'] || null);

  if (YAML_NODE_KINDS.indexOf(this.kind) === -1) {
    throw new exception('Unknown kind "' + this.kind + '" is specified for "' + tag + '" YAML type.');
  }
}

var type = Type$1;

/*eslint-disable max-len*/





function compileList(schema, name) {
  var result = [];

  schema[name].forEach(function (currentType) {
    var newIndex = result.length;

    result.forEach(function (previousType, previousIndex) {
      if (previousType.tag === currentType.tag &&
          previousType.kind === currentType.kind &&
          previousType.multi === currentType.multi) {

        newIndex = previousIndex;
      }
    });

    result[newIndex] = currentType;
  });

  return result;
}


function compileMap(/* lists... */) {
  var result = {
        scalar: {},
        sequence: {},
        mapping: {},
        fallback: {},
        multi: {
          scalar: [],
          sequence: [],
          mapping: [],
          fallback: []
        }
      }, index, length;

  function collectType(type) {
    if (type.multi) {
      result.multi[type.kind].push(type);
      result.multi['fallback'].push(type);
    } else {
      result[type.kind][type.tag] = result['fallback'][type.tag] = type;
    }
  }

  for (index = 0, length = arguments.length; index < length; index += 1) {
    arguments[index].forEach(collectType);
  }
  return result;
}


function Schema$1(definition) {
  return this.extend(definition);
}


Schema$1.prototype.extend = function extend(definition) {
  var implicit = [];
  var explicit = [];

  if (definition instanceof type) {
    // Schema.extend(type)
    explicit.push(definition);

  } else if (Array.isArray(definition)) {
    // Schema.extend([ type1, type2, ... ])
    explicit = explicit.concat(definition);

  } else if (definition && (Array.isArray(definition.implicit) || Array.isArray(definition.explicit))) {
    // Schema.extend({ explicit: [ type1, type2, ... ], implicit: [ type1, type2, ... ] })
    if (definition.implicit) implicit = implicit.concat(definition.implicit);
    if (definition.explicit) explicit = explicit.concat(definition.explicit);

  } else {
    throw new exception('Schema.extend argument should be a Type, [ Type ], ' +
      'or a schema definition ({ implicit: [...], explicit: [...] })');
  }

  implicit.forEach(function (type$1) {
    if (!(type$1 instanceof type)) {
      throw new exception('Specified list of YAML types (or a single Type object) contains a non-Type object.');
    }

    if (type$1.loadKind && type$1.loadKind !== 'scalar') {
      throw new exception('There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.');
    }

    if (type$1.multi) {
      throw new exception('There is a multi type in the implicit list of a schema. Multi tags can only be listed as explicit.');
    }
  });

  explicit.forEach(function (type$1) {
    if (!(type$1 instanceof type)) {
      throw new exception('Specified list of YAML types (or a single Type object) contains a non-Type object.');
    }
  });

  var result = Object.create(Schema$1.prototype);

  result.implicit = (this.implicit || []).concat(implicit);
  result.explicit = (this.explicit || []).concat(explicit);

  result.compiledImplicit = compileList(result, 'implicit');
  result.compiledExplicit = compileList(result, 'explicit');
  result.compiledTypeMap  = compileMap(result.compiledImplicit, result.compiledExplicit);

  return result;
};


var schema = Schema$1;

var str = new type('tag:yaml.org,2002:str', {
  kind: 'scalar',
  construct: function (data) { return data !== null ? data : ''; }
});

var seq = new type('tag:yaml.org,2002:seq', {
  kind: 'sequence',
  construct: function (data) { return data !== null ? data : []; }
});

var map = new type('tag:yaml.org,2002:map', {
  kind: 'mapping',
  construct: function (data) { return data !== null ? data : {}; }
});

var failsafe = new schema({
  explicit: [
    str,
    seq,
    map
  ]
});

function resolveYamlNull(data) {
  if (data === null) return true;

  var max = data.length;

  return (max === 1 && data === '~') ||
         (max === 4 && (data === 'null' || data === 'Null' || data === 'NULL'));
}

function constructYamlNull() {
  return null;
}

function isNull(object) {
  return object === null;
}

var _null = new type('tag:yaml.org,2002:null', {
  kind: 'scalar',
  resolve: resolveYamlNull,
  construct: constructYamlNull,
  predicate: isNull,
  represent: {
    canonical: function () { return '~';    },
    lowercase: function () { return 'null'; },
    uppercase: function () { return 'NULL'; },
    camelcase: function () { return 'Null'; },
    empty:     function () { return '';     }
  },
  defaultStyle: 'lowercase'
});

function resolveYamlBoolean(data) {
  if (data === null) return false;

  var max = data.length;

  return (max === 4 && (data === 'true' || data === 'True' || data === 'TRUE')) ||
         (max === 5 && (data === 'false' || data === 'False' || data === 'FALSE'));
}

function constructYamlBoolean(data) {
  return data === 'true' ||
         data === 'True' ||
         data === 'TRUE';
}

function isBoolean(object) {
  return Object.prototype.toString.call(object) === '[object Boolean]';
}

var bool = new type('tag:yaml.org,2002:bool', {
  kind: 'scalar',
  resolve: resolveYamlBoolean,
  construct: constructYamlBoolean,
  predicate: isBoolean,
  represent: {
    lowercase: function (object) { return object ? 'true' : 'false'; },
    uppercase: function (object) { return object ? 'TRUE' : 'FALSE'; },
    camelcase: function (object) { return object ? 'True' : 'False'; }
  },
  defaultStyle: 'lowercase'
});

function isHexCode(c) {
  return ((0x30/* 0 */ <= c) && (c <= 0x39/* 9 */)) ||
         ((0x41/* A */ <= c) && (c <= 0x46/* F */)) ||
         ((0x61/* a */ <= c) && (c <= 0x66/* f */));
}

function isOctCode(c) {
  return ((0x30/* 0 */ <= c) && (c <= 0x37/* 7 */));
}

function isDecCode(c) {
  return ((0x30/* 0 */ <= c) && (c <= 0x39/* 9 */));
}

function resolveYamlInteger(data) {
  if (data === null) return false;

  var max = data.length,
      index = 0,
      hasDigits = false,
      ch;

  if (!max) return false;

  ch = data[index];

  // sign
  if (ch === '-' || ch === '+') {
    ch = data[++index];
  }

  if (ch === '0') {
    // 0
    if (index + 1 === max) return true;
    ch = data[++index];

    // base 2, base 8, base 16

    if (ch === 'b') {
      // base 2
      index++;

      for (; index < max; index++) {
        ch = data[index];
        if (ch === '_') continue;
        if (ch !== '0' && ch !== '1') return false;
        hasDigits = true;
      }
      return hasDigits && ch !== '_';
    }


    if (ch === 'x') {
      // base 16
      index++;

      for (; index < max; index++) {
        ch = data[index];
        if (ch === '_') continue;
        if (!isHexCode(data.charCodeAt(index))) return false;
        hasDigits = true;
      }
      return hasDigits && ch !== '_';
    }


    if (ch === 'o') {
      // base 8
      index++;

      for (; index < max; index++) {
        ch = data[index];
        if (ch === '_') continue;
        if (!isOctCode(data.charCodeAt(index))) return false;
        hasDigits = true;
      }
      return hasDigits && ch !== '_';
    }
  }

  // base 10 (except 0)

  // value should not start with `_`;
  if (ch === '_') return false;

  for (; index < max; index++) {
    ch = data[index];
    if (ch === '_') continue;
    if (!isDecCode(data.charCodeAt(index))) {
      return false;
    }
    hasDigits = true;
  }

  // Should have digits and should not end with `_`
  if (!hasDigits || ch === '_') return false;

  return true;
}

function constructYamlInteger(data) {
  var value = data, sign = 1, ch;

  if (value.indexOf('_') !== -1) {
    value = value.replace(/_/g, '');
  }

  ch = value[0];

  if (ch === '-' || ch === '+') {
    if (ch === '-') sign = -1;
    value = value.slice(1);
    ch = value[0];
  }

  if (value === '0') return 0;

  if (ch === '0') {
    if (value[1] === 'b') return sign * parseInt(value.slice(2), 2);
    if (value[1] === 'x') return sign * parseInt(value.slice(2), 16);
    if (value[1] === 'o') return sign * parseInt(value.slice(2), 8);
  }

  return sign * parseInt(value, 10);
}

function isInteger(object) {
  return (Object.prototype.toString.call(object)) === '[object Number]' &&
         (object % 1 === 0 && !common.isNegativeZero(object));
}

var int = new type('tag:yaml.org,2002:int', {
  kind: 'scalar',
  resolve: resolveYamlInteger,
  construct: constructYamlInteger,
  predicate: isInteger,
  represent: {
    binary:      function (obj) { return obj >= 0 ? '0b' + obj.toString(2) : '-0b' + obj.toString(2).slice(1); },
    octal:       function (obj) { return obj >= 0 ? '0o'  + obj.toString(8) : '-0o'  + obj.toString(8).slice(1); },
    decimal:     function (obj) { return obj.toString(10); },
    /* eslint-disable max-len */
    hexadecimal: function (obj) { return obj >= 0 ? '0x' + obj.toString(16).toUpperCase() :  '-0x' + obj.toString(16).toUpperCase().slice(1); }
  },
  defaultStyle: 'decimal',
  styleAliases: {
    binary:      [ 2,  'bin' ],
    octal:       [ 8,  'oct' ],
    decimal:     [ 10, 'dec' ],
    hexadecimal: [ 16, 'hex' ]
  }
});

var YAML_FLOAT_PATTERN = new RegExp(
  // 2.5e4, 2.5 and integers
  '^(?:[-+]?(?:[0-9][0-9_]*)(?:\\.[0-9_]*)?(?:[eE][-+]?[0-9]+)?' +
  // .2e4, .2
  // special case, seems not from spec
  '|\\.[0-9_]+(?:[eE][-+]?[0-9]+)?' +
  // .inf
  '|[-+]?\\.(?:inf|Inf|INF)' +
  // .nan
  '|\\.(?:nan|NaN|NAN))$');

function resolveYamlFloat(data) {
  if (data === null) return false;

  if (!YAML_FLOAT_PATTERN.test(data) ||
      // Quick hack to not allow integers end with `_`
      // Probably should update regexp & check speed
      data[data.length - 1] === '_') {
    return false;
  }

  return true;
}

function constructYamlFloat(data) {
  var value, sign;

  value  = data.replace(/_/g, '').toLowerCase();
  sign   = value[0] === '-' ? -1 : 1;

  if ('+-'.indexOf(value[0]) >= 0) {
    value = value.slice(1);
  }

  if (value === '.inf') {
    return (sign === 1) ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;

  } else if (value === '.nan') {
    return NaN;
  }
  return sign * parseFloat(value, 10);
}


var SCIENTIFIC_WITHOUT_DOT = /^[-+]?[0-9]+e/;

function representYamlFloat(object, style) {
  var res;

  if (isNaN(object)) {
    switch (style) {
      case 'lowercase': return '.nan';
      case 'uppercase': return '.NAN';
      case 'camelcase': return '.NaN';
    }
  } else if (Number.POSITIVE_INFINITY === object) {
    switch (style) {
      case 'lowercase': return '.inf';
      case 'uppercase': return '.INF';
      case 'camelcase': return '.Inf';
    }
  } else if (Number.NEGATIVE_INFINITY === object) {
    switch (style) {
      case 'lowercase': return '-.inf';
      case 'uppercase': return '-.INF';
      case 'camelcase': return '-.Inf';
    }
  } else if (common.isNegativeZero(object)) {
    return '-0.0';
  }

  res = object.toString(10);

  // JS stringifier can build scientific format without dots: 5e-100,
  // while YAML requres dot: 5.e-100. Fix it with simple hack

  return SCIENTIFIC_WITHOUT_DOT.test(res) ? res.replace('e', '.e') : res;
}

function isFloat(object) {
  return (Object.prototype.toString.call(object) === '[object Number]') &&
         (object % 1 !== 0 || common.isNegativeZero(object));
}

var float = new type('tag:yaml.org,2002:float', {
  kind: 'scalar',
  resolve: resolveYamlFloat,
  construct: constructYamlFloat,
  predicate: isFloat,
  represent: representYamlFloat,
  defaultStyle: 'lowercase'
});

var json = failsafe.extend({
  implicit: [
    _null,
    bool,
    int,
    float
  ]
});

var core = json;

var YAML_DATE_REGEXP = new RegExp(
  '^([0-9][0-9][0-9][0-9])'          + // [1] year
  '-([0-9][0-9])'                    + // [2] month
  '-([0-9][0-9])$');                   // [3] day

var YAML_TIMESTAMP_REGEXP = new RegExp(
  '^([0-9][0-9][0-9][0-9])'          + // [1] year
  '-([0-9][0-9]?)'                   + // [2] month
  '-([0-9][0-9]?)'                   + // [3] day
  '(?:[Tt]|[ \\t]+)'                 + // ...
  '([0-9][0-9]?)'                    + // [4] hour
  ':([0-9][0-9])'                    + // [5] minute
  ':([0-9][0-9])'                    + // [6] second
  '(?:\\.([0-9]*))?'                 + // [7] fraction
  '(?:[ \\t]*(Z|([-+])([0-9][0-9]?)' + // [8] tz [9] tz_sign [10] tz_hour
  '(?::([0-9][0-9]))?))?$');           // [11] tz_minute

function resolveYamlTimestamp(data) {
  if (data === null) return false;
  if (YAML_DATE_REGEXP.exec(data) !== null) return true;
  if (YAML_TIMESTAMP_REGEXP.exec(data) !== null) return true;
  return false;
}

function constructYamlTimestamp(data) {
  var match, year, month, day, hour, minute, second, fraction = 0,
      delta = null, tz_hour, tz_minute, date;

  match = YAML_DATE_REGEXP.exec(data);
  if (match === null) match = YAML_TIMESTAMP_REGEXP.exec(data);

  if (match === null) throw new Error('Date resolve error');

  // match: [1] year [2] month [3] day

  year = +(match[1]);
  month = +(match[2]) - 1; // JS month starts with 0
  day = +(match[3]);

  if (!match[4]) { // no hour
    return new Date(Date.UTC(year, month, day));
  }

  // match: [4] hour [5] minute [6] second [7] fraction

  hour = +(match[4]);
  minute = +(match[5]);
  second = +(match[6]);

  if (match[7]) {
    fraction = match[7].slice(0, 3);
    while (fraction.length < 3) { // milli-seconds
      fraction += '0';
    }
    fraction = +fraction;
  }

  // match: [8] tz [9] tz_sign [10] tz_hour [11] tz_minute

  if (match[9]) {
    tz_hour = +(match[10]);
    tz_minute = +(match[11] || 0);
    delta = (tz_hour * 60 + tz_minute) * 60000; // delta in mili-seconds
    if (match[9] === '-') delta = -delta;
  }

  date = new Date(Date.UTC(year, month, day, hour, minute, second, fraction));

  if (delta) date.setTime(date.getTime() - delta);

  return date;
}

function representYamlTimestamp(object /*, style*/) {
  return object.toISOString();
}

var timestamp = new type('tag:yaml.org,2002:timestamp', {
  kind: 'scalar',
  resolve: resolveYamlTimestamp,
  construct: constructYamlTimestamp,
  instanceOf: Date,
  represent: representYamlTimestamp
});

function resolveYamlMerge(data) {
  return data === '<<' || data === null;
}

var merge = new type('tag:yaml.org,2002:merge', {
  kind: 'scalar',
  resolve: resolveYamlMerge
});

/*eslint-disable no-bitwise*/





// [ 64, 65, 66 ] -> [ padding, CR, LF ]
var BASE64_MAP = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=\n\r';


function resolveYamlBinary(data) {
  if (data === null) return false;

  var code, idx, bitlen = 0, max = data.length, map = BASE64_MAP;

  // Convert one by one.
  for (idx = 0; idx < max; idx++) {
    code = map.indexOf(data.charAt(idx));

    // Skip CR/LF
    if (code > 64) continue;

    // Fail on illegal characters
    if (code < 0) return false;

    bitlen += 6;
  }

  // If there are any bits left, source was corrupted
  return (bitlen % 8) === 0;
}

function constructYamlBinary(data) {
  var idx, tailbits,
      input = data.replace(/[\r\n=]/g, ''), // remove CR/LF & padding to simplify scan
      max = input.length,
      map = BASE64_MAP,
      bits = 0,
      result = [];

  // Collect by 6*4 bits (3 bytes)

  for (idx = 0; idx < max; idx++) {
    if ((idx % 4 === 0) && idx) {
      result.push((bits >> 16) & 0xFF);
      result.push((bits >> 8) & 0xFF);
      result.push(bits & 0xFF);
    }

    bits = (bits << 6) | map.indexOf(input.charAt(idx));
  }

  // Dump tail

  tailbits = (max % 4) * 6;

  if (tailbits === 0) {
    result.push((bits >> 16) & 0xFF);
    result.push((bits >> 8) & 0xFF);
    result.push(bits & 0xFF);
  } else if (tailbits === 18) {
    result.push((bits >> 10) & 0xFF);
    result.push((bits >> 2) & 0xFF);
  } else if (tailbits === 12) {
    result.push((bits >> 4) & 0xFF);
  }

  return new Uint8Array(result);
}

function representYamlBinary(object /*, style*/) {
  var result = '', bits = 0, idx, tail,
      max = object.length,
      map = BASE64_MAP;

  // Convert every three bytes to 4 ASCII characters.

  for (idx = 0; idx < max; idx++) {
    if ((idx % 3 === 0) && idx) {
      result += map[(bits >> 18) & 0x3F];
      result += map[(bits >> 12) & 0x3F];
      result += map[(bits >> 6) & 0x3F];
      result += map[bits & 0x3F];
    }

    bits = (bits << 8) + object[idx];
  }

  // Dump tail

  tail = max % 3;

  if (tail === 0) {
    result += map[(bits >> 18) & 0x3F];
    result += map[(bits >> 12) & 0x3F];
    result += map[(bits >> 6) & 0x3F];
    result += map[bits & 0x3F];
  } else if (tail === 2) {
    result += map[(bits >> 10) & 0x3F];
    result += map[(bits >> 4) & 0x3F];
    result += map[(bits << 2) & 0x3F];
    result += map[64];
  } else if (tail === 1) {
    result += map[(bits >> 2) & 0x3F];
    result += map[(bits << 4) & 0x3F];
    result += map[64];
    result += map[64];
  }

  return result;
}

function isBinary(obj) {
  return Object.prototype.toString.call(obj) ===  '[object Uint8Array]';
}

var binary = new type('tag:yaml.org,2002:binary', {
  kind: 'scalar',
  resolve: resolveYamlBinary,
  construct: constructYamlBinary,
  predicate: isBinary,
  represent: representYamlBinary
});

var _hasOwnProperty$3 = Object.prototype.hasOwnProperty;
var _toString$2       = Object.prototype.toString;

function resolveYamlOmap(data) {
  if (data === null) return true;

  var objectKeys = [], index, length, pair, pairKey, pairHasKey,
      object = data;

  for (index = 0, length = object.length; index < length; index += 1) {
    pair = object[index];
    pairHasKey = false;

    if (_toString$2.call(pair) !== '[object Object]') return false;

    for (pairKey in pair) {
      if (_hasOwnProperty$3.call(pair, pairKey)) {
        if (!pairHasKey) pairHasKey = true;
        else return false;
      }
    }

    if (!pairHasKey) return false;

    if (objectKeys.indexOf(pairKey) === -1) objectKeys.push(pairKey);
    else return false;
  }

  return true;
}

function constructYamlOmap(data) {
  return data !== null ? data : [];
}

var omap = new type('tag:yaml.org,2002:omap', {
  kind: 'sequence',
  resolve: resolveYamlOmap,
  construct: constructYamlOmap
});

var _toString$1 = Object.prototype.toString;

function resolveYamlPairs(data) {
  if (data === null) return true;

  var index, length, pair, keys, result,
      object = data;

  result = new Array(object.length);

  for (index = 0, length = object.length; index < length; index += 1) {
    pair = object[index];

    if (_toString$1.call(pair) !== '[object Object]') return false;

    keys = Object.keys(pair);

    if (keys.length !== 1) return false;

    result[index] = [ keys[0], pair[keys[0]] ];
  }

  return true;
}

function constructYamlPairs(data) {
  if (data === null) return [];

  var index, length, pair, keys, result,
      object = data;

  result = new Array(object.length);

  for (index = 0, length = object.length; index < length; index += 1) {
    pair = object[index];

    keys = Object.keys(pair);

    result[index] = [ keys[0], pair[keys[0]] ];
  }

  return result;
}

var pairs = new type('tag:yaml.org,2002:pairs', {
  kind: 'sequence',
  resolve: resolveYamlPairs,
  construct: constructYamlPairs
});

var _hasOwnProperty$2 = Object.prototype.hasOwnProperty;

function resolveYamlSet(data) {
  if (data === null) return true;

  var key, object = data;

  for (key in object) {
    if (_hasOwnProperty$2.call(object, key)) {
      if (object[key] !== null) return false;
    }
  }

  return true;
}

function constructYamlSet(data) {
  return data !== null ? data : {};
}

var set = new type('tag:yaml.org,2002:set', {
  kind: 'mapping',
  resolve: resolveYamlSet,
  construct: constructYamlSet
});

var _default = core.extend({
  implicit: [
    timestamp,
    merge
  ],
  explicit: [
    binary,
    omap,
    pairs,
    set
  ]
});

/*eslint-disable max-len,no-use-before-define*/







var _hasOwnProperty$1 = Object.prototype.hasOwnProperty;


var CONTEXT_FLOW_IN   = 1;
var CONTEXT_FLOW_OUT  = 2;
var CONTEXT_BLOCK_IN  = 3;
var CONTEXT_BLOCK_OUT = 4;


var CHOMPING_CLIP  = 1;
var CHOMPING_STRIP = 2;
var CHOMPING_KEEP  = 3;


var PATTERN_NON_PRINTABLE         = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
var PATTERN_NON_ASCII_LINE_BREAKS = /[\x85\u2028\u2029]/;
var PATTERN_FLOW_INDICATORS       = /[,\[\]\{\}]/;
var PATTERN_TAG_HANDLE            = /^(?:!|!!|![a-z\-]+!)$/i;
var PATTERN_TAG_URI               = /^(?:!|[^,\[\]\{\}])(?:%[0-9a-f]{2}|[0-9a-z\-#;\/\?:@&=\+\$,_\.!~\*'\(\)\[\]])*$/i;


function _class(obj) { return Object.prototype.toString.call(obj); }

function is_EOL(c) {
  return (c === 0x0A/* LF */) || (c === 0x0D/* CR */);
}

function is_WHITE_SPACE(c) {
  return (c === 0x09/* Tab */) || (c === 0x20/* Space */);
}

function is_WS_OR_EOL(c) {
  return (c === 0x09/* Tab */) ||
         (c === 0x20/* Space */) ||
         (c === 0x0A/* LF */) ||
         (c === 0x0D/* CR */);
}

function is_FLOW_INDICATOR(c) {
  return c === 0x2C/* , */ ||
         c === 0x5B/* [ */ ||
         c === 0x5D/* ] */ ||
         c === 0x7B/* { */ ||
         c === 0x7D/* } */;
}

function fromHexCode(c) {
  var lc;

  if ((0x30/* 0 */ <= c) && (c <= 0x39/* 9 */)) {
    return c - 0x30;
  }

  /*eslint-disable no-bitwise*/
  lc = c | 0x20;

  if ((0x61/* a */ <= lc) && (lc <= 0x66/* f */)) {
    return lc - 0x61 + 10;
  }

  return -1;
}

function escapedHexLen(c) {
  if (c === 0x78/* x */) { return 2; }
  if (c === 0x75/* u */) { return 4; }
  if (c === 0x55/* U */) { return 8; }
  return 0;
}

function fromDecimalCode(c) {
  if ((0x30/* 0 */ <= c) && (c <= 0x39/* 9 */)) {
    return c - 0x30;
  }

  return -1;
}

function simpleEscapeSequence(c) {
  /* eslint-disable indent */
  return (c === 0x30/* 0 */) ? '\x00' :
        (c === 0x61/* a */) ? '\x07' :
        (c === 0x62/* b */) ? '\x08' :
        (c === 0x74/* t */) ? '\x09' :
        (c === 0x09/* Tab */) ? '\x09' :
        (c === 0x6E/* n */) ? '\x0A' :
        (c === 0x76/* v */) ? '\x0B' :
        (c === 0x66/* f */) ? '\x0C' :
        (c === 0x72/* r */) ? '\x0D' :
        (c === 0x65/* e */) ? '\x1B' :
        (c === 0x20/* Space */) ? ' ' :
        (c === 0x22/* " */) ? '\x22' :
        (c === 0x2F/* / */) ? '/' :
        (c === 0x5C/* \ */) ? '\x5C' :
        (c === 0x4E/* N */) ? '\x85' :
        (c === 0x5F/* _ */) ? '\xA0' :
        (c === 0x4C/* L */) ? '\u2028' :
        (c === 0x50/* P */) ? '\u2029' : '';
}

function charFromCodepoint(c) {
  if (c <= 0xFFFF) {
    return String.fromCharCode(c);
  }
  // Encode UTF-16 surrogate pair
  // https://en.wikipedia.org/wiki/UTF-16#Code_points_U.2B010000_to_U.2B10FFFF
  return String.fromCharCode(
    ((c - 0x010000) >> 10) + 0xD800,
    ((c - 0x010000) & 0x03FF) + 0xDC00
  );
}

// set a property of a literal object, while protecting against prototype pollution,
// see https://github.com/nodeca/js-yaml/issues/164 for more details
function setProperty(object, key, value) {
  // used for this specific key only because Object.defineProperty is slow
  if (key === '__proto__') {
    Object.defineProperty(object, key, {
      configurable: true,
      enumerable: true,
      writable: true,
      value: value
    });
  } else {
    object[key] = value;
  }
}

var simpleEscapeCheck = new Array(256); // integer, for fast access
var simpleEscapeMap = new Array(256);
for (var i = 0; i < 256; i++) {
  simpleEscapeCheck[i] = simpleEscapeSequence(i) ? 1 : 0;
  simpleEscapeMap[i] = simpleEscapeSequence(i);
}


function State$1(input, options) {
  this.input = input;

  this.filename  = options['filename']  || null;
  this.schema    = options['schema']    || _default;
  this.onWarning = options['onWarning'] || null;
  // (Hidden) Remove? makes the loader to expect YAML 1.1 documents
  // if such documents have no explicit %YAML directive
  this.legacy    = options['legacy']    || false;

  this.json      = options['json']      || false;
  this.listener  = options['listener']  || null;

  this.implicitTypes = this.schema.compiledImplicit;
  this.typeMap       = this.schema.compiledTypeMap;

  this.length     = input.length;
  this.position   = 0;
  this.line       = 0;
  this.lineStart  = 0;
  this.lineIndent = 0;

  // position of first leading tab in the current line,
  // used to make sure there are no tabs in the indentation
  this.firstTabInLine = -1;

  this.documents = [];

  /*
  this.version;
  this.checkLineBreaks;
  this.tagMap;
  this.anchorMap;
  this.tag;
  this.anchor;
  this.kind;
  this.result;*/

}


function generateError(state, message) {
  var mark = {
    name:     state.filename,
    buffer:   state.input.slice(0, -1), // omit trailing \0
    position: state.position,
    line:     state.line,
    column:   state.position - state.lineStart
  };

  mark.snippet = snippet(mark);

  return new exception(message, mark);
}

function throwError(state, message) {
  throw generateError(state, message);
}

function throwWarning(state, message) {
  if (state.onWarning) {
    state.onWarning.call(null, generateError(state, message));
  }
}


var directiveHandlers = {

  YAML: function handleYamlDirective(state, name, args) {

    var match, major, minor;

    if (state.version !== null) {
      throwError(state, 'duplication of %YAML directive');
    }

    if (args.length !== 1) {
      throwError(state, 'YAML directive accepts exactly one argument');
    }

    match = /^([0-9]+)\.([0-9]+)$/.exec(args[0]);

    if (match === null) {
      throwError(state, 'ill-formed argument of the YAML directive');
    }

    major = parseInt(match[1], 10);
    minor = parseInt(match[2], 10);

    if (major !== 1) {
      throwError(state, 'unacceptable YAML version of the document');
    }

    state.version = args[0];
    state.checkLineBreaks = (minor < 2);

    if (minor !== 1 && minor !== 2) {
      throwWarning(state, 'unsupported YAML version of the document');
    }
  },

  TAG: function handleTagDirective(state, name, args) {

    var handle, prefix;

    if (args.length !== 2) {
      throwError(state, 'TAG directive accepts exactly two arguments');
    }

    handle = args[0];
    prefix = args[1];

    if (!PATTERN_TAG_HANDLE.test(handle)) {
      throwError(state, 'ill-formed tag handle (first argument) of the TAG directive');
    }

    if (_hasOwnProperty$1.call(state.tagMap, handle)) {
      throwError(state, 'there is a previously declared suffix for "' + handle + '" tag handle');
    }

    if (!PATTERN_TAG_URI.test(prefix)) {
      throwError(state, 'ill-formed tag prefix (second argument) of the TAG directive');
    }

    try {
      prefix = decodeURIComponent(prefix);
    } catch (err) {
      throwError(state, 'tag prefix is malformed: ' + prefix);
    }

    state.tagMap[handle] = prefix;
  }
};


function captureSegment(state, start, end, checkJson) {
  var _position, _length, _character, _result;

  if (start < end) {
    _result = state.input.slice(start, end);

    if (checkJson) {
      for (_position = 0, _length = _result.length; _position < _length; _position += 1) {
        _character = _result.charCodeAt(_position);
        if (!(_character === 0x09 ||
              (0x20 <= _character && _character <= 0x10FFFF))) {
          throwError(state, 'expected valid JSON character');
        }
      }
    } else if (PATTERN_NON_PRINTABLE.test(_result)) {
      throwError(state, 'the stream contains non-printable characters');
    }

    state.result += _result;
  }
}

function mergeMappings(state, destination, source, overridableKeys) {
  var sourceKeys, key, index, quantity;

  if (!common.isObject(source)) {
    throwError(state, 'cannot merge mappings; the provided source object is unacceptable');
  }

  sourceKeys = Object.keys(source);

  for (index = 0, quantity = sourceKeys.length; index < quantity; index += 1) {
    key = sourceKeys[index];

    if (!_hasOwnProperty$1.call(destination, key)) {
      setProperty(destination, key, source[key]);
      overridableKeys[key] = true;
    }
  }
}

function storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode,
  startLine, startLineStart, startPos) {

  var index, quantity;

  // The output is a plain object here, so keys can only be strings.
  // We need to convert keyNode to a string, but doing so can hang the process
  // (deeply nested arrays that explode exponentially using aliases).
  if (Array.isArray(keyNode)) {
    keyNode = Array.prototype.slice.call(keyNode);

    for (index = 0, quantity = keyNode.length; index < quantity; index += 1) {
      if (Array.isArray(keyNode[index])) {
        throwError(state, 'nested arrays are not supported inside keys');
      }

      if (typeof keyNode === 'object' && _class(keyNode[index]) === '[object Object]') {
        keyNode[index] = '[object Object]';
      }
    }
  }

  // Avoid code execution in load() via toString property
  // (still use its own toString for arrays, timestamps,
  // and whatever user schema extensions happen to have @@toStringTag)
  if (typeof keyNode === 'object' && _class(keyNode) === '[object Object]') {
    keyNode = '[object Object]';
  }


  keyNode = String(keyNode);

  if (_result === null) {
    _result = {};
  }

  if (keyTag === 'tag:yaml.org,2002:merge') {
    if (Array.isArray(valueNode)) {
      for (index = 0, quantity = valueNode.length; index < quantity; index += 1) {
        mergeMappings(state, _result, valueNode[index], overridableKeys);
      }
    } else {
      mergeMappings(state, _result, valueNode, overridableKeys);
    }
  } else {
    if (!state.json &&
        !_hasOwnProperty$1.call(overridableKeys, keyNode) &&
        _hasOwnProperty$1.call(_result, keyNode)) {
      state.line = startLine || state.line;
      state.lineStart = startLineStart || state.lineStart;
      state.position = startPos || state.position;
      throwError(state, 'duplicated mapping key');
    }

    setProperty(_result, keyNode, valueNode);
    delete overridableKeys[keyNode];
  }

  return _result;
}

function readLineBreak(state) {
  var ch;

  ch = state.input.charCodeAt(state.position);

  if (ch === 0x0A/* LF */) {
    state.position++;
  } else if (ch === 0x0D/* CR */) {
    state.position++;
    if (state.input.charCodeAt(state.position) === 0x0A/* LF */) {
      state.position++;
    }
  } else {
    throwError(state, 'a line break is expected');
  }

  state.line += 1;
  state.lineStart = state.position;
  state.firstTabInLine = -1;
}

function skipSeparationSpace(state, allowComments, checkIndent) {
  var lineBreaks = 0,
      ch = state.input.charCodeAt(state.position);

  while (ch !== 0) {
    while (is_WHITE_SPACE(ch)) {
      if (ch === 0x09/* Tab */ && state.firstTabInLine === -1) {
        state.firstTabInLine = state.position;
      }
      ch = state.input.charCodeAt(++state.position);
    }

    if (allowComments && ch === 0x23/* # */) {
      do {
        ch = state.input.charCodeAt(++state.position);
      } while (ch !== 0x0A/* LF */ && ch !== 0x0D/* CR */ && ch !== 0);
    }

    if (is_EOL(ch)) {
      readLineBreak(state);

      ch = state.input.charCodeAt(state.position);
      lineBreaks++;
      state.lineIndent = 0;

      while (ch === 0x20/* Space */) {
        state.lineIndent++;
        ch = state.input.charCodeAt(++state.position);
      }
    } else {
      break;
    }
  }

  if (checkIndent !== -1 && lineBreaks !== 0 && state.lineIndent < checkIndent) {
    throwWarning(state, 'deficient indentation');
  }

  return lineBreaks;
}

function testDocumentSeparator(state) {
  var _position = state.position,
      ch;

  ch = state.input.charCodeAt(_position);

  // Condition state.position === state.lineStart is tested
  // in parent on each call, for efficiency. No needs to test here again.
  if ((ch === 0x2D/* - */ || ch === 0x2E/* . */) &&
      ch === state.input.charCodeAt(_position + 1) &&
      ch === state.input.charCodeAt(_position + 2)) {

    _position += 3;

    ch = state.input.charCodeAt(_position);

    if (ch === 0 || is_WS_OR_EOL(ch)) {
      return true;
    }
  }

  return false;
}

function writeFoldedLines(state, count) {
  if (count === 1) {
    state.result += ' ';
  } else if (count > 1) {
    state.result += common.repeat('\n', count - 1);
  }
}


function readPlainScalar(state, nodeIndent, withinFlowCollection) {
  var preceding,
      following,
      captureStart,
      captureEnd,
      hasPendingContent,
      _line,
      _lineStart,
      _lineIndent,
      _kind = state.kind,
      _result = state.result,
      ch;

  ch = state.input.charCodeAt(state.position);

  if (is_WS_OR_EOL(ch)      ||
      is_FLOW_INDICATOR(ch) ||
      ch === 0x23/* # */    ||
      ch === 0x26/* & */    ||
      ch === 0x2A/* * */    ||
      ch === 0x21/* ! */    ||
      ch === 0x7C/* | */    ||
      ch === 0x3E/* > */    ||
      ch === 0x27/* ' */    ||
      ch === 0x22/* " */    ||
      ch === 0x25/* % */    ||
      ch === 0x40/* @ */    ||
      ch === 0x60/* ` */) {
    return false;
  }

  if (ch === 0x3F/* ? */ || ch === 0x2D/* - */) {
    following = state.input.charCodeAt(state.position + 1);

    if (is_WS_OR_EOL(following) ||
        withinFlowCollection && is_FLOW_INDICATOR(following)) {
      return false;
    }
  }

  state.kind = 'scalar';
  state.result = '';
  captureStart = captureEnd = state.position;
  hasPendingContent = false;

  while (ch !== 0) {
    if (ch === 0x3A/* : */) {
      following = state.input.charCodeAt(state.position + 1);

      if (is_WS_OR_EOL(following) ||
          withinFlowCollection && is_FLOW_INDICATOR(following)) {
        break;
      }

    } else if (ch === 0x23/* # */) {
      preceding = state.input.charCodeAt(state.position - 1);

      if (is_WS_OR_EOL(preceding)) {
        break;
      }

    } else if ((state.position === state.lineStart && testDocumentSeparator(state)) ||
               withinFlowCollection && is_FLOW_INDICATOR(ch)) {
      break;

    } else if (is_EOL(ch)) {
      _line = state.line;
      _lineStart = state.lineStart;
      _lineIndent = state.lineIndent;
      skipSeparationSpace(state, false, -1);

      if (state.lineIndent >= nodeIndent) {
        hasPendingContent = true;
        ch = state.input.charCodeAt(state.position);
        continue;
      } else {
        state.position = captureEnd;
        state.line = _line;
        state.lineStart = _lineStart;
        state.lineIndent = _lineIndent;
        break;
      }
    }

    if (hasPendingContent) {
      captureSegment(state, captureStart, captureEnd, false);
      writeFoldedLines(state, state.line - _line);
      captureStart = captureEnd = state.position;
      hasPendingContent = false;
    }

    if (!is_WHITE_SPACE(ch)) {
      captureEnd = state.position + 1;
    }

    ch = state.input.charCodeAt(++state.position);
  }

  captureSegment(state, captureStart, captureEnd, false);

  if (state.result) {
    return true;
  }

  state.kind = _kind;
  state.result = _result;
  return false;
}

function readSingleQuotedScalar(state, nodeIndent) {
  var ch,
      captureStart, captureEnd;

  ch = state.input.charCodeAt(state.position);

  if (ch !== 0x27/* ' */) {
    return false;
  }

  state.kind = 'scalar';
  state.result = '';
  state.position++;
  captureStart = captureEnd = state.position;

  while ((ch = state.input.charCodeAt(state.position)) !== 0) {
    if (ch === 0x27/* ' */) {
      captureSegment(state, captureStart, state.position, true);
      ch = state.input.charCodeAt(++state.position);

      if (ch === 0x27/* ' */) {
        captureStart = state.position;
        state.position++;
        captureEnd = state.position;
      } else {
        return true;
      }

    } else if (is_EOL(ch)) {
      captureSegment(state, captureStart, captureEnd, true);
      writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
      captureStart = captureEnd = state.position;

    } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
      throwError(state, 'unexpected end of the document within a single quoted scalar');

    } else {
      state.position++;
      captureEnd = state.position;
    }
  }

  throwError(state, 'unexpected end of the stream within a single quoted scalar');
}

function readDoubleQuotedScalar(state, nodeIndent) {
  var captureStart,
      captureEnd,
      hexLength,
      hexResult,
      tmp,
      ch;

  ch = state.input.charCodeAt(state.position);

  if (ch !== 0x22/* " */) {
    return false;
  }

  state.kind = 'scalar';
  state.result = '';
  state.position++;
  captureStart = captureEnd = state.position;

  while ((ch = state.input.charCodeAt(state.position)) !== 0) {
    if (ch === 0x22/* " */) {
      captureSegment(state, captureStart, state.position, true);
      state.position++;
      return true;

    } else if (ch === 0x5C/* \ */) {
      captureSegment(state, captureStart, state.position, true);
      ch = state.input.charCodeAt(++state.position);

      if (is_EOL(ch)) {
        skipSeparationSpace(state, false, nodeIndent);

        // TODO: rework to inline fn with no type cast?
      } else if (ch < 256 && simpleEscapeCheck[ch]) {
        state.result += simpleEscapeMap[ch];
        state.position++;

      } else if ((tmp = escapedHexLen(ch)) > 0) {
        hexLength = tmp;
        hexResult = 0;

        for (; hexLength > 0; hexLength--) {
          ch = state.input.charCodeAt(++state.position);

          if ((tmp = fromHexCode(ch)) >= 0) {
            hexResult = (hexResult << 4) + tmp;

          } else {
            throwError(state, 'expected hexadecimal character');
          }
        }

        state.result += charFromCodepoint(hexResult);

        state.position++;

      } else {
        throwError(state, 'unknown escape sequence');
      }

      captureStart = captureEnd = state.position;

    } else if (is_EOL(ch)) {
      captureSegment(state, captureStart, captureEnd, true);
      writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
      captureStart = captureEnd = state.position;

    } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
      throwError(state, 'unexpected end of the document within a double quoted scalar');

    } else {
      state.position++;
      captureEnd = state.position;
    }
  }

  throwError(state, 'unexpected end of the stream within a double quoted scalar');
}

function readFlowCollection(state, nodeIndent) {
  var readNext = true,
      _line,
      _lineStart,
      _pos,
      _tag     = state.tag,
      _result,
      _anchor  = state.anchor,
      following,
      terminator,
      isPair,
      isExplicitPair,
      isMapping,
      overridableKeys = Object.create(null),
      keyNode,
      keyTag,
      valueNode,
      ch;

  ch = state.input.charCodeAt(state.position);

  if (ch === 0x5B/* [ */) {
    terminator = 0x5D;/* ] */
    isMapping = false;
    _result = [];
  } else if (ch === 0x7B/* { */) {
    terminator = 0x7D;/* } */
    isMapping = true;
    _result = {};
  } else {
    return false;
  }

  if (state.anchor !== null) {
    state.anchorMap[state.anchor] = _result;
  }

  ch = state.input.charCodeAt(++state.position);

  while (ch !== 0) {
    skipSeparationSpace(state, true, nodeIndent);

    ch = state.input.charCodeAt(state.position);

    if (ch === terminator) {
      state.position++;
      state.tag = _tag;
      state.anchor = _anchor;
      state.kind = isMapping ? 'mapping' : 'sequence';
      state.result = _result;
      return true;
    } else if (!readNext) {
      throwError(state, 'missed comma between flow collection entries');
    } else if (ch === 0x2C/* , */) {
      // "flow collection entries can never be completely empty", as per YAML 1.2, section 7.4
      throwError(state, "expected the node content, but found ','");
    }

    keyTag = keyNode = valueNode = null;
    isPair = isExplicitPair = false;

    if (ch === 0x3F/* ? */) {
      following = state.input.charCodeAt(state.position + 1);

      if (is_WS_OR_EOL(following)) {
        isPair = isExplicitPair = true;
        state.position++;
        skipSeparationSpace(state, true, nodeIndent);
      }
    }

    _line = state.line; // Save the current line.
    _lineStart = state.lineStart;
    _pos = state.position;
    composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
    keyTag = state.tag;
    keyNode = state.result;
    skipSeparationSpace(state, true, nodeIndent);

    ch = state.input.charCodeAt(state.position);

    if ((isExplicitPair || state.line === _line) && ch === 0x3A/* : */) {
      isPair = true;
      ch = state.input.charCodeAt(++state.position);
      skipSeparationSpace(state, true, nodeIndent);
      composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
      valueNode = state.result;
    }

    if (isMapping) {
      storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos);
    } else if (isPair) {
      _result.push(storeMappingPair(state, null, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos));
    } else {
      _result.push(keyNode);
    }

    skipSeparationSpace(state, true, nodeIndent);

    ch = state.input.charCodeAt(state.position);

    if (ch === 0x2C/* , */) {
      readNext = true;
      ch = state.input.charCodeAt(++state.position);
    } else {
      readNext = false;
    }
  }

  throwError(state, 'unexpected end of the stream within a flow collection');
}

function readBlockScalar(state, nodeIndent) {
  var captureStart,
      folding,
      chomping       = CHOMPING_CLIP,
      didReadContent = false,
      detectedIndent = false,
      textIndent     = nodeIndent,
      emptyLines     = 0,
      atMoreIndented = false,
      tmp,
      ch;

  ch = state.input.charCodeAt(state.position);

  if (ch === 0x7C/* | */) {
    folding = false;
  } else if (ch === 0x3E/* > */) {
    folding = true;
  } else {
    return false;
  }

  state.kind = 'scalar';
  state.result = '';

  while (ch !== 0) {
    ch = state.input.charCodeAt(++state.position);

    if (ch === 0x2B/* + */ || ch === 0x2D/* - */) {
      if (CHOMPING_CLIP === chomping) {
        chomping = (ch === 0x2B/* + */) ? CHOMPING_KEEP : CHOMPING_STRIP;
      } else {
        throwError(state, 'repeat of a chomping mode identifier');
      }

    } else if ((tmp = fromDecimalCode(ch)) >= 0) {
      if (tmp === 0) {
        throwError(state, 'bad explicit indentation width of a block scalar; it cannot be less than one');
      } else if (!detectedIndent) {
        textIndent = nodeIndent + tmp - 1;
        detectedIndent = true;
      } else {
        throwError(state, 'repeat of an indentation width identifier');
      }

    } else {
      break;
    }
  }

  if (is_WHITE_SPACE(ch)) {
    do { ch = state.input.charCodeAt(++state.position); }
    while (is_WHITE_SPACE(ch));

    if (ch === 0x23/* # */) {
      do { ch = state.input.charCodeAt(++state.position); }
      while (!is_EOL(ch) && (ch !== 0));
    }
  }

  while (ch !== 0) {
    readLineBreak(state);
    state.lineIndent = 0;

    ch = state.input.charCodeAt(state.position);

    while ((!detectedIndent || state.lineIndent < textIndent) &&
           (ch === 0x20/* Space */)) {
      state.lineIndent++;
      ch = state.input.charCodeAt(++state.position);
    }

    if (!detectedIndent && state.lineIndent > textIndent) {
      textIndent = state.lineIndent;
    }

    if (is_EOL(ch)) {
      emptyLines++;
      continue;
    }

    // End of the scalar.
    if (state.lineIndent < textIndent) {

      // Perform the chomping.
      if (chomping === CHOMPING_KEEP) {
        state.result += common.repeat('\n', didReadContent ? 1 + emptyLines : emptyLines);
      } else if (chomping === CHOMPING_CLIP) {
        if (didReadContent) { // i.e. only if the scalar is not empty.
          state.result += '\n';
        }
      }

      // Break this `while` cycle and go to the funciton's epilogue.
      break;
    }

    // Folded style: use fancy rules to handle line breaks.
    if (folding) {

      // Lines starting with white space characters (more-indented lines) are not folded.
      if (is_WHITE_SPACE(ch)) {
        atMoreIndented = true;
        // except for the first content line (cf. Example 8.1)
        state.result += common.repeat('\n', didReadContent ? 1 + emptyLines : emptyLines);

      // End of more-indented block.
      } else if (atMoreIndented) {
        atMoreIndented = false;
        state.result += common.repeat('\n', emptyLines + 1);

      // Just one line break - perceive as the same line.
      } else if (emptyLines === 0) {
        if (didReadContent) { // i.e. only if we have already read some scalar content.
          state.result += ' ';
        }

      // Several line breaks - perceive as different lines.
      } else {
        state.result += common.repeat('\n', emptyLines);
      }

    // Literal style: just add exact number of line breaks between content lines.
    } else {
      // Keep all line breaks except the header line break.
      state.result += common.repeat('\n', didReadContent ? 1 + emptyLines : emptyLines);
    }

    didReadContent = true;
    detectedIndent = true;
    emptyLines = 0;
    captureStart = state.position;

    while (!is_EOL(ch) && (ch !== 0)) {
      ch = state.input.charCodeAt(++state.position);
    }

    captureSegment(state, captureStart, state.position, false);
  }

  return true;
}

function readBlockSequence(state, nodeIndent) {
  var _line,
      _tag      = state.tag,
      _anchor   = state.anchor,
      _result   = [],
      following,
      detected  = false,
      ch;

  // there is a leading tab before this token, so it can't be a block sequence/mapping;
  // it can still be flow sequence/mapping or a scalar
  if (state.firstTabInLine !== -1) return false;

  if (state.anchor !== null) {
    state.anchorMap[state.anchor] = _result;
  }

  ch = state.input.charCodeAt(state.position);

  while (ch !== 0) {
    if (state.firstTabInLine !== -1) {
      state.position = state.firstTabInLine;
      throwError(state, 'tab characters must not be used in indentation');
    }

    if (ch !== 0x2D/* - */) {
      break;
    }

    following = state.input.charCodeAt(state.position + 1);

    if (!is_WS_OR_EOL(following)) {
      break;
    }

    detected = true;
    state.position++;

    if (skipSeparationSpace(state, true, -1)) {
      if (state.lineIndent <= nodeIndent) {
        _result.push(null);
        ch = state.input.charCodeAt(state.position);
        continue;
      }
    }

    _line = state.line;
    composeNode(state, nodeIndent, CONTEXT_BLOCK_IN, false, true);
    _result.push(state.result);
    skipSeparationSpace(state, true, -1);

    ch = state.input.charCodeAt(state.position);

    if ((state.line === _line || state.lineIndent > nodeIndent) && (ch !== 0)) {
      throwError(state, 'bad indentation of a sequence entry');
    } else if (state.lineIndent < nodeIndent) {
      break;
    }
  }

  if (detected) {
    state.tag = _tag;
    state.anchor = _anchor;
    state.kind = 'sequence';
    state.result = _result;
    return true;
  }
  return false;
}

function readBlockMapping(state, nodeIndent, flowIndent) {
  var following,
      allowCompact,
      _line,
      _keyLine,
      _keyLineStart,
      _keyPos,
      _tag          = state.tag,
      _anchor       = state.anchor,
      _result       = {},
      overridableKeys = Object.create(null),
      keyTag        = null,
      keyNode       = null,
      valueNode     = null,
      atExplicitKey = false,
      detected      = false,
      ch;

  // there is a leading tab before this token, so it can't be a block sequence/mapping;
  // it can still be flow sequence/mapping or a scalar
  if (state.firstTabInLine !== -1) return false;

  if (state.anchor !== null) {
    state.anchorMap[state.anchor] = _result;
  }

  ch = state.input.charCodeAt(state.position);

  while (ch !== 0) {
    if (!atExplicitKey && state.firstTabInLine !== -1) {
      state.position = state.firstTabInLine;
      throwError(state, 'tab characters must not be used in indentation');
    }

    following = state.input.charCodeAt(state.position + 1);
    _line = state.line; // Save the current line.

    //
    // Explicit notation case. There are two separate blocks:
    // first for the key (denoted by "?") and second for the value (denoted by ":")
    //
    if ((ch === 0x3F/* ? */ || ch === 0x3A/* : */) && is_WS_OR_EOL(following)) {

      if (ch === 0x3F/* ? */) {
        if (atExplicitKey) {
          storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
          keyTag = keyNode = valueNode = null;
        }

        detected = true;
        atExplicitKey = true;
        allowCompact = true;

      } else if (atExplicitKey) {
        // i.e. 0x3A/* : */ === character after the explicit key.
        atExplicitKey = false;
        allowCompact = true;

      } else {
        throwError(state, 'incomplete explicit mapping pair; a key node is missed; or followed by a non-tabulated empty line');
      }

      state.position += 1;
      ch = following;

    //
    // Implicit notation case. Flow-style node as the key first, then ":", and the value.
    //
    } else {
      _keyLine = state.line;
      _keyLineStart = state.lineStart;
      _keyPos = state.position;

      if (!composeNode(state, flowIndent, CONTEXT_FLOW_OUT, false, true)) {
        // Neither implicit nor explicit notation.
        // Reading is done. Go to the epilogue.
        break;
      }

      if (state.line === _line) {
        ch = state.input.charCodeAt(state.position);

        while (is_WHITE_SPACE(ch)) {
          ch = state.input.charCodeAt(++state.position);
        }

        if (ch === 0x3A/* : */) {
          ch = state.input.charCodeAt(++state.position);

          if (!is_WS_OR_EOL(ch)) {
            throwError(state, 'a whitespace character is expected after the key-value separator within a block mapping');
          }

          if (atExplicitKey) {
            storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
            keyTag = keyNode = valueNode = null;
          }

          detected = true;
          atExplicitKey = false;
          allowCompact = false;
          keyTag = state.tag;
          keyNode = state.result;

        } else if (detected) {
          throwError(state, 'can not read an implicit mapping pair; a colon is missed');

        } else {
          state.tag = _tag;
          state.anchor = _anchor;
          return true; // Keep the result of `composeNode`.
        }

      } else if (detected) {
        throwError(state, 'can not read a block mapping entry; a multiline key may not be an implicit key');

      } else {
        state.tag = _tag;
        state.anchor = _anchor;
        return true; // Keep the result of `composeNode`.
      }
    }

    //
    // Common reading code for both explicit and implicit notations.
    //
    if (state.line === _line || state.lineIndent > nodeIndent) {
      if (atExplicitKey) {
        _keyLine = state.line;
        _keyLineStart = state.lineStart;
        _keyPos = state.position;
      }

      if (composeNode(state, nodeIndent, CONTEXT_BLOCK_OUT, true, allowCompact)) {
        if (atExplicitKey) {
          keyNode = state.result;
        } else {
          valueNode = state.result;
        }
      }

      if (!atExplicitKey) {
        storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _keyLine, _keyLineStart, _keyPos);
        keyTag = keyNode = valueNode = null;
      }

      skipSeparationSpace(state, true, -1);
      ch = state.input.charCodeAt(state.position);
    }

    if ((state.line === _line || state.lineIndent > nodeIndent) && (ch !== 0)) {
      throwError(state, 'bad indentation of a mapping entry');
    } else if (state.lineIndent < nodeIndent) {
      break;
    }
  }

  //
  // Epilogue.
  //

  // Special case: last mapping's node contains only the key in explicit notation.
  if (atExplicitKey) {
    storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
  }

  // Expose the resulting mapping.
  if (detected) {
    state.tag = _tag;
    state.anchor = _anchor;
    state.kind = 'mapping';
    state.result = _result;
  }

  return detected;
}

function readTagProperty(state) {
  var _position,
      isVerbatim = false,
      isNamed    = false,
      tagHandle,
      tagName,
      ch;

  ch = state.input.charCodeAt(state.position);

  if (ch !== 0x21/* ! */) return false;

  if (state.tag !== null) {
    throwError(state, 'duplication of a tag property');
  }

  ch = state.input.charCodeAt(++state.position);

  if (ch === 0x3C/* < */) {
    isVerbatim = true;
    ch = state.input.charCodeAt(++state.position);

  } else if (ch === 0x21/* ! */) {
    isNamed = true;
    tagHandle = '!!';
    ch = state.input.charCodeAt(++state.position);

  } else {
    tagHandle = '!';
  }

  _position = state.position;

  if (isVerbatim) {
    do { ch = state.input.charCodeAt(++state.position); }
    while (ch !== 0 && ch !== 0x3E/* > */);

    if (state.position < state.length) {
      tagName = state.input.slice(_position, state.position);
      ch = state.input.charCodeAt(++state.position);
    } else {
      throwError(state, 'unexpected end of the stream within a verbatim tag');
    }
  } else {
    while (ch !== 0 && !is_WS_OR_EOL(ch)) {

      if (ch === 0x21/* ! */) {
        if (!isNamed) {
          tagHandle = state.input.slice(_position - 1, state.position + 1);

          if (!PATTERN_TAG_HANDLE.test(tagHandle)) {
            throwError(state, 'named tag handle cannot contain such characters');
          }

          isNamed = true;
          _position = state.position + 1;
        } else {
          throwError(state, 'tag suffix cannot contain exclamation marks');
        }
      }

      ch = state.input.charCodeAt(++state.position);
    }

    tagName = state.input.slice(_position, state.position);

    if (PATTERN_FLOW_INDICATORS.test(tagName)) {
      throwError(state, 'tag suffix cannot contain flow indicator characters');
    }
  }

  if (tagName && !PATTERN_TAG_URI.test(tagName)) {
    throwError(state, 'tag name cannot contain such characters: ' + tagName);
  }

  try {
    tagName = decodeURIComponent(tagName);
  } catch (err) {
    throwError(state, 'tag name is malformed: ' + tagName);
  }

  if (isVerbatim) {
    state.tag = tagName;

  } else if (_hasOwnProperty$1.call(state.tagMap, tagHandle)) {
    state.tag = state.tagMap[tagHandle] + tagName;

  } else if (tagHandle === '!') {
    state.tag = '!' + tagName;

  } else if (tagHandle === '!!') {
    state.tag = 'tag:yaml.org,2002:' + tagName;

  } else {
    throwError(state, 'undeclared tag handle "' + tagHandle + '"');
  }

  return true;
}

function readAnchorProperty(state) {
  var _position,
      ch;

  ch = state.input.charCodeAt(state.position);

  if (ch !== 0x26/* & */) return false;

  if (state.anchor !== null) {
    throwError(state, 'duplication of an anchor property');
  }

  ch = state.input.charCodeAt(++state.position);
  _position = state.position;

  while (ch !== 0 && !is_WS_OR_EOL(ch) && !is_FLOW_INDICATOR(ch)) {
    ch = state.input.charCodeAt(++state.position);
  }

  if (state.position === _position) {
    throwError(state, 'name of an anchor node must contain at least one character');
  }

  state.anchor = state.input.slice(_position, state.position);
  return true;
}

function readAlias(state) {
  var _position, alias,
      ch;

  ch = state.input.charCodeAt(state.position);

  if (ch !== 0x2A/* * */) return false;

  ch = state.input.charCodeAt(++state.position);
  _position = state.position;

  while (ch !== 0 && !is_WS_OR_EOL(ch) && !is_FLOW_INDICATOR(ch)) {
    ch = state.input.charCodeAt(++state.position);
  }

  if (state.position === _position) {
    throwError(state, 'name of an alias node must contain at least one character');
  }

  alias = state.input.slice(_position, state.position);

  if (!_hasOwnProperty$1.call(state.anchorMap, alias)) {
    throwError(state, 'unidentified alias "' + alias + '"');
  }

  state.result = state.anchorMap[alias];
  skipSeparationSpace(state, true, -1);
  return true;
}

function composeNode(state, parentIndent, nodeContext, allowToSeek, allowCompact) {
  var allowBlockStyles,
      allowBlockScalars,
      allowBlockCollections,
      indentStatus = 1, // 1: this>parent, 0: this=parent, -1: this<parent
      atNewLine  = false,
      hasContent = false,
      typeIndex,
      typeQuantity,
      typeList,
      type,
      flowIndent,
      blockIndent;

  if (state.listener !== null) {
    state.listener('open', state);
  }

  state.tag    = null;
  state.anchor = null;
  state.kind   = null;
  state.result = null;

  allowBlockStyles = allowBlockScalars = allowBlockCollections =
    CONTEXT_BLOCK_OUT === nodeContext ||
    CONTEXT_BLOCK_IN  === nodeContext;

  if (allowToSeek) {
    if (skipSeparationSpace(state, true, -1)) {
      atNewLine = true;

      if (state.lineIndent > parentIndent) {
        indentStatus = 1;
      } else if (state.lineIndent === parentIndent) {
        indentStatus = 0;
      } else if (state.lineIndent < parentIndent) {
        indentStatus = -1;
      }
    }
  }

  if (indentStatus === 1) {
    while (readTagProperty(state) || readAnchorProperty(state)) {
      if (skipSeparationSpace(state, true, -1)) {
        atNewLine = true;
        allowBlockCollections = allowBlockStyles;

        if (state.lineIndent > parentIndent) {
          indentStatus = 1;
        } else if (state.lineIndent === parentIndent) {
          indentStatus = 0;
        } else if (state.lineIndent < parentIndent) {
          indentStatus = -1;
        }
      } else {
        allowBlockCollections = false;
      }
    }
  }

  if (allowBlockCollections) {
    allowBlockCollections = atNewLine || allowCompact;
  }

  if (indentStatus === 1 || CONTEXT_BLOCK_OUT === nodeContext) {
    if (CONTEXT_FLOW_IN === nodeContext || CONTEXT_FLOW_OUT === nodeContext) {
      flowIndent = parentIndent;
    } else {
      flowIndent = parentIndent + 1;
    }

    blockIndent = state.position - state.lineStart;

    if (indentStatus === 1) {
      if (allowBlockCollections &&
          (readBlockSequence(state, blockIndent) ||
           readBlockMapping(state, blockIndent, flowIndent)) ||
          readFlowCollection(state, flowIndent)) {
        hasContent = true;
      } else {
        if ((allowBlockScalars && readBlockScalar(state, flowIndent)) ||
            readSingleQuotedScalar(state, flowIndent) ||
            readDoubleQuotedScalar(state, flowIndent)) {
          hasContent = true;

        } else if (readAlias(state)) {
          hasContent = true;

          if (state.tag !== null || state.anchor !== null) {
            throwError(state, 'alias node should not have any properties');
          }

        } else if (readPlainScalar(state, flowIndent, CONTEXT_FLOW_IN === nodeContext)) {
          hasContent = true;

          if (state.tag === null) {
            state.tag = '?';
          }
        }

        if (state.anchor !== null) {
          state.anchorMap[state.anchor] = state.result;
        }
      }
    } else if (indentStatus === 0) {
      // Special case: block sequences are allowed to have same indentation level as the parent.
      // http://www.yaml.org/spec/1.2/spec.html#id2799784
      hasContent = allowBlockCollections && readBlockSequence(state, blockIndent);
    }
  }

  if (state.tag === null) {
    if (state.anchor !== null) {
      state.anchorMap[state.anchor] = state.result;
    }

  } else if (state.tag === '?') {
    // Implicit resolving is not allowed for non-scalar types, and '?'
    // non-specific tag is only automatically assigned to plain scalars.
    //
    // We only need to check kind conformity in case user explicitly assigns '?'
    // tag, for example like this: "!<?> [0]"
    //
    if (state.result !== null && state.kind !== 'scalar') {
      throwError(state, 'unacceptable node kind for !<?> tag; it should be "scalar", not "' + state.kind + '"');
    }

    for (typeIndex = 0, typeQuantity = state.implicitTypes.length; typeIndex < typeQuantity; typeIndex += 1) {
      type = state.implicitTypes[typeIndex];

      if (type.resolve(state.result)) { // `state.result` updated in resolver if matched
        state.result = type.construct(state.result);
        state.tag = type.tag;
        if (state.anchor !== null) {
          state.anchorMap[state.anchor] = state.result;
        }
        break;
      }
    }
  } else if (state.tag !== '!') {
    if (_hasOwnProperty$1.call(state.typeMap[state.kind || 'fallback'], state.tag)) {
      type = state.typeMap[state.kind || 'fallback'][state.tag];
    } else {
      // looking for multi type
      type = null;
      typeList = state.typeMap.multi[state.kind || 'fallback'];

      for (typeIndex = 0, typeQuantity = typeList.length; typeIndex < typeQuantity; typeIndex += 1) {
        if (state.tag.slice(0, typeList[typeIndex].tag.length) === typeList[typeIndex].tag) {
          type = typeList[typeIndex];
          break;
        }
      }
    }

    if (!type) {
      throwError(state, 'unknown tag !<' + state.tag + '>');
    }

    if (state.result !== null && type.kind !== state.kind) {
      throwError(state, 'unacceptable node kind for !<' + state.tag + '> tag; it should be "' + type.kind + '", not "' + state.kind + '"');
    }

    if (!type.resolve(state.result, state.tag)) { // `state.result` updated in resolver if matched
      throwError(state, 'cannot resolve a node with !<' + state.tag + '> explicit tag');
    } else {
      state.result = type.construct(state.result, state.tag);
      if (state.anchor !== null) {
        state.anchorMap[state.anchor] = state.result;
      }
    }
  }

  if (state.listener !== null) {
    state.listener('close', state);
  }
  return state.tag !== null ||  state.anchor !== null || hasContent;
}

function readDocument(state) {
  var documentStart = state.position,
      _position,
      directiveName,
      directiveArgs,
      hasDirectives = false,
      ch;

  state.version = null;
  state.checkLineBreaks = state.legacy;
  state.tagMap = Object.create(null);
  state.anchorMap = Object.create(null);

  while ((ch = state.input.charCodeAt(state.position)) !== 0) {
    skipSeparationSpace(state, true, -1);

    ch = state.input.charCodeAt(state.position);

    if (state.lineIndent > 0 || ch !== 0x25/* % */) {
      break;
    }

    hasDirectives = true;
    ch = state.input.charCodeAt(++state.position);
    _position = state.position;

    while (ch !== 0 && !is_WS_OR_EOL(ch)) {
      ch = state.input.charCodeAt(++state.position);
    }

    directiveName = state.input.slice(_position, state.position);
    directiveArgs = [];

    if (directiveName.length < 1) {
      throwError(state, 'directive name must not be less than one character in length');
    }

    while (ch !== 0) {
      while (is_WHITE_SPACE(ch)) {
        ch = state.input.charCodeAt(++state.position);
      }

      if (ch === 0x23/* # */) {
        do { ch = state.input.charCodeAt(++state.position); }
        while (ch !== 0 && !is_EOL(ch));
        break;
      }

      if (is_EOL(ch)) break;

      _position = state.position;

      while (ch !== 0 && !is_WS_OR_EOL(ch)) {
        ch = state.input.charCodeAt(++state.position);
      }

      directiveArgs.push(state.input.slice(_position, state.position));
    }

    if (ch !== 0) readLineBreak(state);

    if (_hasOwnProperty$1.call(directiveHandlers, directiveName)) {
      directiveHandlers[directiveName](state, directiveName, directiveArgs);
    } else {
      throwWarning(state, 'unknown document directive "' + directiveName + '"');
    }
  }

  skipSeparationSpace(state, true, -1);

  if (state.lineIndent === 0 &&
      state.input.charCodeAt(state.position)     === 0x2D/* - */ &&
      state.input.charCodeAt(state.position + 1) === 0x2D/* - */ &&
      state.input.charCodeAt(state.position + 2) === 0x2D/* - */) {
    state.position += 3;
    skipSeparationSpace(state, true, -1);

  } else if (hasDirectives) {
    throwError(state, 'directives end mark is expected');
  }

  composeNode(state, state.lineIndent - 1, CONTEXT_BLOCK_OUT, false, true);
  skipSeparationSpace(state, true, -1);

  if (state.checkLineBreaks &&
      PATTERN_NON_ASCII_LINE_BREAKS.test(state.input.slice(documentStart, state.position))) {
    throwWarning(state, 'non-ASCII line breaks are interpreted as content');
  }

  state.documents.push(state.result);

  if (state.position === state.lineStart && testDocumentSeparator(state)) {

    if (state.input.charCodeAt(state.position) === 0x2E/* . */) {
      state.position += 3;
      skipSeparationSpace(state, true, -1);
    }
    return;
  }

  if (state.position < (state.length - 1)) {
    throwError(state, 'end of the stream or a document separator is expected');
  } else {
    return;
  }
}


function loadDocuments(input, options) {
  input = String(input);
  options = options || {};

  if (input.length !== 0) {

    // Add tailing `\n` if not exists
    if (input.charCodeAt(input.length - 1) !== 0x0A/* LF */ &&
        input.charCodeAt(input.length - 1) !== 0x0D/* CR */) {
      input += '\n';
    }

    // Strip BOM
    if (input.charCodeAt(0) === 0xFEFF) {
      input = input.slice(1);
    }
  }

  var state = new State$1(input, options);

  var nullpos = input.indexOf('\0');

  if (nullpos !== -1) {
    state.position = nullpos;
    throwError(state, 'null byte is not allowed in input');
  }

  // Use 0 as string terminator. That significantly simplifies bounds check.
  state.input += '\0';

  while (state.input.charCodeAt(state.position) === 0x20/* Space */) {
    state.lineIndent += 1;
    state.position += 1;
  }

  while (state.position < (state.length - 1)) {
    readDocument(state);
  }

  return state.documents;
}


function loadAll$1(input, iterator, options) {
  if (iterator !== null && typeof iterator === 'object' && typeof options === 'undefined') {
    options = iterator;
    iterator = null;
  }

  var documents = loadDocuments(input, options);

  if (typeof iterator !== 'function') {
    return documents;
  }

  for (var index = 0, length = documents.length; index < length; index += 1) {
    iterator(documents[index]);
  }
}


function load$1(input, options) {
  var documents = loadDocuments(input, options);

  if (documents.length === 0) {
    /*eslint-disable no-undefined*/
    return undefined;
  } else if (documents.length === 1) {
    return documents[0];
  }
  throw new exception('expected a single document in the stream, but found more');
}


var loadAll_1 = loadAll$1;
var load_1    = load$1;

var loader = {
	loadAll: loadAll_1,
	load: load_1
};

/*eslint-disable no-use-before-define*/





var _toString       = Object.prototype.toString;
var _hasOwnProperty = Object.prototype.hasOwnProperty;

var CHAR_BOM                  = 0xFEFF;
var CHAR_TAB                  = 0x09; /* Tab */
var CHAR_LINE_FEED            = 0x0A; /* LF */
var CHAR_CARRIAGE_RETURN      = 0x0D; /* CR */
var CHAR_SPACE                = 0x20; /* Space */
var CHAR_EXCLAMATION          = 0x21; /* ! */
var CHAR_DOUBLE_QUOTE         = 0x22; /* " */
var CHAR_SHARP                = 0x23; /* # */
var CHAR_PERCENT              = 0x25; /* % */
var CHAR_AMPERSAND            = 0x26; /* & */
var CHAR_SINGLE_QUOTE         = 0x27; /* ' */
var CHAR_ASTERISK             = 0x2A; /* * */
var CHAR_COMMA                = 0x2C; /* , */
var CHAR_MINUS                = 0x2D; /* - */
var CHAR_COLON                = 0x3A; /* : */
var CHAR_EQUALS               = 0x3D; /* = */
var CHAR_GREATER_THAN         = 0x3E; /* > */
var CHAR_QUESTION             = 0x3F; /* ? */
var CHAR_COMMERCIAL_AT        = 0x40; /* @ */
var CHAR_LEFT_SQUARE_BRACKET  = 0x5B; /* [ */
var CHAR_RIGHT_SQUARE_BRACKET = 0x5D; /* ] */
var CHAR_GRAVE_ACCENT         = 0x60; /* ` */
var CHAR_LEFT_CURLY_BRACKET   = 0x7B; /* { */
var CHAR_VERTICAL_LINE        = 0x7C; /* | */
var CHAR_RIGHT_CURLY_BRACKET  = 0x7D; /* } */

var ESCAPE_SEQUENCES = {};

ESCAPE_SEQUENCES[0x00]   = '\\0';
ESCAPE_SEQUENCES[0x07]   = '\\a';
ESCAPE_SEQUENCES[0x08]   = '\\b';
ESCAPE_SEQUENCES[0x09]   = '\\t';
ESCAPE_SEQUENCES[0x0A]   = '\\n';
ESCAPE_SEQUENCES[0x0B]   = '\\v';
ESCAPE_SEQUENCES[0x0C]   = '\\f';
ESCAPE_SEQUENCES[0x0D]   = '\\r';
ESCAPE_SEQUENCES[0x1B]   = '\\e';
ESCAPE_SEQUENCES[0x22]   = '\\"';
ESCAPE_SEQUENCES[0x5C]   = '\\\\';
ESCAPE_SEQUENCES[0x85]   = '\\N';
ESCAPE_SEQUENCES[0xA0]   = '\\_';
ESCAPE_SEQUENCES[0x2028] = '\\L';
ESCAPE_SEQUENCES[0x2029] = '\\P';

var DEPRECATED_BOOLEANS_SYNTAX = [
  'y', 'Y', 'yes', 'Yes', 'YES', 'on', 'On', 'ON',
  'n', 'N', 'no', 'No', 'NO', 'off', 'Off', 'OFF'
];

var DEPRECATED_BASE60_SYNTAX = /^[-+]?[0-9_]+(?::[0-9_]+)+(?:\.[0-9_]*)?$/;

function compileStyleMap(schema, map) {
  var result, keys, index, length, tag, style, type;

  if (map === null) return {};

  result = {};
  keys = Object.keys(map);

  for (index = 0, length = keys.length; index < length; index += 1) {
    tag = keys[index];
    style = String(map[tag]);

    if (tag.slice(0, 2) === '!!') {
      tag = 'tag:yaml.org,2002:' + tag.slice(2);
    }
    type = schema.compiledTypeMap['fallback'][tag];

    if (type && _hasOwnProperty.call(type.styleAliases, style)) {
      style = type.styleAliases[style];
    }

    result[tag] = style;
  }

  return result;
}

function encodeHex(character) {
  var string, handle, length;

  string = character.toString(16).toUpperCase();

  if (character <= 0xFF) {
    handle = 'x';
    length = 2;
  } else if (character <= 0xFFFF) {
    handle = 'u';
    length = 4;
  } else if (character <= 0xFFFFFFFF) {
    handle = 'U';
    length = 8;
  } else {
    throw new exception('code point within a string may not be greater than 0xFFFFFFFF');
  }

  return '\\' + handle + common.repeat('0', length - string.length) + string;
}


var QUOTING_TYPE_SINGLE = 1,
    QUOTING_TYPE_DOUBLE = 2;

function State(options) {
  this.schema        = options['schema'] || _default;
  this.indent        = Math.max(1, (options['indent'] || 2));
  this.noArrayIndent = options['noArrayIndent'] || false;
  this.skipInvalid   = options['skipInvalid'] || false;
  this.flowLevel     = (common.isNothing(options['flowLevel']) ? -1 : options['flowLevel']);
  this.styleMap      = compileStyleMap(this.schema, options['styles'] || null);
  this.sortKeys      = options['sortKeys'] || false;
  this.lineWidth     = options['lineWidth'] || 80;
  this.noRefs        = options['noRefs'] || false;
  this.noCompatMode  = options['noCompatMode'] || false;
  this.condenseFlow  = options['condenseFlow'] || false;
  this.quotingType   = options['quotingType'] === '"' ? QUOTING_TYPE_DOUBLE : QUOTING_TYPE_SINGLE;
  this.forceQuotes   = options['forceQuotes'] || false;
  this.replacer      = typeof options['replacer'] === 'function' ? options['replacer'] : null;

  this.implicitTypes = this.schema.compiledImplicit;
  this.explicitTypes = this.schema.compiledExplicit;

  this.tag = null;
  this.result = '';

  this.duplicates = [];
  this.usedDuplicates = null;
}

// Indents every line in a string. Empty lines (\n only) are not indented.
function indentString(string, spaces) {
  var ind = common.repeat(' ', spaces),
      position = 0,
      next = -1,
      result = '',
      line,
      length = string.length;

  while (position < length) {
    next = string.indexOf('\n', position);
    if (next === -1) {
      line = string.slice(position);
      position = length;
    } else {
      line = string.slice(position, next + 1);
      position = next + 1;
    }

    if (line.length && line !== '\n') result += ind;

    result += line;
  }

  return result;
}

function generateNextLine(state, level) {
  return '\n' + common.repeat(' ', state.indent * level);
}

function testImplicitResolving(state, str) {
  var index, length, type;

  for (index = 0, length = state.implicitTypes.length; index < length; index += 1) {
    type = state.implicitTypes[index];

    if (type.resolve(str)) {
      return true;
    }
  }

  return false;
}

// [33] s-white ::= s-space | s-tab
function isWhitespace(c) {
  return c === CHAR_SPACE || c === CHAR_TAB;
}

// Returns true if the character can be printed without escaping.
// From YAML 1.2: "any allowed characters known to be non-printable
// should also be escaped. [However,] This isn’t mandatory"
// Derived from nb-char - \t - #x85 - #xA0 - #x2028 - #x2029.
function isPrintable(c) {
  return  (0x00020 <= c && c <= 0x00007E)
      || ((0x000A1 <= c && c <= 0x00D7FF) && c !== 0x2028 && c !== 0x2029)
      || ((0x0E000 <= c && c <= 0x00FFFD) && c !== CHAR_BOM)
      ||  (0x10000 <= c && c <= 0x10FFFF);
}

// [34] ns-char ::= nb-char - s-white
// [27] nb-char ::= c-printable - b-char - c-byte-order-mark
// [26] b-char  ::= b-line-feed | b-carriage-return
// Including s-white (for some reason, examples doesn't match specs in this aspect)
// ns-char ::= c-printable - b-line-feed - b-carriage-return - c-byte-order-mark
function isNsCharOrWhitespace(c) {
  return isPrintable(c)
    && c !== CHAR_BOM
    // - b-char
    && c !== CHAR_CARRIAGE_RETURN
    && c !== CHAR_LINE_FEED;
}

// [127]  ns-plain-safe(c) ::= c = flow-out  ⇒ ns-plain-safe-out
//                             c = flow-in   ⇒ ns-plain-safe-in
//                             c = block-key ⇒ ns-plain-safe-out
//                             c = flow-key  ⇒ ns-plain-safe-in
// [128] ns-plain-safe-out ::= ns-char
// [129]  ns-plain-safe-in ::= ns-char - c-flow-indicator
// [130]  ns-plain-char(c) ::=  ( ns-plain-safe(c) - “:” - “#” )
//                            | ( /* An ns-char preceding */ “#” )
//                            | ( “:” /* Followed by an ns-plain-safe(c) */ )
function isPlainSafe(c, prev, inblock) {
  var cIsNsCharOrWhitespace = isNsCharOrWhitespace(c);
  var cIsNsChar = cIsNsCharOrWhitespace && !isWhitespace(c);
  return (
    // ns-plain-safe
    inblock ? // c = flow-in
      cIsNsCharOrWhitespace
      : cIsNsCharOrWhitespace
        // - c-flow-indicator
        && c !== CHAR_COMMA
        && c !== CHAR_LEFT_SQUARE_BRACKET
        && c !== CHAR_RIGHT_SQUARE_BRACKET
        && c !== CHAR_LEFT_CURLY_BRACKET
        && c !== CHAR_RIGHT_CURLY_BRACKET
  )
    // ns-plain-char
    && c !== CHAR_SHARP // false on '#'
    && !(prev === CHAR_COLON && !cIsNsChar) // false on ': '
    || (isNsCharOrWhitespace(prev) && !isWhitespace(prev) && c === CHAR_SHARP) // change to true on '[^ ]#'
    || (prev === CHAR_COLON && cIsNsChar); // change to true on ':[^ ]'
}

// Simplified test for values allowed as the first character in plain style.
function isPlainSafeFirst(c) {
  // Uses a subset of ns-char - c-indicator
  // where ns-char = nb-char - s-white.
  // No support of ( ( “?” | “:” | “-” ) /* Followed by an ns-plain-safe(c)) */ ) part
  return isPrintable(c) && c !== CHAR_BOM
    && !isWhitespace(c) // - s-white
    // - (c-indicator ::=
    // “-” | “?” | “:” | “,” | “[” | “]” | “{” | “}”
    && c !== CHAR_MINUS
    && c !== CHAR_QUESTION
    && c !== CHAR_COLON
    && c !== CHAR_COMMA
    && c !== CHAR_LEFT_SQUARE_BRACKET
    && c !== CHAR_RIGHT_SQUARE_BRACKET
    && c !== CHAR_LEFT_CURLY_BRACKET
    && c !== CHAR_RIGHT_CURLY_BRACKET
    // | “#” | “&” | “*” | “!” | “|” | “=” | “>” | “'” | “"”
    && c !== CHAR_SHARP
    && c !== CHAR_AMPERSAND
    && c !== CHAR_ASTERISK
    && c !== CHAR_EXCLAMATION
    && c !== CHAR_VERTICAL_LINE
    && c !== CHAR_EQUALS
    && c !== CHAR_GREATER_THAN
    && c !== CHAR_SINGLE_QUOTE
    && c !== CHAR_DOUBLE_QUOTE
    // | “%” | “@” | “`”)
    && c !== CHAR_PERCENT
    && c !== CHAR_COMMERCIAL_AT
    && c !== CHAR_GRAVE_ACCENT;
}

// Simplified test for values allowed as the last character in plain style.
function isPlainSafeLast(c) {
  // just not whitespace or colon, it will be checked to be plain character later
  return !isWhitespace(c) && c !== CHAR_COLON;
}

// Same as 'string'.codePointAt(pos), but works in older browsers.
function codePointAt(string, pos) {
  var first = string.charCodeAt(pos), second;
  if (first >= 0xD800 && first <= 0xDBFF && pos + 1 < string.length) {
    second = string.charCodeAt(pos + 1);
    if (second >= 0xDC00 && second <= 0xDFFF) {
      // https://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
      return (first - 0xD800) * 0x400 + second - 0xDC00 + 0x10000;
    }
  }
  return first;
}

// Determines whether block indentation indicator is required.
function needIndentIndicator(string) {
  var leadingSpaceRe = /^\n* /;
  return leadingSpaceRe.test(string);
}

var STYLE_PLAIN   = 1,
    STYLE_SINGLE  = 2,
    STYLE_LITERAL = 3,
    STYLE_FOLDED  = 4,
    STYLE_DOUBLE  = 5;

// Determines which scalar styles are possible and returns the preferred style.
// lineWidth = -1 => no limit.
// Pre-conditions: str.length > 0.
// Post-conditions:
//    STYLE_PLAIN or STYLE_SINGLE => no \n are in the string.
//    STYLE_LITERAL => no lines are suitable for folding (or lineWidth is -1).
//    STYLE_FOLDED => a line > lineWidth and can be folded (and lineWidth != -1).
function chooseScalarStyle(string, singleLineOnly, indentPerLevel, lineWidth,
  testAmbiguousType, quotingType, forceQuotes, inblock) {

  var i;
  var char = 0;
  var prevChar = null;
  var hasLineBreak = false;
  var hasFoldableLine = false; // only checked if shouldTrackWidth
  var shouldTrackWidth = lineWidth !== -1;
  var previousLineBreak = -1; // count the first line correctly
  var plain = isPlainSafeFirst(codePointAt(string, 0))
          && isPlainSafeLast(codePointAt(string, string.length - 1));

  if (singleLineOnly || forceQuotes) {
    // Case: no block styles.
    // Check for disallowed characters to rule out plain and single.
    for (i = 0; i < string.length; char >= 0x10000 ? i += 2 : i++) {
      char = codePointAt(string, i);
      if (!isPrintable(char)) {
        return STYLE_DOUBLE;
      }
      plain = plain && isPlainSafe(char, prevChar, inblock);
      prevChar = char;
    }
  } else {
    // Case: block styles permitted.
    for (i = 0; i < string.length; char >= 0x10000 ? i += 2 : i++) {
      char = codePointAt(string, i);
      if (char === CHAR_LINE_FEED) {
        hasLineBreak = true;
        // Check if any line can be folded.
        if (shouldTrackWidth) {
          hasFoldableLine = hasFoldableLine ||
            // Foldable line = too long, and not more-indented.
            (i - previousLineBreak - 1 > lineWidth &&
             string[previousLineBreak + 1] !== ' ');
          previousLineBreak = i;
        }
      } else if (!isPrintable(char)) {
        return STYLE_DOUBLE;
      }
      plain = plain && isPlainSafe(char, prevChar, inblock);
      prevChar = char;
    }
    // in case the end is missing a \n
    hasFoldableLine = hasFoldableLine || (shouldTrackWidth &&
      (i - previousLineBreak - 1 > lineWidth &&
       string[previousLineBreak + 1] !== ' '));
  }
  // Although every style can represent \n without escaping, prefer block styles
  // for multiline, since they're more readable and they don't add empty lines.
  // Also prefer folding a super-long line.
  if (!hasLineBreak && !hasFoldableLine) {
    // Strings interpretable as another type have to be quoted;
    // e.g. the string 'true' vs. the boolean true.
    if (plain && !forceQuotes && !testAmbiguousType(string)) {
      return STYLE_PLAIN;
    }
    return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
  }
  // Edge case: block indentation indicator can only have one digit.
  if (indentPerLevel > 9 && needIndentIndicator(string)) {
    return STYLE_DOUBLE;
  }
  // At this point we know block styles are valid.
  // Prefer literal style unless we want to fold.
  if (!forceQuotes) {
    return hasFoldableLine ? STYLE_FOLDED : STYLE_LITERAL;
  }
  return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
}

// Note: line breaking/folding is implemented for only the folded style.
// NB. We drop the last trailing newline (if any) of a returned block scalar
//  since the dumper adds its own newline. This always works:
//    • No ending newline => unaffected; already using strip "-" chomping.
//    • Ending newline    => removed then restored.
//  Importantly, this keeps the "+" chomp indicator from gaining an extra line.
function writeScalar(state, string, level, iskey, inblock) {
  state.dump = (function () {
    if (string.length === 0) {
      return state.quotingType === QUOTING_TYPE_DOUBLE ? '""' : "''";
    }
    if (!state.noCompatMode) {
      if (DEPRECATED_BOOLEANS_SYNTAX.indexOf(string) !== -1 || DEPRECATED_BASE60_SYNTAX.test(string)) {
        return state.quotingType === QUOTING_TYPE_DOUBLE ? ('"' + string + '"') : ("'" + string + "'");
      }
    }

    var indent = state.indent * Math.max(1, level); // no 0-indent scalars
    // As indentation gets deeper, let the width decrease monotonically
    // to the lower bound min(state.lineWidth, 40).
    // Note that this implies
    //  state.lineWidth ≤ 40 + state.indent: width is fixed at the lower bound.
    //  state.lineWidth > 40 + state.indent: width decreases until the lower bound.
    // This behaves better than a constant minimum width which disallows narrower options,
    // or an indent threshold which causes the width to suddenly increase.
    var lineWidth = state.lineWidth === -1
      ? -1 : Math.max(Math.min(state.lineWidth, 40), state.lineWidth - indent);

    // Without knowing if keys are implicit/explicit, assume implicit for safety.
    var singleLineOnly = iskey
      // No block styles in flow mode.
      || (state.flowLevel > -1 && level >= state.flowLevel);
    function testAmbiguity(string) {
      return testImplicitResolving(state, string);
    }

    switch (chooseScalarStyle(string, singleLineOnly, state.indent, lineWidth,
      testAmbiguity, state.quotingType, state.forceQuotes && !iskey, inblock)) {

      case STYLE_PLAIN:
        return string;
      case STYLE_SINGLE:
        return "'" + string.replace(/'/g, "''") + "'";
      case STYLE_LITERAL:
        return '|' + blockHeader(string, state.indent)
          + dropEndingNewline(indentString(string, indent));
      case STYLE_FOLDED:
        return '>' + blockHeader(string, state.indent)
          + dropEndingNewline(indentString(foldString(string, lineWidth), indent));
      case STYLE_DOUBLE:
        return '"' + escapeString(string) + '"';
      default:
        throw new exception('impossible error: invalid scalar style');
    }
  }());
}

// Pre-conditions: string is valid for a block scalar, 1 <= indentPerLevel <= 9.
function blockHeader(string, indentPerLevel) {
  var indentIndicator = needIndentIndicator(string) ? String(indentPerLevel) : '';

  // note the special case: the string '\n' counts as a "trailing" empty line.
  var clip =          string[string.length - 1] === '\n';
  var keep = clip && (string[string.length - 2] === '\n' || string === '\n');
  var chomp = keep ? '+' : (clip ? '' : '-');

  return indentIndicator + chomp + '\n';
}

// (See the note for writeScalar.)
function dropEndingNewline(string) {
  return string[string.length - 1] === '\n' ? string.slice(0, -1) : string;
}

// Note: a long line without a suitable break point will exceed the width limit.
// Pre-conditions: every char in str isPrintable, str.length > 0, width > 0.
function foldString(string, width) {
  // In folded style, $k$ consecutive newlines output as $k+1$ newlines—
  // unless they're before or after a more-indented line, or at the very
  // beginning or end, in which case $k$ maps to $k$.
  // Therefore, parse each chunk as newline(s) followed by a content line.
  var lineRe = /(\n+)([^\n]*)/g;

  // first line (possibly an empty line)
  var result = (function () {
    var nextLF = string.indexOf('\n');
    nextLF = nextLF !== -1 ? nextLF : string.length;
    lineRe.lastIndex = nextLF;
    return foldLine(string.slice(0, nextLF), width);
  }());
  // If we haven't reached the first content line yet, don't add an extra \n.
  var prevMoreIndented = string[0] === '\n' || string[0] === ' ';
  var moreIndented;

  // rest of the lines
  var match;
  while ((match = lineRe.exec(string))) {
    var prefix = match[1], line = match[2];
    moreIndented = (line[0] === ' ');
    result += prefix
      + (!prevMoreIndented && !moreIndented && line !== ''
        ? '\n' : '')
      + foldLine(line, width);
    prevMoreIndented = moreIndented;
  }

  return result;
}

// Greedy line breaking.
// Picks the longest line under the limit each time,
// otherwise settles for the shortest line over the limit.
// NB. More-indented lines *cannot* be folded, as that would add an extra \n.
function foldLine(line, width) {
  if (line === '' || line[0] === ' ') return line;

  // Since a more-indented line adds a \n, breaks can't be followed by a space.
  var breakRe = / [^ ]/g; // note: the match index will always be <= length-2.
  var match;
  // start is an inclusive index. end, curr, and next are exclusive.
  var start = 0, end, curr = 0, next = 0;
  var result = '';

  // Invariants: 0 <= start <= length-1.
  //   0 <= curr <= next <= max(0, length-2). curr - start <= width.
  // Inside the loop:
  //   A match implies length >= 2, so curr and next are <= length-2.
  while ((match = breakRe.exec(line))) {
    next = match.index;
    // maintain invariant: curr - start <= width
    if (next - start > width) {
      end = (curr > start) ? curr : next; // derive end <= length-2
      result += '\n' + line.slice(start, end);
      // skip the space that was output as \n
      start = end + 1;                    // derive start <= length-1
    }
    curr = next;
  }

  // By the invariants, start <= length-1, so there is something left over.
  // It is either the whole string or a part starting from non-whitespace.
  result += '\n';
  // Insert a break if the remainder is too long and there is a break available.
  if (line.length - start > width && curr > start) {
    result += line.slice(start, curr) + '\n' + line.slice(curr + 1);
  } else {
    result += line.slice(start);
  }

  return result.slice(1); // drop extra \n joiner
}

// Escapes a double-quoted string.
function escapeString(string) {
  var result = '';
  var char = 0;
  var escapeSeq;

  for (var i = 0; i < string.length; char >= 0x10000 ? i += 2 : i++) {
    char = codePointAt(string, i);
    escapeSeq = ESCAPE_SEQUENCES[char];

    if (!escapeSeq && isPrintable(char)) {
      result += string[i];
      if (char >= 0x10000) result += string[i + 1];
    } else {
      result += escapeSeq || encodeHex(char);
    }
  }

  return result;
}

function writeFlowSequence(state, level, object) {
  var _result = '',
      _tag    = state.tag,
      index,
      length,
      value;

  for (index = 0, length = object.length; index < length; index += 1) {
    value = object[index];

    if (state.replacer) {
      value = state.replacer.call(object, String(index), value);
    }

    // Write only valid elements, put null instead of invalid elements.
    if (writeNode(state, level, value, false, false) ||
        (typeof value === 'undefined' &&
         writeNode(state, level, null, false, false))) {

      if (_result !== '') _result += ',' + (!state.condenseFlow ? ' ' : '');
      _result += state.dump;
    }
  }

  state.tag = _tag;
  state.dump = '[' + _result + ']';
}

function writeBlockSequence(state, level, object, compact) {
  var _result = '',
      _tag    = state.tag,
      index,
      length,
      value;

  for (index = 0, length = object.length; index < length; index += 1) {
    value = object[index];

    if (state.replacer) {
      value = state.replacer.call(object, String(index), value);
    }

    // Write only valid elements, put null instead of invalid elements.
    if (writeNode(state, level + 1, value, true, true, false, true) ||
        (typeof value === 'undefined' &&
         writeNode(state, level + 1, null, true, true, false, true))) {

      if (!compact || _result !== '') {
        _result += generateNextLine(state, level);
      }

      if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
        _result += '-';
      } else {
        _result += '- ';
      }

      _result += state.dump;
    }
  }

  state.tag = _tag;
  state.dump = _result || '[]'; // Empty sequence if no valid values.
}

function writeFlowMapping(state, level, object) {
  var _result       = '',
      _tag          = state.tag,
      objectKeyList = Object.keys(object),
      index,
      length,
      objectKey,
      objectValue,
      pairBuffer;

  for (index = 0, length = objectKeyList.length; index < length; index += 1) {

    pairBuffer = '';
    if (_result !== '') pairBuffer += ', ';

    if (state.condenseFlow) pairBuffer += '"';

    objectKey = objectKeyList[index];
    objectValue = object[objectKey];

    if (state.replacer) {
      objectValue = state.replacer.call(object, objectKey, objectValue);
    }

    if (!writeNode(state, level, objectKey, false, false)) {
      continue; // Skip this pair because of invalid key;
    }

    if (state.dump.length > 1024) pairBuffer += '? ';

    pairBuffer += state.dump + (state.condenseFlow ? '"' : '') + ':' + (state.condenseFlow ? '' : ' ');

    if (!writeNode(state, level, objectValue, false, false)) {
      continue; // Skip this pair because of invalid value.
    }

    pairBuffer += state.dump;

    // Both key and value are valid.
    _result += pairBuffer;
  }

  state.tag = _tag;
  state.dump = '{' + _result + '}';
}

function writeBlockMapping(state, level, object, compact) {
  var _result       = '',
      _tag          = state.tag,
      objectKeyList = Object.keys(object),
      index,
      length,
      objectKey,
      objectValue,
      explicitPair,
      pairBuffer;

  // Allow sorting keys so that the output file is deterministic
  if (state.sortKeys === true) {
    // Default sorting
    objectKeyList.sort();
  } else if (typeof state.sortKeys === 'function') {
    // Custom sort function
    objectKeyList.sort(state.sortKeys);
  } else if (state.sortKeys) {
    // Something is wrong
    throw new exception('sortKeys must be a boolean or a function');
  }

  for (index = 0, length = objectKeyList.length; index < length; index += 1) {
    pairBuffer = '';

    if (!compact || _result !== '') {
      pairBuffer += generateNextLine(state, level);
    }

    objectKey = objectKeyList[index];
    objectValue = object[objectKey];

    if (state.replacer) {
      objectValue = state.replacer.call(object, objectKey, objectValue);
    }

    if (!writeNode(state, level + 1, objectKey, true, true, true)) {
      continue; // Skip this pair because of invalid key.
    }

    explicitPair = (state.tag !== null && state.tag !== '?') ||
                   (state.dump && state.dump.length > 1024);

    if (explicitPair) {
      if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
        pairBuffer += '?';
      } else {
        pairBuffer += '? ';
      }
    }

    pairBuffer += state.dump;

    if (explicitPair) {
      pairBuffer += generateNextLine(state, level);
    }

    if (!writeNode(state, level + 1, objectValue, true, explicitPair)) {
      continue; // Skip this pair because of invalid value.
    }

    if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
      pairBuffer += ':';
    } else {
      pairBuffer += ': ';
    }

    pairBuffer += state.dump;

    // Both key and value are valid.
    _result += pairBuffer;
  }

  state.tag = _tag;
  state.dump = _result || '{}'; // Empty mapping if no valid pairs.
}

function detectType(state, object, explicit) {
  var _result, typeList, index, length, type, style;

  typeList = explicit ? state.explicitTypes : state.implicitTypes;

  for (index = 0, length = typeList.length; index < length; index += 1) {
    type = typeList[index];

    if ((type.instanceOf  || type.predicate) &&
        (!type.instanceOf || ((typeof object === 'object') && (object instanceof type.instanceOf))) &&
        (!type.predicate  || type.predicate(object))) {

      if (explicit) {
        if (type.multi && type.representName) {
          state.tag = type.representName(object);
        } else {
          state.tag = type.tag;
        }
      } else {
        state.tag = '?';
      }

      if (type.represent) {
        style = state.styleMap[type.tag] || type.defaultStyle;

        if (_toString.call(type.represent) === '[object Function]') {
          _result = type.represent(object, style);
        } else if (_hasOwnProperty.call(type.represent, style)) {
          _result = type.represent[style](object, style);
        } else {
          throw new exception('!<' + type.tag + '> tag resolver accepts not "' + style + '" style');
        }

        state.dump = _result;
      }

      return true;
    }
  }

  return false;
}

// Serializes `object` and writes it to global `result`.
// Returns true on success, or false on invalid object.
//
function writeNode(state, level, object, block, compact, iskey, isblockseq) {
  state.tag = null;
  state.dump = object;

  if (!detectType(state, object, false)) {
    detectType(state, object, true);
  }

  var type = _toString.call(state.dump);
  var inblock = block;
  var tagStr;

  if (block) {
    block = (state.flowLevel < 0 || state.flowLevel > level);
  }

  var objectOrArray = type === '[object Object]' || type === '[object Array]',
      duplicateIndex,
      duplicate;

  if (objectOrArray) {
    duplicateIndex = state.duplicates.indexOf(object);
    duplicate = duplicateIndex !== -1;
  }

  if ((state.tag !== null && state.tag !== '?') || duplicate || (state.indent !== 2 && level > 0)) {
    compact = false;
  }

  if (duplicate && state.usedDuplicates[duplicateIndex]) {
    state.dump = '*ref_' + duplicateIndex;
  } else {
    if (objectOrArray && duplicate && !state.usedDuplicates[duplicateIndex]) {
      state.usedDuplicates[duplicateIndex] = true;
    }
    if (type === '[object Object]') {
      if (block && (Object.keys(state.dump).length !== 0)) {
        writeBlockMapping(state, level, state.dump, compact);
        if (duplicate) {
          state.dump = '&ref_' + duplicateIndex + state.dump;
        }
      } else {
        writeFlowMapping(state, level, state.dump);
        if (duplicate) {
          state.dump = '&ref_' + duplicateIndex + ' ' + state.dump;
        }
      }
    } else if (type === '[object Array]') {
      if (block && (state.dump.length !== 0)) {
        if (state.noArrayIndent && !isblockseq && level > 0) {
          writeBlockSequence(state, level - 1, state.dump, compact);
        } else {
          writeBlockSequence(state, level, state.dump, compact);
        }
        if (duplicate) {
          state.dump = '&ref_' + duplicateIndex + state.dump;
        }
      } else {
        writeFlowSequence(state, level, state.dump);
        if (duplicate) {
          state.dump = '&ref_' + duplicateIndex + ' ' + state.dump;
        }
      }
    } else if (type === '[object String]') {
      if (state.tag !== '?') {
        writeScalar(state, state.dump, level, iskey, inblock);
      }
    } else if (type === '[object Undefined]') {
      return false;
    } else {
      if (state.skipInvalid) return false;
      throw new exception('unacceptable kind of an object to dump ' + type);
    }

    if (state.tag !== null && state.tag !== '?') {
      // Need to encode all characters except those allowed by the spec:
      //
      // [35] ns-dec-digit    ::=  [#x30-#x39] /* 0-9 */
      // [36] ns-hex-digit    ::=  ns-dec-digit
      //                         | [#x41-#x46] /* A-F */ | [#x61-#x66] /* a-f */
      // [37] ns-ascii-letter ::=  [#x41-#x5A] /* A-Z */ | [#x61-#x7A] /* a-z */
      // [38] ns-word-char    ::=  ns-dec-digit | ns-ascii-letter | “-”
      // [39] ns-uri-char     ::=  “%” ns-hex-digit ns-hex-digit | ns-word-char | “#”
      //                         | “;” | “/” | “?” | “:” | “@” | “&” | “=” | “+” | “$” | “,”
      //                         | “_” | “.” | “!” | “~” | “*” | “'” | “(” | “)” | “[” | “]”
      //
      // Also need to encode '!' because it has special meaning (end of tag prefix).
      //
      tagStr = encodeURI(
        state.tag[0] === '!' ? state.tag.slice(1) : state.tag
      ).replace(/!/g, '%21');

      if (state.tag[0] === '!') {
        tagStr = '!' + tagStr;
      } else if (tagStr.slice(0, 18) === 'tag:yaml.org,2002:') {
        tagStr = '!!' + tagStr.slice(18);
      } else {
        tagStr = '!<' + tagStr + '>';
      }

      state.dump = tagStr + ' ' + state.dump;
    }
  }

  return true;
}

function getDuplicateReferences(object, state) {
  var objects = [],
      duplicatesIndexes = [],
      index,
      length;

  inspectNode(object, objects, duplicatesIndexes);

  for (index = 0, length = duplicatesIndexes.length; index < length; index += 1) {
    state.duplicates.push(objects[duplicatesIndexes[index]]);
  }
  state.usedDuplicates = new Array(length);
}

function inspectNode(object, objects, duplicatesIndexes) {
  var objectKeyList,
      index,
      length;

  if (object !== null && typeof object === 'object') {
    index = objects.indexOf(object);
    if (index !== -1) {
      if (duplicatesIndexes.indexOf(index) === -1) {
        duplicatesIndexes.push(index);
      }
    } else {
      objects.push(object);

      if (Array.isArray(object)) {
        for (index = 0, length = object.length; index < length; index += 1) {
          inspectNode(object[index], objects, duplicatesIndexes);
        }
      } else {
        objectKeyList = Object.keys(object);

        for (index = 0, length = objectKeyList.length; index < length; index += 1) {
          inspectNode(object[objectKeyList[index]], objects, duplicatesIndexes);
        }
      }
    }
  }
}

function dump$1(input, options) {
  options = options || {};

  var state = new State(options);

  if (!state.noRefs) getDuplicateReferences(input, state);

  var value = input;

  if (state.replacer) {
    value = state.replacer.call({ '': value }, '', value);
  }

  if (writeNode(state, 0, value, true, true)) return state.dump + '\n';

  return '';
}

var dump_1 = dump$1;

var dumper = {
	dump: dump_1
};

function renamed(from, to) {
  return function () {
    throw new Error('Function yaml.' + from + ' is removed in js-yaml 4. ' +
      'Use yaml.' + to + ' instead, which is now safe by default.');
  };
}


var Type                = type;
var Schema              = schema;
var FAILSAFE_SCHEMA     = failsafe;
var JSON_SCHEMA         = json;
var CORE_SCHEMA         = core;
var DEFAULT_SCHEMA      = _default;
var load                = loader.load;
var loadAll             = loader.loadAll;
var dump                = dumper.dump;
var YAMLException       = exception;

// Re-export all types in case user wants to create custom schema
var types = {
  binary:    binary,
  float:     float,
  map:       map,
  null:      _null,
  pairs:     pairs,
  set:       set,
  timestamp: timestamp,
  bool:      bool,
  int:       int,
  merge:     merge,
  omap:      omap,
  seq:       seq,
  str:       str
};

// Removed functions from JS-YAML 3.0.x
var safeLoad            = renamed('safeLoad', 'load');
var safeLoadAll         = renamed('safeLoadAll', 'loadAll');
var safeDump            = renamed('safeDump', 'dump');

var jsYaml = {
	Type: Type,
	Schema: Schema,
	FAILSAFE_SCHEMA: FAILSAFE_SCHEMA,
	JSON_SCHEMA: JSON_SCHEMA,
	CORE_SCHEMA: CORE_SCHEMA,
	DEFAULT_SCHEMA: DEFAULT_SCHEMA,
	load: load,
	loadAll: loadAll,
	dump: dump,
	YAMLException: YAMLException,
	types: types,
	safeLoad: safeLoad,
	safeLoadAll: safeLoadAll,
	safeDump: safeDump
};




/***/ },

/***/ "./node_modules/lit-element/development/lit-element.js"
/*!*************************************************************!*\
  !*** ./node_modules/lit-element/development/lit-element.js ***!
  \*************************************************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   CSSResult: () => (/* reexport safe */ _lit_reactive_element__WEBPACK_IMPORTED_MODULE_0__.CSSResult),
/* harmony export */   LitElement: () => (/* binding */ LitElement),
/* harmony export */   ReactiveElement: () => (/* reexport safe */ _lit_reactive_element__WEBPACK_IMPORTED_MODULE_0__.ReactiveElement),
/* harmony export */   _$LE: () => (/* binding */ _$LE),
/* harmony export */   _$LH: () => (/* reexport safe */ lit_html__WEBPACK_IMPORTED_MODULE_1__._$LH),
/* harmony export */   adoptStyles: () => (/* reexport safe */ _lit_reactive_element__WEBPACK_IMPORTED_MODULE_0__.adoptStyles),
/* harmony export */   css: () => (/* reexport safe */ _lit_reactive_element__WEBPACK_IMPORTED_MODULE_0__.css),
/* harmony export */   defaultConverter: () => (/* reexport safe */ _lit_reactive_element__WEBPACK_IMPORTED_MODULE_0__.defaultConverter),
/* harmony export */   getCompatibleStyle: () => (/* reexport safe */ _lit_reactive_element__WEBPACK_IMPORTED_MODULE_0__.getCompatibleStyle),
/* harmony export */   html: () => (/* reexport safe */ lit_html__WEBPACK_IMPORTED_MODULE_1__.html),
/* harmony export */   mathml: () => (/* reexport safe */ lit_html__WEBPACK_IMPORTED_MODULE_1__.mathml),
/* harmony export */   noChange: () => (/* reexport safe */ lit_html__WEBPACK_IMPORTED_MODULE_1__.noChange),
/* harmony export */   notEqual: () => (/* reexport safe */ _lit_reactive_element__WEBPACK_IMPORTED_MODULE_0__.notEqual),
/* harmony export */   nothing: () => (/* reexport safe */ lit_html__WEBPACK_IMPORTED_MODULE_1__.nothing),
/* harmony export */   render: () => (/* reexport safe */ lit_html__WEBPACK_IMPORTED_MODULE_1__.render),
/* harmony export */   supportsAdoptingStyleSheets: () => (/* reexport safe */ _lit_reactive_element__WEBPACK_IMPORTED_MODULE_0__.supportsAdoptingStyleSheets),
/* harmony export */   svg: () => (/* reexport safe */ lit_html__WEBPACK_IMPORTED_MODULE_1__.svg),
/* harmony export */   unsafeCSS: () => (/* reexport safe */ _lit_reactive_element__WEBPACK_IMPORTED_MODULE_0__.unsafeCSS)
/* harmony export */ });
/* harmony import */ var _lit_reactive_element__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @lit/reactive-element */ "./node_modules/@lit/reactive-element/development/reactive-element.js");
/* harmony import */ var lit_html__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! lit-html */ "./node_modules/lit-html/development/lit-html.js");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
/**
 * The main LitElement module, which defines the {@linkcode LitElement} base
 * class and related APIs.
 *
 * LitElement components can define a template and a set of observed
 * properties. Changing an observed property triggers a re-render of the
 * element.
 *
 * Import {@linkcode LitElement} and {@linkcode html} from this module to
 * create a component:
 *
 *  ```js
 * import {LitElement, html} from 'lit-element';
 *
 * class MyElement extends LitElement {
 *
 *   // Declare observed properties
 *   static get properties() {
 *     return {
 *       adjective: {}
 *     }
 *   }
 *
 *   constructor() {
 *     this.adjective = 'awesome';
 *   }
 *
 *   // Define the element's template
 *   render() {
 *     return html`<p>your ${adjective} template here</p>`;
 *   }
 * }
 *
 * customElements.define('my-element', MyElement);
 * ```
 *
 * `LitElement` extends {@linkcode ReactiveElement} and adds lit-html
 * templating. The `ReactiveElement` class is provided for users that want to
 * build their own custom element base classes that don't use lit-html.
 *
 * @packageDocumentation
 */




/*
 * When using Closure Compiler, JSCompiler_renameProperty(property, object) is
 * replaced at compile time by the munged name for object[property]. We cannot
 * alias this function, so we have to use a small shim that has the same
 * behavior when not compiling.
 */
/*@__INLINE__*/
const JSCompiler_renameProperty = (prop, _obj) => prop;
const DEV_MODE = true;
// Allows minifiers to rename references to globalThis
const global = globalThis;
let issueWarning;
if (DEV_MODE) {
    // Ensure warnings are issued only 1x, even if multiple versions of Lit
    // are loaded.
    global.litIssuedWarnings ??= new Set();
    /**
     * Issue a warning if we haven't already, based either on `code` or `warning`.
     * Warnings are disabled automatically only by `warning`; disabling via `code`
     * can be done by users.
     */
    issueWarning = (code, warning) => {
        warning += ` See https://lit.dev/msg/${code} for more information.`;
        if (!global.litIssuedWarnings.has(warning) &&
            !global.litIssuedWarnings.has(code)) {
            console.warn(warning);
            global.litIssuedWarnings.add(warning);
        }
    };
}
/**
 * Base element class that manages element properties and attributes, and
 * renders a lit-html template.
 *
 * To define a component, subclass `LitElement` and implement a
 * `render` method to provide the component's template. Define properties
 * using the {@linkcode LitElement.properties properties} property or the
 * {@linkcode property} decorator.
 */
class LitElement extends _lit_reactive_element__WEBPACK_IMPORTED_MODULE_0__.ReactiveElement {
    constructor() {
        super(...arguments);
        /**
         * @category rendering
         */
        this.renderOptions = { host: this };
        this.__childPart = undefined;
    }
    /**
     * @category rendering
     */
    createRenderRoot() {
        const renderRoot = super.createRenderRoot();
        // When adoptedStyleSheets are shimmed, they are inserted into the
        // shadowRoot by createRenderRoot. Adjust the renderBefore node so that
        // any styles in Lit content render before adoptedStyleSheets. This is
        // important so that adoptedStyleSheets have precedence over styles in
        // the shadowRoot.
        this.renderOptions.renderBefore ??= renderRoot.firstChild;
        return renderRoot;
    }
    /**
     * Updates the element. This method reflects property values to attributes
     * and calls `render` to render DOM via lit-html. Setting properties inside
     * this method will *not* trigger another update.
     * @param changedProperties Map of changed properties with old values
     * @category updates
     */
    update(changedProperties) {
        // Setting properties in `render` should not trigger an update. Since
        // updates are allowed after super.update, it's important to call `render`
        // before that.
        const value = this.render();
        if (!this.hasUpdated) {
            this.renderOptions.isConnected = this.isConnected;
        }
        super.update(changedProperties);
        this.__childPart = (0,lit_html__WEBPACK_IMPORTED_MODULE_1__.render)(value, this.renderRoot, this.renderOptions);
    }
    /**
     * Invoked when the component is added to the document's DOM.
     *
     * In `connectedCallback()` you should setup tasks that should only occur when
     * the element is connected to the document. The most common of these is
     * adding event listeners to nodes external to the element, like a keydown
     * event handler added to the window.
     *
     * ```ts
     * connectedCallback() {
     *   super.connectedCallback();
     *   addEventListener('keydown', this._handleKeydown);
     * }
     * ```
     *
     * Typically, anything done in `connectedCallback()` should be undone when the
     * element is disconnected, in `disconnectedCallback()`.
     *
     * @category lifecycle
     */
    connectedCallback() {
        super.connectedCallback();
        this.__childPart?.setConnected(true);
    }
    /**
     * Invoked when the component is removed from the document's DOM.
     *
     * This callback is the main signal to the element that it may no longer be
     * used. `disconnectedCallback()` should ensure that nothing is holding a
     * reference to the element (such as event listeners added to nodes external
     * to the element), so that it is free to be garbage collected.
     *
     * ```ts
     * disconnectedCallback() {
     *   super.disconnectedCallback();
     *   window.removeEventListener('keydown', this._handleKeydown);
     * }
     * ```
     *
     * An element may be re-connected after being disconnected.
     *
     * @category lifecycle
     */
    disconnectedCallback() {
        super.disconnectedCallback();
        this.__childPart?.setConnected(false);
    }
    /**
     * Invoked on each update to perform rendering tasks. This method may return
     * any value renderable by lit-html's `ChildPart` - typically a
     * `TemplateResult`. Setting properties inside this method will *not* trigger
     * the element to update.
     * @category rendering
     */
    render() {
        return lit_html__WEBPACK_IMPORTED_MODULE_1__.noChange;
    }
}
// This property needs to remain unminified.
LitElement['_$litElement$'] = true;
/**
 * Ensure this class is marked as `finalized` as an optimization ensuring
 * it will not needlessly try to `finalize`.
 *
 * Note this property name is a string to prevent breaking Closure JS Compiler
 * optimizations. See @lit/reactive-element for more information.
 */
LitElement[JSCompiler_renameProperty('finalized', LitElement)] = true;
// Install hydration if available
global.litElementHydrateSupport?.({ LitElement });
// Apply polyfills if available
const polyfillSupport = DEV_MODE
    ? global.litElementPolyfillSupportDevMode
    : global.litElementPolyfillSupport;
polyfillSupport?.({ LitElement });
/**
 * END USERS SHOULD NOT RELY ON THIS OBJECT.
 *
 * Private exports for use by other Lit packages, not intended for use by
 * external users.
 *
 * We currently do not make a mangled rollup build of the lit-ssr code. In order
 * to keep a number of (otherwise private) top-level exports  mangled in the
 * client side code, we export a _$LE object containing those members (or
 * helper methods for accessing private fields of those members), and then
 * re-export them for use in lit-ssr. This keeps lit-ssr agnostic to whether the
 * client-side code is being used in `dev` mode or `prod` mode.
 *
 * This has a unique name, to disambiguate it from private exports in
 * lit-html, since this module re-exports all of lit-html.
 *
 * @private
 */
const _$LE = {
    _$attributeToProperty: (el, name, value) => {
        // eslint-disable-next-line
        el._$attributeToProperty(name, value);
    },
    // eslint-disable-next-line
    _$changedProperties: (el) => el._$changedProperties,
};
// IMPORTANT: do not change the property name or the assignment expression.
// This line will be used in regexes to search for LitElement usage.
(global.litElementVersions ??= []).push('4.2.2');
if (DEV_MODE && global.litElementVersions.length > 1) {
    queueMicrotask(() => {
        issueWarning('multiple-versions', `Multiple versions of Lit loaded. Loading multiple versions ` +
            `is not recommended.`);
    });
}
//# sourceMappingURL=lit-element.js.map

/***/ },

/***/ "./node_modules/lit-html/development/directive.js"
/*!********************************************************!*\
  !*** ./node_modules/lit-html/development/directive.js ***!
  \********************************************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Directive: () => (/* binding */ Directive),
/* harmony export */   PartType: () => (/* binding */ PartType),
/* harmony export */   directive: () => (/* binding */ directive)
/* harmony export */ });
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const PartType = {
    ATTRIBUTE: 1,
    CHILD: 2,
    PROPERTY: 3,
    BOOLEAN_ATTRIBUTE: 4,
    EVENT: 5,
    ELEMENT: 6,
};
/**
 * Creates a user-facing directive function from a Directive class. This
 * function has the same parameters as the directive's render() method.
 */
const directive = (c) => (...values) => ({
    // This property needs to remain unminified.
    ['_$litDirective$']: c,
    values,
});
/**
 * Base class for creating custom directives. Users should extend this class,
 * implement `render` and/or `update`, and then pass their subclass to
 * `directive`.
 */
class Directive {
    constructor(_partInfo) { }
    // See comment in Disconnectable interface for why this is a getter
    get _$isConnected() {
        return this._$parent._$isConnected;
    }
    /** @internal */
    _$initialize(part, parent, attributeIndex) {
        this.__part = part;
        this._$parent = parent;
        this.__attributeIndex = attributeIndex;
    }
    /** @internal */
    _$resolve(part, props) {
        return this.update(part, props);
    }
    update(_part, props) {
        return this.render(...props);
    }
}
//# sourceMappingURL=directive.js.map

/***/ },

/***/ "./node_modules/lit-html/development/directives/unsafe-html.js"
/*!*********************************************************************!*\
  !*** ./node_modules/lit-html/development/directives/unsafe-html.js ***!
  \*********************************************************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   UnsafeHTMLDirective: () => (/* binding */ UnsafeHTMLDirective),
/* harmony export */   unsafeHTML: () => (/* binding */ unsafeHTML)
/* harmony export */ });
/* harmony import */ var _lit_html_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../lit-html.js */ "./node_modules/lit-html/development/lit-html.js");
/* harmony import */ var _directive_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../directive.js */ "./node_modules/lit-html/development/directive.js");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */


const HTML_RESULT = 1;
class UnsafeHTMLDirective extends _directive_js__WEBPACK_IMPORTED_MODULE_1__.Directive {
    constructor(partInfo) {
        super(partInfo);
        this._value = _lit_html_js__WEBPACK_IMPORTED_MODULE_0__.nothing;
        if (partInfo.type !== _directive_js__WEBPACK_IMPORTED_MODULE_1__.PartType.CHILD) {
            throw new Error(`${this.constructor.directiveName}() can only be used in child bindings`);
        }
    }
    render(value) {
        if (value === _lit_html_js__WEBPACK_IMPORTED_MODULE_0__.nothing || value == null) {
            this._templateResult = undefined;
            return (this._value = value);
        }
        if (value === _lit_html_js__WEBPACK_IMPORTED_MODULE_0__.noChange) {
            return value;
        }
        if (typeof value != 'string') {
            throw new Error(`${this.constructor.directiveName}() called with a non-string value`);
        }
        if (value === this._value) {
            return this._templateResult;
        }
        this._value = value;
        const strings = [value];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        strings.raw = strings;
        // WARNING: impersonating a TemplateResult like this is extremely
        // dangerous. Third-party directives should not do this.
        return (this._templateResult = {
            // Cast to a known set of integers that satisfy ResultType so that we
            // don't have to export ResultType and possibly encourage this pattern.
            // This property needs to remain unminified.
            ['_$litType$']: this.constructor
                .resultType,
            strings,
            values: [],
        });
    }
}
UnsafeHTMLDirective.directiveName = 'unsafeHTML';
UnsafeHTMLDirective.resultType = HTML_RESULT;
/**
 * Renders the result as HTML, rather than text.
 *
 * The values `undefined`, `null`, and `nothing`, will all result in no content
 * (empty string) being rendered.
 *
 * Note, this is unsafe to use with any user-provided input that hasn't been
 * sanitized or escaped, as it may lead to cross-site-scripting
 * vulnerabilities.
 */
const unsafeHTML = (0,_directive_js__WEBPACK_IMPORTED_MODULE_1__.directive)(UnsafeHTMLDirective);
//# sourceMappingURL=unsafe-html.js.map

/***/ },

/***/ "./node_modules/lit-html/development/is-server.js"
/*!********************************************************!*\
  !*** ./node_modules/lit-html/development/is-server.js ***!
  \********************************************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   isServer: () => (/* binding */ isServer)
/* harmony export */ });
/**
 * @license
 * Copyright 2022 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
/**
 * @fileoverview
 *
 * This file exports a boolean const whose value will depend on what environment
 * the module is being imported from.
 */
const NODE_MODE = false;
/**
 * A boolean that will be `true` in server environments like Node, and `false`
 * in browser environments. Note that your server environment or toolchain must
 * support the `"node"` export condition for this to be `true`.
 *
 * This can be used when authoring components to change behavior based on
 * whether or not the component is executing in an SSR context.
 */
const isServer = NODE_MODE;
//# sourceMappingURL=is-server.js.map

/***/ },

/***/ "./node_modules/lit-html/development/lit-html.js"
/*!*******************************************************!*\
  !*** ./node_modules/lit-html/development/lit-html.js ***!
  \*******************************************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   _$LH: () => (/* binding */ _$LH),
/* harmony export */   html: () => (/* binding */ html),
/* harmony export */   mathml: () => (/* binding */ mathml),
/* harmony export */   noChange: () => (/* binding */ noChange),
/* harmony export */   nothing: () => (/* binding */ nothing),
/* harmony export */   render: () => (/* binding */ render),
/* harmony export */   svg: () => (/* binding */ svg)
/* harmony export */ });
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const DEV_MODE = true;
const ENABLE_EXTRA_SECURITY_HOOKS = true;
const ENABLE_SHADYDOM_NOPATCH = true;
const NODE_MODE = false;
// Allows minifiers to rename references to globalThis
const global = globalThis;
/**
 * Useful for visualizing and logging insights into what the Lit template system is doing.
 *
 * Compiled out of prod mode builds.
 */
const debugLogEvent = DEV_MODE
    ? (event) => {
        const shouldEmit = global
            .emitLitDebugLogEvents;
        if (!shouldEmit) {
            return;
        }
        global.dispatchEvent(new CustomEvent('lit-debug', {
            detail: event,
        }));
    }
    : undefined;
// Used for connecting beginRender and endRender events when there are nested
// renders when errors are thrown preventing an endRender event from being
// called.
let debugLogRenderId = 0;
let issueWarning;
if (DEV_MODE) {
    global.litIssuedWarnings ??= new Set();
    /**
     * Issue a warning if we haven't already, based either on `code` or `warning`.
     * Warnings are disabled automatically only by `warning`; disabling via `code`
     * can be done by users.
     */
    issueWarning = (code, warning) => {
        warning += code
            ? ` See https://lit.dev/msg/${code} for more information.`
            : '';
        if (!global.litIssuedWarnings.has(warning) &&
            !global.litIssuedWarnings.has(code)) {
            console.warn(warning);
            global.litIssuedWarnings.add(warning);
        }
    };
    queueMicrotask(() => {
        issueWarning('dev-mode', `Lit is in dev mode. Not recommended for production!`);
    });
}
const wrap = ENABLE_SHADYDOM_NOPATCH &&
    global.ShadyDOM?.inUse &&
    global.ShadyDOM?.noPatch === true
    ? global.ShadyDOM.wrap
    : (node) => node;
const trustedTypes = global.trustedTypes;
/**
 * Our TrustedTypePolicy for HTML which is declared using the html template
 * tag function.
 *
 * That HTML is a developer-authored constant, and is parsed with innerHTML
 * before any untrusted expressions have been mixed in. Therefor it is
 * considered safe by construction.
 */
const policy = trustedTypes
    ? trustedTypes.createPolicy('lit-html', {
        createHTML: (s) => s,
    })
    : undefined;
const identityFunction = (value) => value;
const noopSanitizer = (_node, _name, _type) => identityFunction;
/** Sets the global sanitizer factory. */
const setSanitizer = (newSanitizer) => {
    if (!ENABLE_EXTRA_SECURITY_HOOKS) {
        return;
    }
    if (sanitizerFactoryInternal !== noopSanitizer) {
        throw new Error(`Attempted to overwrite existing lit-html security policy.` +
            ` setSanitizeDOMValueFactory should be called at most once.`);
    }
    sanitizerFactoryInternal = newSanitizer;
};
/**
 * Only used in internal tests, not a part of the public API.
 */
const _testOnlyClearSanitizerFactoryDoNotCallOrElse = () => {
    sanitizerFactoryInternal = noopSanitizer;
};
const createSanitizer = (node, name, type) => {
    return sanitizerFactoryInternal(node, name, type);
};
// Added to an attribute name to mark the attribute as bound so we can find
// it easily.
const boundAttributeSuffix = '$lit$';
// This marker is used in many syntactic positions in HTML, so it must be
// a valid element name and attribute name. We don't support dynamic names (yet)
// but this at least ensures that the parse tree is closer to the template
// intention.
const marker = `lit$${Math.random().toFixed(9).slice(2)}$`;
// String used to tell if a comment is a marker comment
const markerMatch = '?' + marker;
// Text used to insert a comment marker node. We use processing instruction
// syntax because it's slightly smaller, but parses as a comment node.
const nodeMarker = `<${markerMatch}>`;
const d = NODE_MODE && global.document === undefined
    ? {
        createTreeWalker() {
            return {};
        },
    }
    : document;
// Creates a dynamic marker. We never have to search for these in the DOM.
const createMarker = () => d.createComment('');
const isPrimitive = (value) => value === null || (typeof value != 'object' && typeof value != 'function');
const isArray = Array.isArray;
const isIterable = (value) => isArray(value) ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    typeof value?.[Symbol.iterator] === 'function';
const SPACE_CHAR = `[ \t\n\f\r]`;
const ATTR_VALUE_CHAR = `[^ \t\n\f\r"'\`<>=]`;
const NAME_CHAR = `[^\\s"'>=/]`;
// These regexes represent the five parsing states that we care about in the
// Template's HTML scanner. They match the *end* of the state they're named
// after.
// Depending on the match, we transition to a new state. If there's no match,
// we stay in the same state.
// Note that the regexes are stateful. We utilize lastIndex and sync it
// across the multiple regexes used. In addition to the five regexes below
// we also dynamically create a regex to find the matching end tags for raw
// text elements.
/**
 * End of text is: `<` followed by:
 *   (comment start) or (tag) or (dynamic tag binding)
 */
const textEndRegex = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g;
const COMMENT_START = 1;
const TAG_NAME = 2;
const DYNAMIC_TAG_NAME = 3;
const commentEndRegex = /-->/g;
/**
 * Comments not started with <!--, like </{, can be ended by a single `>`
 */
const comment2EndRegex = />/g;
/**
 * The tagEnd regex matches the end of the "inside an opening" tag syntax
 * position. It either matches a `>`, an attribute-like sequence, or the end
 * of the string after a space (attribute-name position ending).
 *
 * See attributes in the HTML spec:
 * https://www.w3.org/TR/html5/syntax.html#elements-attributes
 *
 * " \t\n\f\r" are HTML space characters:
 * https://infra.spec.whatwg.org/#ascii-whitespace
 *
 * So an attribute is:
 *  * The name: any character except a whitespace character, ("), ('), ">",
 *    "=", or "/". Note: this is different from the HTML spec which also excludes control characters.
 *  * Followed by zero or more space characters
 *  * Followed by "="
 *  * Followed by zero or more space characters
 *  * Followed by:
 *    * Any character except space, ('), ("), "<", ">", "=", (`), or
 *    * (") then any non-("), or
 *    * (') then any non-(')
 */
const tagEndRegex = new RegExp(`>|${SPACE_CHAR}(?:(${NAME_CHAR}+)(${SPACE_CHAR}*=${SPACE_CHAR}*(?:${ATTR_VALUE_CHAR}|("|')|))|$)`, 'g');
const ENTIRE_MATCH = 0;
const ATTRIBUTE_NAME = 1;
const SPACES_AND_EQUALS = 2;
const QUOTE_CHAR = 3;
const singleQuoteAttrEndRegex = /'/g;
const doubleQuoteAttrEndRegex = /"/g;
/**
 * Matches the raw text elements.
 *
 * Comments are not parsed within raw text elements, so we need to search their
 * text content for marker strings.
 */
const rawTextElement = /^(?:script|style|textarea|title)$/i;
/** TemplateResult types */
const HTML_RESULT = 1;
const SVG_RESULT = 2;
const MATHML_RESULT = 3;
// TemplatePart types
// IMPORTANT: these must match the values in PartType
const ATTRIBUTE_PART = 1;
const CHILD_PART = 2;
const PROPERTY_PART = 3;
const BOOLEAN_ATTRIBUTE_PART = 4;
const EVENT_PART = 5;
const ELEMENT_PART = 6;
const COMMENT_PART = 7;
/**
 * Generates a template literal tag function that returns a TemplateResult with
 * the given result type.
 */
const tag = (type) => (strings, ...values) => {
    // Warn against templates octal escape sequences
    // We do this here rather than in render so that the warning is closer to the
    // template definition.
    if (DEV_MODE && strings.some((s) => s === undefined)) {
        console.warn('Some template strings are undefined.\n' +
            'This is probably caused by illegal octal escape sequences.');
    }
    if (DEV_MODE) {
        // Import static-html.js results in a circular dependency which g3 doesn't
        // handle. Instead we know that static values must have the field
        // `_$litStatic$`.
        if (values.some((val) => val?.['_$litStatic$'])) {
            issueWarning('', `Static values 'literal' or 'unsafeStatic' cannot be used as values to non-static templates.\n` +
                `Please use the static 'html' tag function. See https://lit.dev/docs/templates/expressions/#static-expressions`);
        }
    }
    return {
        // This property needs to remain unminified.
        ['_$litType$']: type,
        strings,
        values,
    };
};
/**
 * Interprets a template literal as an HTML template that can efficiently
 * render to and update a container.
 *
 * ```ts
 * const header = (title: string) => html`<h1>${title}</h1>`;
 * ```
 *
 * The `html` tag returns a description of the DOM to render as a value. It is
 * lazy, meaning no work is done until the template is rendered. When rendering,
 * if a template comes from the same expression as a previously rendered result,
 * it's efficiently updated instead of replaced.
 */
const html = tag(HTML_RESULT);
/**
 * Interprets a template literal as an SVG fragment that can efficiently render
 * to and update a container.
 *
 * ```ts
 * const rect = svg`<rect width="10" height="10"></rect>`;
 *
 * const myImage = html`
 *   <svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg">
 *     ${rect}
 *   </svg>`;
 * ```
 *
 * The `svg` *tag function* should only be used for SVG fragments, or elements
 * that would be contained **inside** an `<svg>` HTML element. A common error is
 * placing an `<svg>` *element* in a template tagged with the `svg` tag
 * function. The `<svg>` element is an HTML element and should be used within a
 * template tagged with the {@linkcode html} tag function.
 *
 * In LitElement usage, it's invalid to return an SVG fragment from the
 * `render()` method, as the SVG fragment will be contained within the element's
 * shadow root and thus not be properly contained within an `<svg>` HTML
 * element.
 */
const svg = tag(SVG_RESULT);
/**
 * Interprets a template literal as MathML fragment that can efficiently render
 * to and update a container.
 *
 * ```ts
 * const num = mathml`<mn>1</mn>`;
 *
 * const eq = html`
 *   <math>
 *     ${num}
 *   </math>`;
 * ```
 *
 * The `mathml` *tag function* should only be used for MathML fragments, or
 * elements that would be contained **inside** a `<math>` HTML element. A common
 * error is placing a `<math>` *element* in a template tagged with the `mathml`
 * tag function. The `<math>` element is an HTML element and should be used
 * within a template tagged with the {@linkcode html} tag function.
 *
 * In LitElement usage, it's invalid to return an MathML fragment from the
 * `render()` method, as the MathML fragment will be contained within the
 * element's shadow root and thus not be properly contained within a `<math>`
 * HTML element.
 */
const mathml = tag(MATHML_RESULT);
/**
 * A sentinel value that signals that a value was handled by a directive and
 * should not be written to the DOM.
 */
const noChange = Symbol.for('lit-noChange');
/**
 * A sentinel value that signals a ChildPart to fully clear its content.
 *
 * ```ts
 * const button = html`${
 *  user.isAdmin
 *    ? html`<button>DELETE</button>`
 *    : nothing
 * }`;
 * ```
 *
 * Prefer using `nothing` over other falsy values as it provides a consistent
 * behavior between various expression binding contexts.
 *
 * In child expressions, `undefined`, `null`, `''`, and `nothing` all behave the
 * same and render no nodes. In attribute expressions, `nothing` _removes_ the
 * attribute, while `undefined` and `null` will render an empty string. In
 * property expressions `nothing` becomes `undefined`.
 */
const nothing = Symbol.for('lit-nothing');
/**
 * The cache of prepared templates, keyed by the tagged TemplateStringsArray
 * and _not_ accounting for the specific template tag used. This means that
 * template tags cannot be dynamic - they must statically be one of html, svg,
 * or attr. This restriction simplifies the cache lookup, which is on the hot
 * path for rendering.
 */
const templateCache = new WeakMap();
const walker = d.createTreeWalker(d, 129 /* NodeFilter.SHOW_{ELEMENT|COMMENT} */);
let sanitizerFactoryInternal = noopSanitizer;
function trustFromTemplateString(tsa, stringFromTSA) {
    // A security check to prevent spoofing of Lit template results.
    // In the future, we may be able to replace this with Array.isTemplateObject,
    // though we might need to make that check inside of the html and svg
    // functions, because precompiled templates don't come in as
    // TemplateStringArray objects.
    if (!isArray(tsa) || !tsa.hasOwnProperty('raw')) {
        let message = 'invalid template strings array';
        if (DEV_MODE) {
            message = `
          Internal Error: expected template strings to be an array
          with a 'raw' field. Faking a template strings array by
          calling html or svg like an ordinary function is effectively
          the same as calling unsafeHtml and can lead to major security
          issues, e.g. opening your code up to XSS attacks.
          If you're using the html or svg tagged template functions normally
          and still seeing this error, please file a bug at
          https://github.com/lit/lit/issues/new?template=bug_report.md
          and include information about your build tooling, if any.
        `
                .trim()
                .replace(/\n */g, '\n');
        }
        throw new Error(message);
    }
    return policy !== undefined
        ? policy.createHTML(stringFromTSA)
        : stringFromTSA;
}
/**
 * Returns an HTML string for the given TemplateStringsArray and result type
 * (HTML or SVG), along with the case-sensitive bound attribute names in
 * template order. The HTML contains comment markers denoting the `ChildPart`s
 * and suffixes on bound attributes denoting the `AttributeParts`.
 *
 * @param strings template strings array
 * @param type HTML or SVG
 * @return Array containing `[html, attrNames]` (array returned for terseness,
 *     to avoid object fields since this code is shared with non-minified SSR
 *     code)
 */
const getTemplateHtml = (strings, type) => {
    // Insert makers into the template HTML to represent the position of
    // bindings. The following code scans the template strings to determine the
    // syntactic position of the bindings. They can be in text position, where
    // we insert an HTML comment, attribute value position, where we insert a
    // sentinel string and re-write the attribute name, or inside a tag where
    // we insert the sentinel string.
    const l = strings.length - 1;
    // Stores the case-sensitive bound attribute names in the order of their
    // parts. ElementParts are also reflected in this array as undefined
    // rather than a string, to disambiguate from attribute bindings.
    const attrNames = [];
    let html = type === SVG_RESULT ? '<svg>' : type === MATHML_RESULT ? '<math>' : '';
    // When we're inside a raw text tag (not it's text content), the regex
    // will still be tagRegex so we can find attributes, but will switch to
    // this regex when the tag ends.
    let rawTextEndRegex;
    // The current parsing state, represented as a reference to one of the
    // regexes
    let regex = textEndRegex;
    for (let i = 0; i < l; i++) {
        const s = strings[i];
        // The index of the end of the last attribute name. When this is
        // positive at end of a string, it means we're in an attribute value
        // position and need to rewrite the attribute name.
        // We also use a special value of -2 to indicate that we encountered
        // the end of a string in attribute name position.
        let attrNameEndIndex = -1;
        let attrName;
        let lastIndex = 0;
        let match;
        // The conditions in this loop handle the current parse state, and the
        // assignments to the `regex` variable are the state transitions.
        while (lastIndex < s.length) {
            // Make sure we start searching from where we previously left off
            regex.lastIndex = lastIndex;
            match = regex.exec(s);
            if (match === null) {
                break;
            }
            lastIndex = regex.lastIndex;
            if (regex === textEndRegex) {
                if (match[COMMENT_START] === '!--') {
                    regex = commentEndRegex;
                }
                else if (match[COMMENT_START] !== undefined) {
                    // We started a weird comment, like </{
                    regex = comment2EndRegex;
                }
                else if (match[TAG_NAME] !== undefined) {
                    if (rawTextElement.test(match[TAG_NAME])) {
                        // Record if we encounter a raw-text element. We'll switch to
                        // this regex at the end of the tag.
                        rawTextEndRegex = new RegExp(`</${match[TAG_NAME]}`, 'g');
                    }
                    regex = tagEndRegex;
                }
                else if (match[DYNAMIC_TAG_NAME] !== undefined) {
                    if (DEV_MODE) {
                        throw new Error('Bindings in tag names are not supported. Please use static templates instead. ' +
                            'See https://lit.dev/docs/templates/expressions/#static-expressions');
                    }
                    regex = tagEndRegex;
                }
            }
            else if (regex === tagEndRegex) {
                if (match[ENTIRE_MATCH] === '>') {
                    // End of a tag. If we had started a raw-text element, use that
                    // regex
                    regex = rawTextEndRegex ?? textEndRegex;
                    // We may be ending an unquoted attribute value, so make sure we
                    // clear any pending attrNameEndIndex
                    attrNameEndIndex = -1;
                }
                else if (match[ATTRIBUTE_NAME] === undefined) {
                    // Attribute name position
                    attrNameEndIndex = -2;
                }
                else {
                    attrNameEndIndex = regex.lastIndex - match[SPACES_AND_EQUALS].length;
                    attrName = match[ATTRIBUTE_NAME];
                    regex =
                        match[QUOTE_CHAR] === undefined
                            ? tagEndRegex
                            : match[QUOTE_CHAR] === '"'
                                ? doubleQuoteAttrEndRegex
                                : singleQuoteAttrEndRegex;
                }
            }
            else if (regex === doubleQuoteAttrEndRegex ||
                regex === singleQuoteAttrEndRegex) {
                regex = tagEndRegex;
            }
            else if (regex === commentEndRegex || regex === comment2EndRegex) {
                regex = textEndRegex;
            }
            else {
                // Not one of the five state regexes, so it must be the dynamically
                // created raw text regex and we're at the close of that element.
                regex = tagEndRegex;
                rawTextEndRegex = undefined;
            }
        }
        if (DEV_MODE) {
            // If we have a attrNameEndIndex, which indicates that we should
            // rewrite the attribute name, assert that we're in a valid attribute
            // position - either in a tag, or a quoted attribute value.
            console.assert(attrNameEndIndex === -1 ||
                regex === tagEndRegex ||
                regex === singleQuoteAttrEndRegex ||
                regex === doubleQuoteAttrEndRegex, 'unexpected parse state B');
        }
        // We have four cases:
        //  1. We're in text position, and not in a raw text element
        //     (regex === textEndRegex): insert a comment marker.
        //  2. We have a non-negative attrNameEndIndex which means we need to
        //     rewrite the attribute name to add a bound attribute suffix.
        //  3. We're at the non-first binding in a multi-binding attribute, use a
        //     plain marker.
        //  4. We're somewhere else inside the tag. If we're in attribute name
        //     position (attrNameEndIndex === -2), add a sequential suffix to
        //     generate a unique attribute name.
        // Detect a binding next to self-closing tag end and insert a space to
        // separate the marker from the tag end:
        const end = regex === tagEndRegex && strings[i + 1].startsWith('/>') ? ' ' : '';
        html +=
            regex === textEndRegex
                ? s + nodeMarker
                : attrNameEndIndex >= 0
                    ? (attrNames.push(attrName),
                        s.slice(0, attrNameEndIndex) +
                            boundAttributeSuffix +
                            s.slice(attrNameEndIndex)) +
                        marker +
                        end
                    : s + marker + (attrNameEndIndex === -2 ? i : end);
    }
    const htmlResult = html +
        (strings[l] || '<?>') +
        (type === SVG_RESULT ? '</svg>' : type === MATHML_RESULT ? '</math>' : '');
    // Returned as an array for terseness
    return [trustFromTemplateString(strings, htmlResult), attrNames];
};
class Template {
    constructor(
    // This property needs to remain unminified.
    { strings, ['_$litType$']: type }, options) {
        this.parts = [];
        let node;
        let nodeIndex = 0;
        let attrNameIndex = 0;
        const partCount = strings.length - 1;
        const parts = this.parts;
        // Create template element
        const [html, attrNames] = getTemplateHtml(strings, type);
        this.el = Template.createElement(html, options);
        walker.currentNode = this.el.content;
        // Re-parent SVG or MathML nodes into template root
        if (type === SVG_RESULT || type === MATHML_RESULT) {
            const wrapper = this.el.content.firstChild;
            wrapper.replaceWith(...wrapper.childNodes);
        }
        // Walk the template to find binding markers and create TemplateParts
        while ((node = walker.nextNode()) !== null && parts.length < partCount) {
            if (node.nodeType === 1) {
                if (DEV_MODE) {
                    const tag = node.localName;
                    // Warn if `textarea` includes an expression and throw if `template`
                    // does since these are not supported. We do this by checking
                    // innerHTML for anything that looks like a marker. This catches
                    // cases like bindings in textarea there markers turn into text nodes.
                    if (/^(?:textarea|template)$/i.test(tag) &&
                        node.innerHTML.includes(marker)) {
                        const m = `Expressions are not supported inside \`${tag}\` ` +
                            `elements. See https://lit.dev/msg/expression-in-${tag} for more ` +
                            `information.`;
                        if (tag === 'template') {
                            throw new Error(m);
                        }
                        else
                            issueWarning('', m);
                    }
                }
                // TODO (justinfagnani): for attempted dynamic tag names, we don't
                // increment the bindingIndex, and it'll be off by 1 in the element
                // and off by two after it.
                if (node.hasAttributes()) {
                    for (const name of node.getAttributeNames()) {
                        if (name.endsWith(boundAttributeSuffix)) {
                            const realName = attrNames[attrNameIndex++];
                            const value = node.getAttribute(name);
                            const statics = value.split(marker);
                            const m = /([.?@])?(.*)/.exec(realName);
                            parts.push({
                                type: ATTRIBUTE_PART,
                                index: nodeIndex,
                                name: m[2],
                                strings: statics,
                                ctor: m[1] === '.'
                                    ? PropertyPart
                                    : m[1] === '?'
                                        ? BooleanAttributePart
                                        : m[1] === '@'
                                            ? EventPart
                                            : AttributePart,
                            });
                            node.removeAttribute(name);
                        }
                        else if (name.startsWith(marker)) {
                            parts.push({
                                type: ELEMENT_PART,
                                index: nodeIndex,
                            });
                            node.removeAttribute(name);
                        }
                    }
                }
                // TODO (justinfagnani): benchmark the regex against testing for each
                // of the 3 raw text element names.
                if (rawTextElement.test(node.tagName)) {
                    // For raw text elements we need to split the text content on
                    // markers, create a Text node for each segment, and create
                    // a TemplatePart for each marker.
                    const strings = node.textContent.split(marker);
                    const lastIndex = strings.length - 1;
                    if (lastIndex > 0) {
                        node.textContent = trustedTypes
                            ? trustedTypes.emptyScript
                            : '';
                        // Generate a new text node for each literal section
                        // These nodes are also used as the markers for child parts
                        for (let i = 0; i < lastIndex; i++) {
                            node.append(strings[i], createMarker());
                            // Walk past the marker node we just added
                            walker.nextNode();
                            parts.push({ type: CHILD_PART, index: ++nodeIndex });
                        }
                        // Note because this marker is added after the walker's current
                        // node, it will be walked to in the outer loop (and ignored), so
                        // we don't need to adjust nodeIndex here
                        node.append(strings[lastIndex], createMarker());
                    }
                }
            }
            else if (node.nodeType === 8) {
                const data = node.data;
                if (data === markerMatch) {
                    parts.push({ type: CHILD_PART, index: nodeIndex });
                }
                else {
                    let i = -1;
                    while ((i = node.data.indexOf(marker, i + 1)) !== -1) {
                        // Comment node has a binding marker inside, make an inactive part
                        // The binding won't work, but subsequent bindings will
                        parts.push({ type: COMMENT_PART, index: nodeIndex });
                        // Move to the end of the match
                        i += marker.length - 1;
                    }
                }
            }
            nodeIndex++;
        }
        if (DEV_MODE) {
            // If there was a duplicate attribute on a tag, then when the tag is
            // parsed into an element the attribute gets de-duplicated. We can detect
            // this mismatch if we haven't precisely consumed every attribute name
            // when preparing the template. This works because `attrNames` is built
            // from the template string and `attrNameIndex` comes from processing the
            // resulting DOM.
            if (attrNames.length !== attrNameIndex) {
                throw new Error(`Detected duplicate attribute bindings. This occurs if your template ` +
                    `has duplicate attributes on an element tag. For example ` +
                    `"<input ?disabled=\${true} ?disabled=\${false}>" contains a ` +
                    `duplicate "disabled" attribute. The error was detected in ` +
                    `the following template: \n` +
                    '`' +
                    strings.join('${...}') +
                    '`');
            }
        }
        // We could set walker.currentNode to another node here to prevent a memory
        // leak, but every time we prepare a template, we immediately render it
        // and re-use the walker in new TemplateInstance._clone().
        debugLogEvent &&
            debugLogEvent({
                kind: 'template prep',
                template: this,
                clonableTemplate: this.el,
                parts: this.parts,
                strings,
            });
    }
    // Overridden via `litHtmlPolyfillSupport` to provide platform support.
    /** @nocollapse */
    static createElement(html, _options) {
        const el = d.createElement('template');
        el.innerHTML = html;
        return el;
    }
}
function resolveDirective(part, value, parent = part, attributeIndex) {
    // Bail early if the value is explicitly noChange. Note, this means any
    // nested directive is still attached and is not run.
    if (value === noChange) {
        return value;
    }
    let currentDirective = attributeIndex !== undefined
        ? parent.__directives?.[attributeIndex]
        : parent.__directive;
    const nextDirectiveConstructor = isPrimitive(value)
        ? undefined
        : // This property needs to remain unminified.
            value['_$litDirective$'];
    if (currentDirective?.constructor !== nextDirectiveConstructor) {
        // This property needs to remain unminified.
        currentDirective?.['_$notifyDirectiveConnectionChanged']?.(false);
        if (nextDirectiveConstructor === undefined) {
            currentDirective = undefined;
        }
        else {
            currentDirective = new nextDirectiveConstructor(part);
            currentDirective._$initialize(part, parent, attributeIndex);
        }
        if (attributeIndex !== undefined) {
            (parent.__directives ??= [])[attributeIndex] =
                currentDirective;
        }
        else {
            parent.__directive = currentDirective;
        }
    }
    if (currentDirective !== undefined) {
        value = resolveDirective(part, currentDirective._$resolve(part, value.values), currentDirective, attributeIndex);
    }
    return value;
}
/**
 * An updateable instance of a Template. Holds references to the Parts used to
 * update the template instance.
 */
class TemplateInstance {
    constructor(template, parent) {
        this._$parts = [];
        /** @internal */
        this._$disconnectableChildren = undefined;
        this._$template = template;
        this._$parent = parent;
    }
    // Called by ChildPart parentNode getter
    get parentNode() {
        return this._$parent.parentNode;
    }
    // See comment in Disconnectable interface for why this is a getter
    get _$isConnected() {
        return this._$parent._$isConnected;
    }
    // This method is separate from the constructor because we need to return a
    // DocumentFragment and we don't want to hold onto it with an instance field.
    _clone(options) {
        const { el: { content }, parts: parts, } = this._$template;
        const fragment = (options?.creationScope ?? d).importNode(content, true);
        walker.currentNode = fragment;
        let node = walker.nextNode();
        let nodeIndex = 0;
        let partIndex = 0;
        let templatePart = parts[0];
        while (templatePart !== undefined) {
            if (nodeIndex === templatePart.index) {
                let part;
                if (templatePart.type === CHILD_PART) {
                    part = new ChildPart(node, node.nextSibling, this, options);
                }
                else if (templatePart.type === ATTRIBUTE_PART) {
                    part = new templatePart.ctor(node, templatePart.name, templatePart.strings, this, options);
                }
                else if (templatePart.type === ELEMENT_PART) {
                    part = new ElementPart(node, this, options);
                }
                this._$parts.push(part);
                templatePart = parts[++partIndex];
            }
            if (nodeIndex !== templatePart?.index) {
                node = walker.nextNode();
                nodeIndex++;
            }
        }
        // We need to set the currentNode away from the cloned tree so that we
        // don't hold onto the tree even if the tree is detached and should be
        // freed.
        walker.currentNode = d;
        return fragment;
    }
    _update(values) {
        let i = 0;
        for (const part of this._$parts) {
            if (part !== undefined) {
                debugLogEvent &&
                    debugLogEvent({
                        kind: 'set part',
                        part,
                        value: values[i],
                        valueIndex: i,
                        values,
                        templateInstance: this,
                    });
                if (part.strings !== undefined) {
                    part._$setValue(values, part, i);
                    // The number of values the part consumes is part.strings.length - 1
                    // since values are in between template spans. We increment i by 1
                    // later in the loop, so increment it by part.strings.length - 2 here
                    i += part.strings.length - 2;
                }
                else {
                    part._$setValue(values[i]);
                }
            }
            i++;
        }
    }
}
class ChildPart {
    // See comment in Disconnectable interface for why this is a getter
    get _$isConnected() {
        // ChildParts that are not at the root should always be created with a
        // parent; only RootChildNode's won't, so they return the local isConnected
        // state
        return this._$parent?._$isConnected ?? this.__isConnected;
    }
    constructor(startNode, endNode, parent, options) {
        this.type = CHILD_PART;
        this._$committedValue = nothing;
        // The following fields will be patched onto ChildParts when required by
        // AsyncDirective
        /** @internal */
        this._$disconnectableChildren = undefined;
        this._$startNode = startNode;
        this._$endNode = endNode;
        this._$parent = parent;
        this.options = options;
        // Note __isConnected is only ever accessed on RootParts (i.e. when there is
        // no _$parent); the value on a non-root-part is "don't care", but checking
        // for parent would be more code
        this.__isConnected = options?.isConnected ?? true;
        if (ENABLE_EXTRA_SECURITY_HOOKS) {
            // Explicitly initialize for consistent class shape.
            this._textSanitizer = undefined;
        }
    }
    /**
     * The parent node into which the part renders its content.
     *
     * A ChildPart's content consists of a range of adjacent child nodes of
     * `.parentNode`, possibly bordered by 'marker nodes' (`.startNode` and
     * `.endNode`).
     *
     * - If both `.startNode` and `.endNode` are non-null, then the part's content
     * consists of all siblings between `.startNode` and `.endNode`, exclusively.
     *
     * - If `.startNode` is non-null but `.endNode` is null, then the part's
     * content consists of all siblings following `.startNode`, up to and
     * including the last child of `.parentNode`. If `.endNode` is non-null, then
     * `.startNode` will always be non-null.
     *
     * - If both `.endNode` and `.startNode` are null, then the part's content
     * consists of all child nodes of `.parentNode`.
     */
    get parentNode() {
        let parentNode = wrap(this._$startNode).parentNode;
        const parent = this._$parent;
        if (parent !== undefined &&
            parentNode?.nodeType === 11 /* Node.DOCUMENT_FRAGMENT */) {
            // If the parentNode is a DocumentFragment, it may be because the DOM is
            // still in the cloned fragment during initial render; if so, get the real
            // parentNode the part will be committed into by asking the parent.
            parentNode = parent.parentNode;
        }
        return parentNode;
    }
    /**
     * The part's leading marker node, if any. See `.parentNode` for more
     * information.
     */
    get startNode() {
        return this._$startNode;
    }
    /**
     * The part's trailing marker node, if any. See `.parentNode` for more
     * information.
     */
    get endNode() {
        return this._$endNode;
    }
    _$setValue(value, directiveParent = this) {
        if (DEV_MODE && this.parentNode === null) {
            throw new Error(`This \`ChildPart\` has no \`parentNode\` and therefore cannot accept a value. This likely means the element containing the part was manipulated in an unsupported way outside of Lit's control such that the part's marker nodes were ejected from DOM. For example, setting the element's \`innerHTML\` or \`textContent\` can do this.`);
        }
        value = resolveDirective(this, value, directiveParent);
        if (isPrimitive(value)) {
            // Non-rendering child values. It's important that these do not render
            // empty text nodes to avoid issues with preventing default <slot>
            // fallback content.
            if (value === nothing || value == null || value === '') {
                if (this._$committedValue !== nothing) {
                    debugLogEvent &&
                        debugLogEvent({
                            kind: 'commit nothing to child',
                            start: this._$startNode,
                            end: this._$endNode,
                            parent: this._$parent,
                            options: this.options,
                        });
                    this._$clear();
                }
                this._$committedValue = nothing;
            }
            else if (value !== this._$committedValue && value !== noChange) {
                this._commitText(value);
            }
            // This property needs to remain unminified.
        }
        else if (value['_$litType$'] !== undefined) {
            this._commitTemplateResult(value);
        }
        else if (value.nodeType !== undefined) {
            if (DEV_MODE && this.options?.host === value) {
                this._commitText(`[probable mistake: rendered a template's host in itself ` +
                    `(commonly caused by writing \${this} in a template]`);
                console.warn(`Attempted to render the template host`, value, `inside itself. This is almost always a mistake, and in dev mode `, `we render some warning text. In production however, we'll `, `render it, which will usually result in an error, and sometimes `, `in the element disappearing from the DOM.`);
                return;
            }
            this._commitNode(value);
        }
        else if (isIterable(value)) {
            this._commitIterable(value);
        }
        else {
            // Fallback, will render the string representation
            this._commitText(value);
        }
    }
    _insert(node) {
        return wrap(wrap(this._$startNode).parentNode).insertBefore(node, this._$endNode);
    }
    _commitNode(value) {
        if (this._$committedValue !== value) {
            this._$clear();
            if (ENABLE_EXTRA_SECURITY_HOOKS &&
                sanitizerFactoryInternal !== noopSanitizer) {
                const parentNodeName = this._$startNode.parentNode?.nodeName;
                if (parentNodeName === 'STYLE' || parentNodeName === 'SCRIPT') {
                    let message = 'Forbidden';
                    if (DEV_MODE) {
                        if (parentNodeName === 'STYLE') {
                            message =
                                `Lit does not support binding inside style nodes. ` +
                                    `This is a security risk, as style injection attacks can ` +
                                    `exfiltrate data and spoof UIs. ` +
                                    `Consider instead using css\`...\` literals ` +
                                    `to compose styles, and do dynamic styling with ` +
                                    `css custom properties, ::parts, <slot>s, ` +
                                    `and by mutating the DOM rather than stylesheets.`;
                        }
                        else {
                            message =
                                `Lit does not support binding inside script nodes. ` +
                                    `This is a security risk, as it could allow arbitrary ` +
                                    `code execution.`;
                        }
                    }
                    throw new Error(message);
                }
            }
            debugLogEvent &&
                debugLogEvent({
                    kind: 'commit node',
                    start: this._$startNode,
                    parent: this._$parent,
                    value: value,
                    options: this.options,
                });
            this._$committedValue = this._insert(value);
        }
    }
    _commitText(value) {
        // If the committed value is a primitive it means we called _commitText on
        // the previous render, and we know that this._$startNode.nextSibling is a
        // Text node. We can now just replace the text content (.data) of the node.
        if (this._$committedValue !== nothing &&
            isPrimitive(this._$committedValue)) {
            const node = wrap(this._$startNode).nextSibling;
            if (ENABLE_EXTRA_SECURITY_HOOKS) {
                if (this._textSanitizer === undefined) {
                    this._textSanitizer = createSanitizer(node, 'data', 'property');
                }
                value = this._textSanitizer(value);
            }
            debugLogEvent &&
                debugLogEvent({
                    kind: 'commit text',
                    node,
                    value,
                    options: this.options,
                });
            node.data = value;
        }
        else {
            if (ENABLE_EXTRA_SECURITY_HOOKS) {
                const textNode = d.createTextNode('');
                this._commitNode(textNode);
                // When setting text content, for security purposes it matters a lot
                // what the parent is. For example, <style> and <script> need to be
                // handled with care, while <span> does not. So first we need to put a
                // text node into the document, then we can sanitize its content.
                if (this._textSanitizer === undefined) {
                    this._textSanitizer = createSanitizer(textNode, 'data', 'property');
                }
                value = this._textSanitizer(value);
                debugLogEvent &&
                    debugLogEvent({
                        kind: 'commit text',
                        node: textNode,
                        value,
                        options: this.options,
                    });
                textNode.data = value;
            }
            else {
                this._commitNode(d.createTextNode(value));
                debugLogEvent &&
                    debugLogEvent({
                        kind: 'commit text',
                        node: wrap(this._$startNode).nextSibling,
                        value,
                        options: this.options,
                    });
            }
        }
        this._$committedValue = value;
    }
    _commitTemplateResult(result) {
        // This property needs to remain unminified.
        const { values, ['_$litType$']: type } = result;
        // If $litType$ is a number, result is a plain TemplateResult and we get
        // the template from the template cache. If not, result is a
        // CompiledTemplateResult and _$litType$ is a CompiledTemplate and we need
        // to create the <template> element the first time we see it.
        const template = typeof type === 'number'
            ? this._$getTemplate(result)
            : (type.el === undefined &&
                (type.el = Template.createElement(trustFromTemplateString(type.h, type.h[0]), this.options)),
                type);
        if (this._$committedValue?._$template === template) {
            debugLogEvent &&
                debugLogEvent({
                    kind: 'template updating',
                    template,
                    instance: this._$committedValue,
                    parts: this._$committedValue._$parts,
                    options: this.options,
                    values,
                });
            this._$committedValue._update(values);
        }
        else {
            const instance = new TemplateInstance(template, this);
            const fragment = instance._clone(this.options);
            debugLogEvent &&
                debugLogEvent({
                    kind: 'template instantiated',
                    template,
                    instance,
                    parts: instance._$parts,
                    options: this.options,
                    fragment,
                    values,
                });
            instance._update(values);
            debugLogEvent &&
                debugLogEvent({
                    kind: 'template instantiated and updated',
                    template,
                    instance,
                    parts: instance._$parts,
                    options: this.options,
                    fragment,
                    values,
                });
            this._commitNode(fragment);
            this._$committedValue = instance;
        }
    }
    // Overridden via `litHtmlPolyfillSupport` to provide platform support.
    /** @internal */
    _$getTemplate(result) {
        let template = templateCache.get(result.strings);
        if (template === undefined) {
            templateCache.set(result.strings, (template = new Template(result)));
        }
        return template;
    }
    _commitIterable(value) {
        // For an Iterable, we create a new InstancePart per item, then set its
        // value to the item. This is a little bit of overhead for every item in
        // an Iterable, but it lets us recurse easily and efficiently update Arrays
        // of TemplateResults that will be commonly returned from expressions like:
        // array.map((i) => html`${i}`), by reusing existing TemplateInstances.
        // If value is an array, then the previous render was of an
        // iterable and value will contain the ChildParts from the previous
        // render. If value is not an array, clear this part and make a new
        // array for ChildParts.
        if (!isArray(this._$committedValue)) {
            this._$committedValue = [];
            this._$clear();
        }
        // Lets us keep track of how many items we stamped so we can clear leftover
        // items from a previous render
        const itemParts = this._$committedValue;
        let partIndex = 0;
        let itemPart;
        for (const item of value) {
            if (partIndex === itemParts.length) {
                // If no existing part, create a new one
                // TODO (justinfagnani): test perf impact of always creating two parts
                // instead of sharing parts between nodes
                // https://github.com/lit/lit/issues/1266
                itemParts.push((itemPart = new ChildPart(this._insert(createMarker()), this._insert(createMarker()), this, this.options)));
            }
            else {
                // Reuse an existing part
                itemPart = itemParts[partIndex];
            }
            itemPart._$setValue(item);
            partIndex++;
        }
        if (partIndex < itemParts.length) {
            // itemParts always have end nodes
            this._$clear(itemPart && wrap(itemPart._$endNode).nextSibling, partIndex);
            // Truncate the parts array so _value reflects the current state
            itemParts.length = partIndex;
        }
    }
    /**
     * Removes the nodes contained within this Part from the DOM.
     *
     * @param start Start node to clear from, for clearing a subset of the part's
     *     DOM (used when truncating iterables)
     * @param from  When `start` is specified, the index within the iterable from
     *     which ChildParts are being removed, used for disconnecting directives
     *     in those Parts.
     *
     * @internal
     */
    _$clear(start = wrap(this._$startNode).nextSibling, from) {
        this._$notifyConnectionChanged?.(false, true, from);
        while (start !== this._$endNode) {
            // The non-null assertion is safe because if _$startNode.nextSibling is
            // null, then _$endNode is also null, and we would not have entered this
            // loop.
            const n = wrap(start).nextSibling;
            wrap(start).remove();
            start = n;
        }
    }
    /**
     * Implementation of RootPart's `isConnected`. Note that this method
     * should only be called on `RootPart`s (the `ChildPart` returned from a
     * top-level `render()` call). It has no effect on non-root ChildParts.
     * @param isConnected Whether to set
     * @internal
     */
    setConnected(isConnected) {
        if (this._$parent === undefined) {
            this.__isConnected = isConnected;
            this._$notifyConnectionChanged?.(isConnected);
        }
        else if (DEV_MODE) {
            throw new Error('part.setConnected() may only be called on a ' +
                'RootPart returned from render().');
        }
    }
}
class AttributePart {
    get tagName() {
        return this.element.tagName;
    }
    // See comment in Disconnectable interface for why this is a getter
    get _$isConnected() {
        return this._$parent._$isConnected;
    }
    constructor(element, name, strings, parent, options) {
        this.type = ATTRIBUTE_PART;
        /** @internal */
        this._$committedValue = nothing;
        /** @internal */
        this._$disconnectableChildren = undefined;
        this.element = element;
        this.name = name;
        this._$parent = parent;
        this.options = options;
        if (strings.length > 2 || strings[0] !== '' || strings[1] !== '') {
            this._$committedValue = new Array(strings.length - 1).fill(new String());
            this.strings = strings;
        }
        else {
            this._$committedValue = nothing;
        }
        if (ENABLE_EXTRA_SECURITY_HOOKS) {
            this._sanitizer = undefined;
        }
    }
    /**
     * Sets the value of this part by resolving the value from possibly multiple
     * values and static strings and committing it to the DOM.
     * If this part is single-valued, `this._strings` will be undefined, and the
     * method will be called with a single value argument. If this part is
     * multi-value, `this._strings` will be defined, and the method is called
     * with the value array of the part's owning TemplateInstance, and an offset
     * into the value array from which the values should be read.
     * This method is overloaded this way to eliminate short-lived array slices
     * of the template instance values, and allow a fast-path for single-valued
     * parts.
     *
     * @param value The part value, or an array of values for multi-valued parts
     * @param valueIndex the index to start reading values from. `undefined` for
     *   single-valued parts
     * @param noCommit causes the part to not commit its value to the DOM. Used
     *   in hydration to prime attribute parts with their first-rendered value,
     *   but not set the attribute, and in SSR to no-op the DOM operation and
     *   capture the value for serialization.
     *
     * @internal
     */
    _$setValue(value, directiveParent = this, valueIndex, noCommit) {
        const strings = this.strings;
        // Whether any of the values has changed, for dirty-checking
        let change = false;
        if (strings === undefined) {
            // Single-value binding case
            value = resolveDirective(this, value, directiveParent, 0);
            change =
                !isPrimitive(value) ||
                    (value !== this._$committedValue && value !== noChange);
            if (change) {
                this._$committedValue = value;
            }
        }
        else {
            // Interpolation case
            const values = value;
            value = strings[0];
            let i, v;
            for (i = 0; i < strings.length - 1; i++) {
                v = resolveDirective(this, values[valueIndex + i], directiveParent, i);
                if (v === noChange) {
                    // If the user-provided value is `noChange`, use the previous value
                    v = this._$committedValue[i];
                }
                change ||=
                    !isPrimitive(v) || v !== this._$committedValue[i];
                if (v === nothing) {
                    value = nothing;
                }
                else if (value !== nothing) {
                    value += (v ?? '') + strings[i + 1];
                }
                // We always record each value, even if one is `nothing`, for future
                // change detection.
                this._$committedValue[i] = v;
            }
        }
        if (change && !noCommit) {
            this._commitValue(value);
        }
    }
    /** @internal */
    _commitValue(value) {
        if (value === nothing) {
            wrap(this.element).removeAttribute(this.name);
        }
        else {
            if (ENABLE_EXTRA_SECURITY_HOOKS) {
                if (this._sanitizer === undefined) {
                    this._sanitizer = sanitizerFactoryInternal(this.element, this.name, 'attribute');
                }
                value = this._sanitizer(value ?? '');
            }
            debugLogEvent &&
                debugLogEvent({
                    kind: 'commit attribute',
                    element: this.element,
                    name: this.name,
                    value,
                    options: this.options,
                });
            wrap(this.element).setAttribute(this.name, (value ?? ''));
        }
    }
}
class PropertyPart extends AttributePart {
    constructor() {
        super(...arguments);
        this.type = PROPERTY_PART;
    }
    /** @internal */
    _commitValue(value) {
        if (ENABLE_EXTRA_SECURITY_HOOKS) {
            if (this._sanitizer === undefined) {
                this._sanitizer = sanitizerFactoryInternal(this.element, this.name, 'property');
            }
            value = this._sanitizer(value);
        }
        debugLogEvent &&
            debugLogEvent({
                kind: 'commit property',
                element: this.element,
                name: this.name,
                value,
                options: this.options,
            });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.element[this.name] = value === nothing ? undefined : value;
    }
}
class BooleanAttributePart extends AttributePart {
    constructor() {
        super(...arguments);
        this.type = BOOLEAN_ATTRIBUTE_PART;
    }
    /** @internal */
    _commitValue(value) {
        debugLogEvent &&
            debugLogEvent({
                kind: 'commit boolean attribute',
                element: this.element,
                name: this.name,
                value: !!(value && value !== nothing),
                options: this.options,
            });
        wrap(this.element).toggleAttribute(this.name, !!value && value !== nothing);
    }
}
class EventPart extends AttributePart {
    constructor(element, name, strings, parent, options) {
        super(element, name, strings, parent, options);
        this.type = EVENT_PART;
        if (DEV_MODE && this.strings !== undefined) {
            throw new Error(`A \`<${element.localName}>\` has a \`@${name}=...\` listener with ` +
                'invalid content. Event listeners in templates must have exactly ' +
                'one expression and no surrounding text.');
        }
    }
    // EventPart does not use the base _$setValue/_resolveValue implementation
    // since the dirty checking is more complex
    /** @internal */
    _$setValue(newListener, directiveParent = this) {
        newListener =
            resolveDirective(this, newListener, directiveParent, 0) ?? nothing;
        if (newListener === noChange) {
            return;
        }
        const oldListener = this._$committedValue;
        // If the new value is nothing or any options change we have to remove the
        // part as a listener.
        const shouldRemoveListener = (newListener === nothing && oldListener !== nothing) ||
            newListener.capture !==
                oldListener.capture ||
            newListener.once !==
                oldListener.once ||
            newListener.passive !==
                oldListener.passive;
        // If the new value is not nothing and we removed the listener, we have
        // to add the part as a listener.
        const shouldAddListener = newListener !== nothing &&
            (oldListener === nothing || shouldRemoveListener);
        debugLogEvent &&
            debugLogEvent({
                kind: 'commit event listener',
                element: this.element,
                name: this.name,
                value: newListener,
                options: this.options,
                removeListener: shouldRemoveListener,
                addListener: shouldAddListener,
                oldListener,
            });
        if (shouldRemoveListener) {
            this.element.removeEventListener(this.name, this, oldListener);
        }
        if (shouldAddListener) {
            this.element.addEventListener(this.name, this, newListener);
        }
        this._$committedValue = newListener;
    }
    handleEvent(event) {
        if (typeof this._$committedValue === 'function') {
            this._$committedValue.call(this.options?.host ?? this.element, event);
        }
        else {
            this._$committedValue.handleEvent(event);
        }
    }
}
class ElementPart {
    constructor(element, parent, options) {
        this.element = element;
        this.type = ELEMENT_PART;
        /** @internal */
        this._$disconnectableChildren = undefined;
        this._$parent = parent;
        this.options = options;
    }
    // See comment in Disconnectable interface for why this is a getter
    get _$isConnected() {
        return this._$parent._$isConnected;
    }
    _$setValue(value) {
        debugLogEvent &&
            debugLogEvent({
                kind: 'commit to element binding',
                element: this.element,
                value,
                options: this.options,
            });
        resolveDirective(this, value);
    }
}
/**
 * END USERS SHOULD NOT RELY ON THIS OBJECT.
 *
 * Private exports for use by other Lit packages, not intended for use by
 * external users.
 *
 * We currently do not make a mangled rollup build of the lit-ssr code. In order
 * to keep a number of (otherwise private) top-level exports mangled in the
 * client side code, we export a _$LH object containing those members (or
 * helper methods for accessing private fields of those members), and then
 * re-export them for use in lit-ssr. This keeps lit-ssr agnostic to whether the
 * client-side code is being used in `dev` mode or `prod` mode.
 *
 * This has a unique name, to disambiguate it from private exports in
 * lit-element, which re-exports all of lit-html.
 *
 * @private
 */
const _$LH = {
    // Used in lit-ssr
    _boundAttributeSuffix: boundAttributeSuffix,
    _marker: marker,
    _markerMatch: markerMatch,
    _HTML_RESULT: HTML_RESULT,
    _getTemplateHtml: getTemplateHtml,
    // Used in tests and private-ssr-support
    _TemplateInstance: TemplateInstance,
    _isIterable: isIterable,
    _resolveDirective: resolveDirective,
    _ChildPart: ChildPart,
    _AttributePart: AttributePart,
    _BooleanAttributePart: BooleanAttributePart,
    _EventPart: EventPart,
    _PropertyPart: PropertyPart,
    _ElementPart: ElementPart,
};
// Apply polyfills if available
const polyfillSupport = DEV_MODE
    ? global.litHtmlPolyfillSupportDevMode
    : global.litHtmlPolyfillSupport;
polyfillSupport?.(Template, ChildPart);
// IMPORTANT: do not change the property name or the assignment expression.
// This line will be used in regexes to search for lit-html usage.
(global.litHtmlVersions ??= []).push('3.3.2');
if (DEV_MODE && global.litHtmlVersions.length > 1) {
    queueMicrotask(() => {
        issueWarning('multiple-versions', `Multiple versions of Lit loaded. ` +
            `Loading multiple versions is not recommended.`);
    });
}
/**
 * Renders a value, usually a lit-html TemplateResult, to the container.
 *
 * This example renders the text "Hello, Zoe!" inside a paragraph tag, appending
 * it to the container `document.body`.
 *
 * ```js
 * import {html, render} from 'lit';
 *
 * const name = "Zoe";
 * render(html`<p>Hello, ${name}!</p>`, document.body);
 * ```
 *
 * @param value Any [renderable
 *   value](https://lit.dev/docs/templates/expressions/#child-expressions),
 *   typically a {@linkcode TemplateResult} created by evaluating a template tag
 *   like {@linkcode html} or {@linkcode svg}.
 * @param container A DOM container to render to. The first render will append
 *   the rendered value to the container, and subsequent renders will
 *   efficiently update the rendered value if the same result type was
 *   previously rendered there.
 * @param options See {@linkcode RenderOptions} for options documentation.
 * @see
 * {@link https://lit.dev/docs/libraries/standalone-templates/#rendering-lit-html-templates| Rendering Lit HTML Templates}
 */
const render = (value, container, options) => {
    if (DEV_MODE && container == null) {
        // Give a clearer error message than
        //     Uncaught TypeError: Cannot read properties of null (reading
        //     '_$litPart$')
        // which reads like an internal Lit error.
        throw new TypeError(`The container to render into may not be ${container}`);
    }
    const renderId = DEV_MODE ? debugLogRenderId++ : 0;
    const partOwnerNode = options?.renderBefore ?? container;
    // This property needs to remain unminified.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let part = partOwnerNode['_$litPart$'];
    debugLogEvent &&
        debugLogEvent({
            kind: 'begin render',
            id: renderId,
            value,
            container,
            options,
            part,
        });
    if (part === undefined) {
        const endNode = options?.renderBefore ?? null;
        // This property needs to remain unminified.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        partOwnerNode['_$litPart$'] = part = new ChildPart(container.insertBefore(createMarker(), endNode), endNode, undefined, options ?? {});
    }
    part._$setValue(value);
    debugLogEvent &&
        debugLogEvent({
            kind: 'end render',
            id: renderId,
            value,
            container,
            options,
            part,
        });
    return part;
};
if (ENABLE_EXTRA_SECURITY_HOOKS) {
    render.setSanitizer = setSanitizer;
    render.createSanitizer = createSanitizer;
    if (DEV_MODE) {
        render._testOnlyClearSanitizerFactoryDoNotCallOrElse =
            _testOnlyClearSanitizerFactoryDoNotCallOrElse;
    }
}
//# sourceMappingURL=lit-html.js.map

/***/ },

/***/ "./node_modules/lit/directives/unsafe-html.js"
/*!****************************************************!*\
  !*** ./node_modules/lit/directives/unsafe-html.js ***!
  \****************************************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   UnsafeHTMLDirective: () => (/* reexport safe */ lit_html_directives_unsafe_html_js__WEBPACK_IMPORTED_MODULE_0__.UnsafeHTMLDirective),
/* harmony export */   unsafeHTML: () => (/* reexport safe */ lit_html_directives_unsafe_html_js__WEBPACK_IMPORTED_MODULE_0__.unsafeHTML)
/* harmony export */ });
/* harmony import */ var lit_html_directives_unsafe_html_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! lit-html/directives/unsafe-html.js */ "./node_modules/lit-html/development/directives/unsafe-html.js");

//# sourceMappingURL=unsafe-html.js.map


/***/ },

/***/ "./node_modules/lit/index.js"
/*!***********************************!*\
  !*** ./node_modules/lit/index.js ***!
  \***********************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   CSSResult: () => (/* reexport safe */ lit_element_lit_element_js__WEBPACK_IMPORTED_MODULE_2__.CSSResult),
/* harmony export */   LitElement: () => (/* reexport safe */ lit_element_lit_element_js__WEBPACK_IMPORTED_MODULE_2__.LitElement),
/* harmony export */   ReactiveElement: () => (/* reexport safe */ lit_element_lit_element_js__WEBPACK_IMPORTED_MODULE_2__.ReactiveElement),
/* harmony export */   _$LE: () => (/* reexport safe */ lit_element_lit_element_js__WEBPACK_IMPORTED_MODULE_2__._$LE),
/* harmony export */   _$LH: () => (/* reexport safe */ lit_element_lit_element_js__WEBPACK_IMPORTED_MODULE_2__._$LH),
/* harmony export */   adoptStyles: () => (/* reexport safe */ lit_element_lit_element_js__WEBPACK_IMPORTED_MODULE_2__.adoptStyles),
/* harmony export */   css: () => (/* reexport safe */ lit_element_lit_element_js__WEBPACK_IMPORTED_MODULE_2__.css),
/* harmony export */   defaultConverter: () => (/* reexport safe */ lit_element_lit_element_js__WEBPACK_IMPORTED_MODULE_2__.defaultConverter),
/* harmony export */   getCompatibleStyle: () => (/* reexport safe */ lit_element_lit_element_js__WEBPACK_IMPORTED_MODULE_2__.getCompatibleStyle),
/* harmony export */   html: () => (/* reexport safe */ lit_element_lit_element_js__WEBPACK_IMPORTED_MODULE_2__.html),
/* harmony export */   isServer: () => (/* reexport safe */ lit_html_is_server_js__WEBPACK_IMPORTED_MODULE_3__.isServer),
/* harmony export */   mathml: () => (/* reexport safe */ lit_element_lit_element_js__WEBPACK_IMPORTED_MODULE_2__.mathml),
/* harmony export */   noChange: () => (/* reexport safe */ lit_element_lit_element_js__WEBPACK_IMPORTED_MODULE_2__.noChange),
/* harmony export */   notEqual: () => (/* reexport safe */ lit_element_lit_element_js__WEBPACK_IMPORTED_MODULE_2__.notEqual),
/* harmony export */   nothing: () => (/* reexport safe */ lit_element_lit_element_js__WEBPACK_IMPORTED_MODULE_2__.nothing),
/* harmony export */   render: () => (/* reexport safe */ lit_element_lit_element_js__WEBPACK_IMPORTED_MODULE_2__.render),
/* harmony export */   supportsAdoptingStyleSheets: () => (/* reexport safe */ lit_element_lit_element_js__WEBPACK_IMPORTED_MODULE_2__.supportsAdoptingStyleSheets),
/* harmony export */   svg: () => (/* reexport safe */ lit_element_lit_element_js__WEBPACK_IMPORTED_MODULE_2__.svg),
/* harmony export */   unsafeCSS: () => (/* reexport safe */ lit_element_lit_element_js__WEBPACK_IMPORTED_MODULE_2__.unsafeCSS)
/* harmony export */ });
/* harmony import */ var _lit_reactive_element__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @lit/reactive-element */ "./node_modules/@lit/reactive-element/development/reactive-element.js");
/* harmony import */ var lit_html__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! lit-html */ "./node_modules/lit-html/development/lit-html.js");
/* harmony import */ var lit_element_lit_element_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! lit-element/lit-element.js */ "./node_modules/lit-element/development/lit-element.js");
/* harmony import */ var lit_html_is_server_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lit-html/is-server.js */ "./node_modules/lit-html/development/is-server.js");

//# sourceMappingURL=index.js.map


/***/ },

/***/ "./src/translations/de.json"
/*!**********************************!*\
  !*** ./src/translations/de.json ***!
  \**********************************/
(module) {

module.exports = /*#__PURE__*/JSON.parse('{"dashboard":{"title":"Dynamisches Dashboard"},"views":{"overview":"Übersicht","lights":"Lichter","covers":"Rollos & Abdeckungen","security":"Sicherheit","batteries":"Batterien","climate":"Klima"},"sections":{"overview":"Übersicht","summaries":"Zusammenfassungen","favorites":"Favoriten","custom_cards":"Eigene Karten","areas":"Bereiche","areas_other":"Weitere Bereiche","weather":"Wetter","energy":"Energie"},"summary":{"lights_on_one":"Licht an","lights_on_many":"Lichter an","lights_off":"Alle Lichter aus","covers_open_one":"Rollo offen","covers_open_many":"Rollos offen","covers_closed":"Alle Rollos geschlossen","security_unsafe":"unsicher","security_safe":"Alles gesichert","batteries_critical_one":"Batterie kritisch","batteries_critical_many":"Batterien kritisch","batteries_ok":"Alle Batterien OK","climate_active_one":"Thermostat aktiv","climate_active_many":"Thermostate aktiv","climate_off":"Alle Thermostate aus"},"lights":{"on":"Eingeschaltete Lichter","off":"Ausgeschaltete Lichter","all_off":"Alle aus","all_on":"Alle ein","floor_other":"Weitere"},"covers":{"open":"Offene Rollos & Abdeckungen","closed":"Geschlossene Rollos & Abdeckungen","partially_open":"Teiloffene Rollos & Abdeckungen","open_all":"Alle öffnen","close_all":"Alle schließen","awnings_open":"Ausgefahrene Markisen","awnings_closed":"Eingefahrene Markisen","awnings_partial":"Teilweise ausgefahrene Markisen","awnings_open_all":"Alle ausfahren","awnings_close_all":"Alle einfahren","windows_open":"Offene Fenster","windows_closed":"Geschlossene Fenster","windows_partial":"Teiloffene Fenster","windows_open_all":"Alle öffnen","windows_close_all":"Alle schließen"},"security":{"locks_unlocked":"Schlösser - Entriegelt","locks_locked":"Schlösser - Verriegelt","doors_open":"Türen, Tore & Fenster - Offen","doors_closed":"Türen, Tore & Fenster - Geschlossen","garages_open":"Garagen - Offen","garages_closed":"Garagen - Geschlossen","windows_open":"Tür- & Fenstersensoren - Offen","windows_closed":"Tür- & Fenstersensoren - Geschlossen","smoke_gas_active":"Rauch- & Gasmelder - Alarm","smoke_gas_inactive":"Rauch- & Gasmelder - Kein Alarm"},"batteries":{"critical":"Kritisch","low":"Niedrig","good":"Gut","battery_one":"Batterie","battery_many":"Batterien"},"climate":{"heating":"Heizen","cooling":"Kühlen","idle":"Bereitschaft","off":"Aus"},"room":{"cameras":"Kameras","lighting":"Beleuchtung","all_on":"Alle ein","all_off":"Alle aus","locks":"Schlösser","climate":"Klima","covers":"Rollos & Abdeckungen","curtains":"Vorhänge","windows":"Fenster, Türen & Tore","media":"Medien","scenes":"Szenen","misc":"Sonstiges","automations":"Automationen","scripts":"Skripte","room_pins":"Raum-Pins"},"editor":{"section_order":"Abschnitts-Reihenfolge","section_order_desc":"Ziehe die Abschnitte per Drag & Drop in die gewünschte Reihenfolge. Leere Abschnitte werden automatisch ausgeblendet.","section_hidden":"ausgeblendet","energy_link_dashboard":"Energie-Dashboard verlinken","target_section":"Zeige in","section_overview":"Übersicht","show_clock_card":"Uhrzeit-Karte anzeigen","show_clock_card_desc":"Zeigt die Uhrzeit-Karte in der Übersicht an.","alarm_entity":"Alarm-Entität:","alarm_none":"Keine (Uhr in voller Breite)","alarm_desc":"Wähle eine Alarm-Control-Panel-Entität aus. Wenn die Uhrzeit-Karte aktiv ist, wird das Alarm-Panel daneben angezeigt. Ohne Uhrzeit-Karte erscheint das Alarm-Panel in voller Breite.","show_search_card":"Such-Karte anzeigen","show_search_card_desc":"Zeigt die custom:search-card direkt unter der Uhr in der Übersicht an.","show_search_card_missing":"Benötigt <strong>custom:search-card</strong> und <strong>card-tools</strong>. Bitte installieren Sie beide Komponenten, um diese Funktion zu nutzen.","section_summaries":"Zusammenfassungen","columns_2":"2 Spalten (2x2 Grid)","columns_4":"4 Spalten (1x4 Reihe)","columns_desc":"Wähle aus, wie die Zusammenfassungskarten angezeigt werden sollen. Das Layout passt sich automatisch an, wenn Karten ausgeblendet werden.","stretch_wrapping_summaries":"Umbrechende Zeilen auf volle Breite strecken","stretch_wrapping_summaries_desc":"Wenn die letzte Zeile nicht vollständig gefüllt ist, teilen sich die Karten diese Zeile gleichmäßig über die gesamte Breite.","show_light_summary":"Licht-Zusammenfassung anzeigen","group_lights_by_floors":"Lichter nach Etagen gruppieren","group_lights_by_floors_desc":"Gruppiert die Lichter in der Lichter-Ansicht nach Etagen. Jede Etage erhält einen eigenen Bereich mit Ein-/Ausschalt-Button.","nested_light_groups":"Verschachtelte Lichtgruppen anzeigen","nested_light_groups_desc":"Zeigt Lichtgruppen als aufklappbare Container mit den enthaltenen Lampen darunter an. Standardmäßig deaktiviert, damit das bisherige flache Verhalten unverändert bleibt.","show_covers_summary":"Rollo-Zusammenfassung anzeigen","show_partially_open_covers":"Teiloffene Rollos separat anzeigen","show_partially_open_covers_desc":"Zeigt teiloffene Rollos (weder ganz offen noch geschlossen) in einer eigenen Gruppe an.","show_security_summary":"Sicherheits-Zusammenfassung anzeigen","show_climate_summary":"Klima-Zusammenfassung anzeigen","show_climate_summary_desc":"Zeigt die Klima-Zusammenfassungskarte in der Übersicht an. Zählt aktive Thermostate und Klimageräte.","show_battery_summary":"Batterie-Zusammenfassung anzeigen","hide_mobile_app_batteries":"Mobile-App-Batterien ausblenden","hide_mobile_app_batteries_desc":"Blendet Batterien von Smartphones, Tablets und Watches (Mobile App) in der Batterie-Übersicht und -Zusammenfassung aus.","battery_thresholds":"Batterie-Schwellwerte","battery_critical_below":"Kritisch unter","battery_low_below":"Niedrig unter","battery_thresholds_desc":"Schwellwerte für die Batterie-Statusgruppen (Kritisch / Niedrig / Gut).","section_info_cards":"Info-Karten","show_weather":"Wetter-Karte anzeigen","show_weather_desc":"Zeigt die Wettervorhersage-Karte in der Übersicht an, wenn eine Wetter-Entität verfügbar ist.","show_energy":"Energie-Dashboard anzeigen","show_energy_desc":"Zeigt die Energie-Verteilungskarte in der Übersicht an, wenn Energiedaten verfügbar sind.","section_favorites":"Favoriten","select_entity":"Entität auswählen...","add":"+ Hinzufügen","favorites_desc":"Wähle Entitäten aus, die als Favoriten unter den Zusammenfassungen angezeigt werden sollen. Die Entitäten werden als Kacheln angezeigt.","show_state":"Status anzeigen","hide_last_changed":"Zuletzt aktualisiert ausblenden","section_areas_rooms":"Bereiche & Räume","section_areas":"Bereiche","group_by_floors":"Bereiche in Etagen gliedern","group_by_floors_desc":"Gruppiert die Bereiche in der Übersicht nach Etagen. Wenn aktiviert, wird für jede Etage eine separate Section erstellt.","show_switches_on_areas":"Schalter auf Bereichskarten anzeigen","show_switches_on_areas_desc":"Zeigt Schalter (Switches) als Controls auf den Bereichskarten in der Übersicht an. ⚠️ Stelle sicher, dass alle Schalter, die nicht geschaltet werden können oder sollen, über die Entitäts-Einstellungen auf \'Nicht sichtbar\' gestellt sind!","show_alerts_on_areas":"Alert-Icons auf Bereichskarten anzeigen","show_alerts_on_areas_desc":"Zeigt Alert-Icons (z.B. Bewegung, Feuchtigkeit, Wärme) auf den Bereichskarten an, wenn ein Binärsensor im Bereich aktiv ist.","show_locks_in_rooms":"Schlösser in Raum-Ansichten anzeigen","show_locks_in_rooms_desc":"Zeigt Schlösser (z.B. Nuki) in den jeweiligen Raum-Ansichten an. Schlösser erscheinen unabhängig davon immer in der Sicherheits-Übersicht.","show_automations_in_rooms":"Automationen in Raum-Ansichten anzeigen","show_automations_in_rooms_desc":"Zeigt dem Bereich zugeordnete Automationen in den jeweiligen Raum-Ansichten an.","show_scripts_in_rooms":"Skripte in Raum-Ansichten anzeigen","show_scripts_in_rooms_desc":"Zeigt dem Bereich zugeordnete Skripte in den jeweiligen Raum-Ansichten an.","show_window_contacts_in_rooms":"Fensterkontakte in Raum-Ansichten anzeigen","show_window_contacts_in_rooms_desc":"Zeigt Fensterkontakte als Badges in den jeweiligen Raum-Ansichten an.","show_door_contacts_in_rooms":"Türkontakte in Raum-Ansichten anzeigen","show_door_contacts_in_rooms_desc":"Zeigt Türkontakte als Badges in den jeweiligen Raum-Ansichten an.","use_default_area_sort":"Home Assistant Sortierung verwenden","use_default_area_sort_desc":"Verwendet die Sortierung der Bereiche aus Home Assistant anstelle der hier konfigurierten Reihenfolge.","areas_manage_desc":"Wähle aus, welche Bereiche im Dashboard angezeigt werden sollen und in welcher Reihenfolge. Klappe Bereiche auf, um einzelne Entitäten zu verwalten.","section_room_pins":"Raum-Pins","room_pins_desc":"Wähle Entitäten aus, die in ihren zugeordneten Räumen als erstes angezeigt werden sollen. Ideal für Entitäten die normalerweise nicht automatisch erfasst werden (z.B. Wetterstationen, spezielle Sensoren). <strong>Nur Entitäten mit Raum-Zuordnung können ausgewählt werden.</strong> Diese Pins erscheinen nur im jeweiligen Raum, nicht in der Übersicht.","section_views":"Ansichten","show_summary_views":"Zusammenfassungs-Views anzeigen","show_summary_views_desc":"Zeigt die Zusammenfassungs-Views (Lichter, Rollos, Sicherheit, Batterien) in der oberen Navigation an.","show_room_views":"Raum-Views anzeigen","show_room_views_desc":"Zeigt die einzelnen Raum-Views in der oberen Navigation an.","section_advanced":"Erweiterte Funktionen","section_custom_cards":"Eigene Karten","custom_cards_heading_placeholder":"Eigene Karten","custom_cards_desc":"Überschrift und Icon der Section für die eigenen Karten auf dem Dashboard. Leer lassen für Standardwerte.","add_custom_card":"+ Neue Karte hinzufügen","video_tutorial":"Video-Anleitung ansehen","custom_cards_help":"Füge eigene Karten zur Übersicht hinzu. Die Karten erscheinen in einer eigenen Section zwischen Zusammenfassung und Bereichen. Tipp: Erstelle die Karte zuerst in einem normalen Dashboard, kopiere den YAML-Code und füge ihn hier ein.","section_custom_badges":"Eigene Badges","add_custom_badge":"+ Neues Badge hinzufügen","custom_badges_help":"Füge eigene Badges zum Header der Übersicht hinzu (neben den Personen-Chips).","section_custom_views":"Custom Views","add_custom_view":"+ Neue View hinzufügen","custom_views_help":"Erstelle eigene Views mit beliebigen Cards. Tipp: Erstelle die View zuerst in einem normalen Dashboard, kopiere den YAML-Code und füge ihn hier ein.","no_favorites":"Keine Favoriten hinzugefügt","no_room_pins":"Keine Raum-Pins hinzugefügt","no_results":"Keine Ergebnisse gefunden","no_room":"Kein Raum","no_custom_views":"Keine Custom Views erstellt","no_custom_cards":"Keine eigenen Karten erstellt","no_custom_badges":"Keine eigenen Badges erstellt","no_areas":"Keine Bereiche verfügbar","no_entities_in_area":"Keine Entitäten in diesem Bereich gefunden","loading_entities":"Lade Entitäten...","new_view":"Neue View","new_card":"Neue Karte","title_placeholder":"Titel","path_placeholder":"Pfad (z.B. mein-view)","yaml_placeholder":"YAML-Code hier einfügen...","card_title_placeholder":"Titel (optional, wird als Heading angezeigt)","yaml_valid":"YAML gültig","domain_lights":"Beleuchtung","domain_climate":"Klima","domain_covers":"Rollos & Abdeckungen","domain_covers_curtain":"Vorhänge","domain_covers_window":"Fenster, Türen & Tore","domain_media_player":"Medien","domain_scenes":"Szenen","domain_vacuum":"Staubsauger","domain_fan":"Ventilatoren","domain_switches":"Schalter","domain_locks":"Schlösser","domain_badges":"Raum-Badges","badges_additional":"Zusätzliche Badges","badges_add":"Hinzufügen","badges_select_entity":"Entity auswählen...","badges_remove":"Entfernen","badges_show_name":"Entity-Name auf Badge anzeigen","badges_name_short":"Name"}}');

/***/ },

/***/ "./src/translations/en.json"
/*!**********************************!*\
  !*** ./src/translations/en.json ***!
  \**********************************/
(module) {

module.exports = /*#__PURE__*/JSON.parse('{"dashboard":{"title":"Dynamic Dashboard"},"views":{"overview":"Overview","lights":"Lights","covers":"Blinds & Covers","security":"Security","batteries":"Batteries","climate":"Climate"},"sections":{"overview":"Overview","summaries":"Summaries","favorites":"Favorites","custom_cards":"Custom Cards","areas":"Areas","areas_other":"Other Areas","weather":"Weather","energy":"Energy"},"summary":{"lights_on_one":"light on","lights_on_many":"lights on","lights_off":"All lights off","covers_open_one":"cover open","covers_open_many":"covers open","covers_closed":"All covers closed","security_unsafe":"unsafe","security_safe":"All secure","batteries_critical_one":"battery critical","batteries_critical_many":"batteries critical","batteries_ok":"All batteries OK","climate_active_one":"thermostat active","climate_active_many":"thermostats active","climate_off":"All thermostats off"},"lights":{"on":"Lights On","off":"Lights Off","all_off":"All off","all_on":"All on","floor_other":"Other"},"covers":{"open":"Open Blinds & Covers","closed":"Closed Blinds & Covers","partially_open":"Partially Open Blinds & Covers","open_all":"Open all","close_all":"Close all","awnings_open":"Extended Awnings","awnings_closed":"Retracted Awnings","awnings_partial":"Partially Extended Awnings","awnings_open_all":"Extend all","awnings_close_all":"Retract all","windows_open":"Open Windows","windows_closed":"Closed Windows","windows_partial":"Partially Open Windows","windows_open_all":"Open all","windows_close_all":"Close all"},"security":{"locks_unlocked":"Locks - Unlocked","locks_locked":"Locks - Locked","doors_open":"Doors, Gates & Windows - Open","doors_closed":"Doors, Gates & Windows - Closed","garages_open":"Garages - Open","garages_closed":"Garages - Closed","windows_open":"Door & Window Sensors - Open","windows_closed":"Door & Window Sensors - Closed","smoke_gas_active":"Smoke & Gas Detectors - Alarm","smoke_gas_inactive":"Smoke & Gas Detectors - No Alarm"},"batteries":{"critical":"Critical","low":"Low","good":"Good","battery_one":"battery","battery_many":"batteries"},"climate":{"heating":"Heating","cooling":"Cooling","idle":"Idle","off":"Off"},"room":{"cameras":"Cameras","lighting":"Lighting","all_on":"All on","all_off":"All off","locks":"Locks","climate":"Climate","covers":"Blinds & Covers","curtains":"Curtains","windows":"Windows, Doors & Gates","media":"Media","scenes":"Scenes","misc":"Miscellaneous","automations":"Automations","scripts":"Scripts","room_pins":"Room Pins"},"editor":{"section_order":"Section Order","section_order_desc":"Drag sections to reorder them on the overview page. Empty sections are hidden automatically.","section_hidden":"hidden","energy_link_dashboard":"Link to energy dashboard","target_section":"Show in","section_overview":"Overview","show_clock_card":"Show clock card","show_clock_card_desc":"Shows the clock card on the overview.","alarm_entity":"Alarm entity:","alarm_none":"None (clock full width)","alarm_desc":"Select an alarm control panel entity. When the clock card is active, the alarm panel is shown next to it. Without the clock card, the alarm panel takes the full width.","show_search_card":"Show search card","show_search_card_desc":"Shows the custom:search-card directly below the clock on the overview.","show_search_card_missing":"Requires <strong>custom:search-card</strong> and <strong>card-tools</strong>. Please install both components to use this feature.","section_summaries":"Summaries","columns_2":"2 columns (2x2 grid)","columns_4":"4 columns (1x4 row)","columns_desc":"Choose how summary cards should be displayed. The layout adjusts automatically when cards are hidden.","stretch_wrapping_summaries":"Stretch wrapping rows to full width","stretch_wrapping_summaries_desc":"When the last row is not completely filled, the cards on that row share the full width evenly.","show_light_summary":"Show light summary","group_lights_by_floors":"Group lights by floors","group_lights_by_floors_desc":"Groups lights in the lights view by floors. Each floor gets its own section with on/off buttons.","nested_light_groups":"Show nested light groups","nested_light_groups_desc":"Shows light groups as expandable containers with their member lights underneath. Disabled by default to preserve the existing flat list behavior.","show_covers_summary":"Show cover summary","show_partially_open_covers":"Show partially open covers separately","show_partially_open_covers_desc":"Shows partially open covers (neither fully open nor closed) in a separate group.","show_security_summary":"Show security summary","show_climate_summary":"Show climate summary","show_climate_summary_desc":"Shows the climate summary card on the overview. Counts active thermostats and climate devices.","show_battery_summary":"Show battery summary","hide_mobile_app_batteries":"Hide mobile app batteries","hide_mobile_app_batteries_desc":"Hides batteries from smartphones, tablets, and watches (Mobile App) from the battery overview and summary.","battery_thresholds":"Battery thresholds","battery_critical_below":"Critical below","battery_low_below":"Low below","battery_thresholds_desc":"Thresholds for battery status groups (Critical / Low / Good).","section_info_cards":"Info Cards","show_weather":"Show weather card","show_weather_desc":"Shows the weather forecast card on the overview when a weather entity is available.","show_energy":"Show energy dashboard","show_energy_desc":"Shows the energy distribution card on the overview when energy data is available.","section_favorites":"Favorites","select_entity":"Select entity...","add":"+ Add","favorites_desc":"Select entities to be shown as favorites below the summaries. Entities are displayed as tiles.","show_state":"Show state","hide_last_changed":"Hide last changed","section_areas_rooms":"Areas & Rooms","section_areas":"Areas","group_by_floors":"Group areas by floors","group_by_floors_desc":"Groups areas on the overview by floors. When enabled, a separate section is created for each floor.","show_switches_on_areas":"Show switches on area cards","show_switches_on_areas_desc":"Shows switches as controls on the area cards in the overview. Home Assistant hides these by default.","show_alerts_on_areas":"Show alert icons on area cards","show_alerts_on_areas_desc":"Shows alert icons (e.g. motion, moisture, heat) on area cards when a binary sensor in the area is active.","show_locks_in_rooms":"Show locks in room views","show_locks_in_rooms_desc":"Shows locks (e.g. Nuki) in the respective room views. Locks always appear in the security overview regardless.","show_automations_in_rooms":"Show automations in room views","show_automations_in_rooms_desc":"Shows automations assigned to the area in the respective room views.","show_scripts_in_rooms":"Show scripts in room views","show_scripts_in_rooms_desc":"Shows scripts assigned to the area in the respective room views.","show_window_contacts_in_rooms":"Show window contacts in room views","show_window_contacts_in_rooms_desc":"Shows window contacts as badges in the respective room views.","show_door_contacts_in_rooms":"Show door contacts in room views","show_door_contacts_in_rooms_desc":"Shows door contacts as badges in the respective room views.","use_default_area_sort":"Use Home Assistant sorting","use_default_area_sort_desc":"Uses the area sorting from Home Assistant instead of the order configured here.","areas_manage_desc":"Choose which areas should be shown on the dashboard and in what order. Expand areas to manage individual entities.","section_room_pins":"Room Pins","room_pins_desc":"Select entities to be shown first in their assigned rooms. Ideal for entities that are not automatically detected (e.g. weather stations, special sensors). <strong>Only entities with room assignment can be selected.</strong> These pins only appear in their respective room, not on the overview.","section_views":"Views","show_summary_views":"Show summary views","show_summary_views_desc":"Shows the summary views (Lights, Covers, Security, Batteries) in the top navigation.","show_room_views":"Show room views","show_room_views_desc":"Shows individual room views in the top navigation.","section_advanced":"Advanced Features","section_custom_cards":"Custom Cards","custom_cards_heading_placeholder":"Custom Cards","custom_cards_desc":"Heading and icon for the custom cards section on the dashboard. Leave empty for defaults.","add_custom_card":"+ Add new card","video_tutorial":"Watch video tutorial","custom_cards_help":"Add custom cards to the overview. Cards appear in a separate section between summaries and areas. Tip: Create the card in a regular dashboard first, copy the YAML code, and paste it here.","section_custom_badges":"Custom Badges","add_custom_badge":"+ Add new badge","custom_badges_help":"Add custom badges to the overview header (next to person chips).","section_custom_views":"Custom Views","add_custom_view":"+ Add new view","custom_views_help":"Create custom views with any cards. Tip: Create the view in a regular dashboard first, copy the YAML code, and paste it here.","no_favorites":"No favorites added","no_room_pins":"No room pins added","no_results":"No results found","no_room":"No room","no_custom_views":"No custom views created","no_custom_cards":"No custom cards created","no_custom_badges":"No custom badges created","no_areas":"No areas available","no_entities_in_area":"No entities found in this area","loading_entities":"Loading entities...","new_view":"New View","new_card":"New Card","title_placeholder":"Title","path_placeholder":"Path (e.g. my-view)","yaml_placeholder":"Paste YAML code here...","card_title_placeholder":"Title (optional, shown as heading)","yaml_valid":"YAML valid","domain_lights":"Lighting","domain_climate":"Climate","domain_covers":"Blinds & Covers","domain_covers_curtain":"Curtains","domain_covers_window":"Windows, Doors & Gates","domain_media_player":"Media","domain_scenes":"Scenes","domain_vacuum":"Vacuums","domain_fan":"Fans","domain_switches":"Switches","domain_locks":"Locks","domain_badges":"Room Badges","badges_additional":"Additional Badges","badges_add":"Add","badges_select_entity":"Select entity...","badges_remove":"Remove","badges_show_name":"Show entity name on badge","badges_name_short":"Name"}}');

/***/ }

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		if (!(moduleId in __webpack_modules__)) {
/******/ 			delete __webpack_module_cache__[moduleId];
/******/ 			var e = new Error("Cannot find module '" + moduleId + "'");
/******/ 			e.code = 'MODULE_NOT_FOUND';
/******/ 			throw e;
/******/ 		}
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/create fake namespace object */
/******/ 	(() => {
/******/ 		var getProto = Object.getPrototypeOf ? (obj) => (Object.getPrototypeOf(obj)) : (obj) => (obj.__proto__);
/******/ 		var leafPrototypes;
/******/ 		// create a fake namespace object
/******/ 		// mode & 1: value is a module id, require it
/******/ 		// mode & 2: merge all properties of value into the ns
/******/ 		// mode & 4: return value when already ns object
/******/ 		// mode & 16: return value when it's Promise-like
/******/ 		// mode & 8|1: behave like require
/******/ 		__webpack_require__.t = function(value, mode) {
/******/ 			if(mode & 1) value = this(value);
/******/ 			if(mode & 8) return value;
/******/ 			if(typeof value === 'object' && value) {
/******/ 				if((mode & 4) && value.__esModule) return value;
/******/ 				if((mode & 16) && typeof value.then === 'function') return value;
/******/ 			}
/******/ 			var ns = Object.create(null);
/******/ 			__webpack_require__.r(ns);
/******/ 			var def = {};
/******/ 			leafPrototypes = leafPrototypes || [null, getProto({}), getProto([]), getProto(getProto)];
/******/ 			for(var current = mode & 2 && value; (typeof current == 'object' || typeof current == 'function') && !~leafPrototypes.indexOf(current); current = getProto(current)) {
/******/ 				Object.getOwnPropertyNames(current).forEach((key) => (def[key] = () => (value[key])));
/******/ 			}
/******/ 			def['default'] = () => (value);
/******/ 			__webpack_require__.d(ns, def);
/******/ 			return ns;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
/*!*******************************************!*\
  !*** ./src/simon42-dashboard-strategy.ts ***!
  \*******************************************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _styles_global_styles__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./styles/global-styles */ "./src/styles/global-styles.ts");
// ====================================================================
// SIMON42 DASHBOARD STRATEGY — Main Entry Point
// ====================================================================
// Minimal entry point for fast custom element registration.
// Cards, views, and heavy dependencies are lazy-loaded in generate().
// This ensures customElements.define() runs before HA's 5s timeout.
// ====================================================================

(0,_styles_global_styles__WEBPACK_IMPORTED_MODULE_0__.ensureSimon42StrategyGlobalStyles)();
const STRATEGY_VERSION = '1.3.4-beta.9';
const DEBUG = new URLSearchParams(window.location.search).has('s42_debug');
const T0 = performance.now();
const t = (label) => {
    if (DEBUG)
        console.log(`[s42-timing] ${label}: ${(performance.now() - T0).toFixed(0)}ms`);
};
let generateCallCount = 0;
// Start loading all chunks IMMEDIATELY
const modulesPromise = Promise.all([
    Promise.resolve(/*! import() */).then(__webpack_require__.bind(__webpack_require__, /*! ./cards/SummaryCard */ "./src/cards/SummaryCard.ts")),
    Promise.resolve(/*! import() */).then(__webpack_require__.bind(__webpack_require__, /*! ./cards/LightsGroupCard */ "./src/cards/LightsGroupCard.ts")),
    Promise.resolve(/*! import() */).then(__webpack_require__.bind(__webpack_require__, /*! ./cards/CoversGroupCard */ "./src/cards/CoversGroupCard.ts")),
    Promise.resolve(/*! import() */).then(__webpack_require__.bind(__webpack_require__, /*! ./views/OverviewViewStrategy */ "./src/views/OverviewViewStrategy.ts")),
    Promise.resolve(/*! import() */).then(__webpack_require__.bind(__webpack_require__, /*! ./views/LightsViewStrategy */ "./src/views/LightsViewStrategy.ts")),
    Promise.resolve(/*! import() */).then(__webpack_require__.bind(__webpack_require__, /*! ./views/CoversViewStrategy */ "./src/views/CoversViewStrategy.ts")),
    Promise.resolve(/*! import() */).then(__webpack_require__.bind(__webpack_require__, /*! ./views/SecurityViewStrategy */ "./src/views/SecurityViewStrategy.ts")),
    Promise.resolve(/*! import() */).then(__webpack_require__.bind(__webpack_require__, /*! ./views/BatteriesViewStrategy */ "./src/views/BatteriesViewStrategy.ts")),
    Promise.resolve(/*! import() */).then(__webpack_require__.bind(__webpack_require__, /*! ./views/ClimateViewStrategy */ "./src/views/ClimateViewStrategy.ts")),
    Promise.resolve(/*! import() */).then(__webpack_require__.bind(__webpack_require__, /*! ./views/RoomViewStrategy */ "./src/views/RoomViewStrategy.ts")),
]);
void modulesPromise.then(() => { t('all chunks loaded'); });
class Simon42DashboardStrategy extends HTMLElement {
    static async generate(config, hass) {
        generateCallCount++;
        t(`generate() called (#${generateCallCount})`);
        await modulesPromise;
        t('modules ready');
        const { Registry } = await Promise.resolve(/*! import() */).then(__webpack_require__.bind(__webpack_require__, /*! ./Registry */ "./src/Registry.ts"));
        const { getVisibleAreasFromHass } = await Promise.resolve(/*! import() */).then(__webpack_require__.bind(__webpack_require__, /*! ./utils/name-utils */ "./src/utils/name-utils.ts"));
        const { localize } = await Promise.resolve(/*! import() */).then(__webpack_require__.bind(__webpack_require__, /*! ./utils/localize */ "./src/utils/localize.ts"));
        t('imports done');
        const getStrategy = (tag) => customElements.get(tag);
        Registry.initialize(hass, config);
        t('registry initialized');
        const visibleAreas = getVisibleAreasFromHass(hass, config.areas_display, config.use_default_area_sort);
        const showSummaryViews = config.show_summary_views === true;
        const showRoomViews = config.show_room_views === true;
        const showLights = config.show_light_summary !== false;
        const showCovers = config.show_covers_summary !== false;
        const showSecurity = config.show_security_summary !== false;
        const showBatteries = config.show_battery_summary !== false;
        const showClimate = config.show_climate_summary === true;
        // Pre-resolve ALL views upfront (like HA's Home Panel does)
        const overviewConfig = await getStrategy('ll-strategy-simon42-view-overview').generate({ dashboardConfig: config }, hass);
        t('overview resolved');
        // Only resolve utility views for enabled summaries
        const utilityViewDefs = [
            { enabled: showLights, title: localize('views.lights'), path: 'lights', icon: 'mdi:lamps',
                resolve: () => getStrategy('ll-strategy-simon42-view-lights').generate({ config }, hass) },
            { enabled: showCovers, title: localize('views.covers'), path: 'covers', icon: 'mdi:blinds-horizontal',
                resolve: () => getStrategy('ll-strategy-simon42-view-covers').generate({ device_classes: ['awning', 'blind', 'curtain', 'shade', 'shutter', 'window'], config }, hass) },
            { enabled: showSecurity, title: localize('views.security'), path: 'security', icon: 'mdi:security',
                resolve: () => getStrategy('ll-strategy-simon42-view-security').generate({ config }, hass) },
            { enabled: showBatteries, title: localize('views.batteries'), path: 'batteries', icon: 'mdi:battery-alert',
                resolve: () => getStrategy('ll-strategy-simon42-view-batteries').generate({ config }, hass) },
            { enabled: showClimate, title: localize('views.climate'), path: 'climate', icon: 'mdi:thermostat',
                resolve: () => getStrategy('ll-strategy-simon42-view-climate').generate({ config }, hass) },
        ];
        const enabledDefs = utilityViewDefs.filter((d) => d.enabled);
        const utilityConfigs = await Promise.all(enabledDefs.map((d) => d.resolve()));
        t('utility views resolved');
        const roomStrategy = getStrategy('ll-strategy-simon42-view-room');
        const roomConfigs = await Promise.all(visibleAreas.map((area) => {
            const areaOptions = config.areas_options?.[area.area_id];
            return roomStrategy.generate({
                area,
                groups_options: areaOptions?.groups_options || {},
                dashboardConfig: config,
            }, hass);
        }));
        t(`${visibleAreas.length} room views resolved`);
        const views = [
            {
                title: localize('views.overview'),
                path: 'home',
                icon: 'mdi:home',
                ...overviewConfig,
            },
            ...enabledDefs.map((def, i) => ({
                title: def.title,
                path: def.path,
                icon: def.icon,
                subview: !showSummaryViews,
                ...utilityConfigs[i],
            })),
            ...visibleAreas.map((area, i) => ({
                title: area.name,
                path: area.area_id,
                icon: area.icon || 'mdi:floor-plan',
                subview: !showRoomViews,
                ...roomConfigs[i],
            })),
        ];
        const customViews = config.custom_views || [];
        for (const cv of customViews) {
            if (cv.parsed_config && cv.title && cv.path) {
                views.push({
                    ...cv.parsed_config,
                    title: cv.title,
                    path: cv.path,
                    icon: cv.icon || 'mdi:card-text-outline',
                });
            }
        }
        t(`generate() done — ${views.length} views`);
        return {
            title: localize('dashboard.title'),
            views,
        };
    }
    static async getConfigElement() {
        await Promise.resolve(/*! import() */).then(__webpack_require__.bind(__webpack_require__, /*! ./editor/StrategyEditor */ "./src/editor/StrategyEditor.ts"));
        await customElements.whenDefined('simon42-dashboard-strategy-editor');
        return document.createElement('simon42-dashboard-strategy-editor');
    }
}
// Register strategy custom element IMMEDIATELY — no heavy imports needed.
// This ensures HA's 5-second timeout is satisfied even on slow networks.
customElements.define('ll-strategy-simon42-dashboard', Simon42DashboardStrategy);
console.log(`Simon42 Dashboard Strategy v${STRATEGY_VERSION} loaded`);

})();

/******/ })()
;
//# sourceMappingURL=simon42-dashboard-strategy.js.map