// ====================================================================
// SECURITY CATEGORY CARD — Reactive locks/doors/sensors grouping (LitElement)
// ====================================================================

import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import type { HomeAssistant } from '../types/homeassistant';
import { Registry } from '../Registry';
import { trackHassUpdate } from '../utils/debug';
import { localize } from '../utils/localize';
import {
  type SecurityCategory,
  type SecurityGroupType,
  getSecurityEntitiesForCategory,
  matchesSecurityGroup,
  sortByLastChanged,
  categoryHasActiveEntities,
} from '../utils/security-entities';

declare global {
  interface Window {
    customCards?: Array<{ type: string; name: string; description: string }>;
  }
}

interface SecurityCategoryConfig {
  category: SecurityCategory;
  config?: Record<string, unknown>;
}

interface LovelaceCardElement extends HTMLElement {
  hass?: HomeAssistant;
  setConfig(config: Record<string, unknown>): void;
}

const SECURITY_CATEGORIES: SecurityCategory[] = [
  'locks',
  'doors',
  'garages',
  'windows',
  'smoke_gas',
  'moisture',
];

const TITLE_ICONS: Record<SecurityCategory, { alert: string; ok: string }> = {
  locks: { alert: 'mdi:lock-open', ok: 'mdi:lock' },
  doors: { alert: 'mdi:door-open', ok: 'mdi:door-closed' },
  garages: { alert: 'mdi:garage-open', ok: 'mdi:garage-closed' },
  windows: { alert: 'mdi:door-open', ok: 'mdi:door-closed' },
  smoke_gas: { alert: 'mdi:smoke-detector-variant-alert', ok: 'mdi:smoke-detector-variant' },
  moisture: { alert: 'mdi:water-alert', ok: 'mdi:water-check' },
};

const TITLE_KEYS: Record<SecurityCategory, string> = {
  locks: 'security.locks_title',
  doors: 'security.doors_title',
  garages: 'security.garages_title',
  windows: 'security.windows_title',
  smoke_gas: 'security.smoke_gas_title',
  moisture: 'security.moisture_title',
};

const GROUP_HEADING_KEYS: Record<SecurityCategory, Record<SecurityGroupType, string>> = {
  locks: { active: 'security.locks_unlocked', inactive: 'security.locks_locked' },
  doors: { active: 'security.doors_open', inactive: 'security.doors_closed' },
  garages: { active: 'security.garages_open', inactive: 'security.garages_closed' },
  windows: { active: 'security.windows_open', inactive: 'security.windows_closed' },
  smoke_gas: { active: 'security.smoke_gas_active', inactive: 'security.smoke_gas_inactive' },
  moisture: { active: 'security.moisture_active', inactive: 'security.moisture_inactive' },
};

class Simon42SecurityCategoryCard extends LitElement {
  static properties = {
    hass: { attribute: false },
  };

  public hass?: HomeAssistant;
  private _config!: SecurityCategoryConfig;
  private _cachedEntityIds: string[] | null = null;
  private _lastRenderKey = '';

  private _titleCard: LovelaceCardElement | null = null;
  private _groupHeadingCards = new Map<SecurityGroupType, LovelaceCardElement>();
  private _tileCards = new Map<string, LovelaceCardElement>();

  static styles = css`
    :host {
      display: block;
    }
    :host([hidden]) {
      display: none;
    }
    .security-section {
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: 100%;
    }
    .entity-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 8px;
    }
    .group-block {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .group-block[hidden] {
      display: none;
    }
  `;

  setConfig(config: SecurityCategoryConfig): void {
    if (!SECURITY_CATEGORIES.includes(config.category)) {
      throw new Error(`Invalid security category: ${config.category}`);
    }
    this._config = config;
    this._cachedEntityIds = null;
  }

  protected willUpdate(changedProps: PropertyValues): void {
    if (!changedProps.has('hass') || !this.hass) return;

    trackHassUpdate(`security-${this._config.category}`);
    const oldHass = changedProps.get('hass') as HomeAssistant | undefined;

    if (!oldHass || oldHass.entities !== this.hass.entities) {
      this._cachedEntityIds = null;
    }

    if (!this._cachedEntityIds) {
      if (!Registry.initialized) return;
      this._cachedEntityIds = getSecurityEntitiesForCategory(this.hass, this._config.category);
    }

    this._propagateHass(this.hass);
  }

  private _propagateHass(hass: HomeAssistant): void {
    if (this._titleCard) this._titleCard.hass = hass;
    for (const card of this._groupHeadingCards.values()) {
      card.hass = hass;
    }
    for (const card of this._tileCards.values()) {
      card.hass = hass;
    }
  }

  private _getEntitiesForGroup(groupType: SecurityGroupType): string[] {
    if (!this.hass || !this._cachedEntityIds) return [];
    const { category } = this._config;
    const hass = this.hass;

    return this._cachedEntityIds
      .filter((id) => matchesSecurityGroup(id, category, groupType, hass))
      .sort((a, b) => sortByLastChanged(a, b, hass));
  }

  private _buildTitleConfig(entities: string[]): Record<string, unknown> {
    const { category } = this._config;
    const hasActive = categoryHasActiveEntities(entities, this.hass!, category);
    return {
      type: 'heading',
      heading: localize(TITLE_KEYS[category]),
      heading_style: 'title',
      icon: hasActive ? TITLE_ICONS[category].alert : TITLE_ICONS[category].ok,
    };
  }

  private _buildGroupHeadingConfig(groupType: SecurityGroupType, entities: string[]): Record<string, unknown> {
    const { category } = this._config;
    const heading: Record<string, unknown> = {
      type: 'heading',
      heading: localize(GROUP_HEADING_KEYS[category][groupType]),
      heading_style: 'subtitle',
    };

    if (groupType !== 'active' || entities.length === 0) return heading;

    if (category === 'locks') {
      heading.badges = [
        {
          type: 'entity',
          entity: entities[0],
          show_name: false,
          show_state: false,
          tap_action: {
            action: 'perform-action',
            perform_action: 'lock.lock',
            target: { entity_id: entities },
          },
          icon: 'mdi:lock',
        },
      ];
    } else if (category === 'doors' || category === 'garages') {
      heading.badges = [
        {
          type: 'entity',
          entity: entities[0],
          show_name: false,
          show_state: false,
          tap_action: {
            action: 'perform-action',
            perform_action: 'cover.close_cover',
            target: { entity_id: entities },
          },
          icon: 'mdi:arrow-down',
        },
      ];
    }

    return heading;
  }

  private _getOrCreateTileCard(entityId: string, groupType: SecurityGroupType): LovelaceCardElement {
    const cacheKey = `${groupType}:${entityId}`;
    const existing = this._tileCards.get(cacheKey);
    if (existing) return existing;

    const { category } = this._config;
    const card = document.createElement('hui-tile-card') as LovelaceCardElement;
    card.hass = this.hass;

    const cardConfig: Record<string, unknown> = {
      type: 'tile',
      entity: entityId,
      state_content: 'last_changed',
    };

    if (category === 'locks') {
      cardConfig.features = [{ type: 'lock-commands' }];
    } else if (category === 'doors' || category === 'garages') {
      cardConfig.features = [{ type: 'cover-open-close' }];
      cardConfig.features_position = 'inline';
    } else if (category === 'moisture' && groupType === 'active') {
      cardConfig.color = 'blue';
    }

    card.setConfig(cardConfig);
    this._tileCards.set(cacheKey, card);
    return card;
  }

  private _calculateRenderKey(): string {
    if (!this.hass || !this._cachedEntityIds) return '';
    const active = this._getEntitiesForGroup('active');
    const inactive = this._getEntitiesForGroup('inactive');
    const states = [...active, ...inactive]
      .map((id) => `${id}:${this.hass!.states[id]?.state ?? '?'}`)
      .join(',');
    return `${active.length}|${inactive.length}|${states}`;
  }

  protected render() {
    if (!this.hass || !this._cachedEntityIds) return nothing;

    const hasEntities = this._cachedEntityIds.length > 0;
    this.hidden = !hasEntities;
    if (!hasEntities) return nothing;

    return html`
      <div class="security-section">
        <div id="title-slot"></div>
        <div class="group-block" id="active-group">
          <div id="active-heading-slot"></div>
          <div class="entity-grid" id="active-grid"></div>
        </div>
        <div class="group-block" id="inactive-group">
          <div id="inactive-heading-slot"></div>
          <div class="entity-grid" id="inactive-grid"></div>
        </div>
      </div>
    `;
  }

  protected updated(changedProps: PropertyValues): void {
    super.updated(changedProps);
    if (!this.hass || !this._cachedEntityIds) return;

    const renderKey = this._calculateRenderKey();
    if (this._lastRenderKey === renderKey) return;
    this._lastRenderKey = renderKey;

    if (this._cachedEntityIds.length === 0) {
      this._clearDom();
      return;
    }

    this._updateTitle();
    this._updateGroup('active', 'active-group', 'active-heading-slot', 'active-grid');
    this._updateGroup('inactive', 'inactive-group', 'inactive-heading-slot', 'inactive-grid');
  }

  private _clearDom(): void {
    for (const id of ['title-slot', 'active-heading-slot', 'inactive-heading-slot']) {
      const slot = this.shadowRoot?.getElementById(id);
      if (slot) slot.innerHTML = '';
    }
    for (const id of ['active-grid', 'inactive-grid']) {
      const grid = this.shadowRoot?.getElementById(id);
      if (grid) grid.innerHTML = '';
    }
    this._titleCard = null;
    this._groupHeadingCards.clear();
    this._tileCards.clear();
    this._lastRenderKey = '';
  }

  private _updateTitle(): void {
    const slot = this.shadowRoot?.getElementById('title-slot');
    if (!slot || !this._cachedEntityIds) return;

    if (!this._titleCard) {
      this._titleCard = document.createElement('hui-heading-card') as LovelaceCardElement;
      slot.appendChild(this._titleCard);
    }
    this._titleCard.hass = this.hass;
    this._titleCard.setConfig(this._buildTitleConfig(this._cachedEntityIds));
  }

  private _updateGroup(
    groupType: SecurityGroupType,
    groupId: string,
    headingSlotId: string,
    gridId: string,
  ): void {
    const entities = this._getEntitiesForGroup(groupType);
    const groupEl = this.shadowRoot?.getElementById(groupId);
    if (groupEl) groupEl.hidden = entities.length === 0;

    const headingSlot = this.shadowRoot?.getElementById(headingSlotId);
    const grid = this.shadowRoot?.getElementById(gridId);
    if (!headingSlot || !grid) return;

    if (entities.length === 0) {
      headingSlot.innerHTML = '';
      grid.innerHTML = '';
      this._groupHeadingCards.delete(groupType);
      for (const [key, card] of this._tileCards) {
        if (key.startsWith(`${groupType}:`) && card.parentNode === grid) {
          grid.removeChild(card);
          this._tileCards.delete(key);
        }
      }
      return;
    }

    let headingCard = this._groupHeadingCards.get(groupType);
    if (!headingCard) {
      headingCard = document.createElement('hui-heading-card') as LovelaceCardElement;
      headingSlot.appendChild(headingCard);
      this._groupHeadingCards.set(groupType, headingCard);
    }
    headingCard.hass = this.hass;
    headingCard.setConfig(this._buildGroupHeadingConfig(groupType, entities));

    const activeIds = new Set(entities.map((id) => `${groupType}:${id}`));

    for (const [key, card] of this._tileCards) {
      if (!key.startsWith(`${groupType}:`)) continue;
      if (!activeIds.has(key)) {
        if (card.parentNode === grid) grid.removeChild(card);
        this._tileCards.delete(key);
      }
    }

    let prevNode: ChildNode | null = null;
    for (const entityId of entities) {
      const card = this._getOrCreateTileCard(entityId, groupType);
      const nextSibling: ChildNode | null = prevNode ? prevNode.nextSibling : grid.firstChild;
      if (card !== nextSibling) {
        grid.insertBefore(card, nextSibling);
      }
      prevNode = card;
    }

    while (prevNode && prevNode.nextSibling) {
      grid.removeChild(prevNode.nextSibling);
    }
  }

  getCardSize(): number {
    if (!this._cachedEntityIds) return 1;
    const active = this._getEntitiesForGroup('active');
    const inactive = this._getEntitiesForGroup('inactive');
    return Math.ceil((active.length + inactive.length) / 3) + 3;
  }
}

customElements.define('simon42-security-category-card', Simon42SecurityCategoryCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'simon42-security-category-card',
  name: 'Simon42 Security Category Card',
  description: 'Reactive security grouping by entity state',
});
