// ====================================================================
// VIEW STRATEGY — SECURITY (Locks, Doors, Garages, Windows, Smoke/Gas, Moisture)
// ====================================================================
// Uses reactive custom cards (like Lights/Covers views) so entities move
// between headings when hass state changes without reloading the view.
// ====================================================================

import type { HomeAssistant } from '../types/homeassistant';
import type { LovelaceSectionConfig, LovelaceViewConfig } from '../types/lovelace';
import { Registry } from '../Registry';
import type { SecurityCategory } from '../utils/security-entities';

const SECURITY_CATEGORIES: SecurityCategory[] = ['locks', 'doors', 'garages', 'windows', 'smoke_gas', 'moisture'];

class Simon42ViewSecurityStrategy extends HTMLElement {
  static async generate(config: any, hass: HomeAssistant): Promise<LovelaceViewConfig> {
    Registry.initialize(hass, config.config || {});

    const sections: LovelaceSectionConfig[] = SECURITY_CATEGORIES.map((category) => ({
      type: 'grid',
      cards: [
        {
          type: 'custom:simon42-security-category-card',
          category,
          config: config.config,
        },
      ],
    }));

    return {
      type: 'sections',
      sections,
    };
  }
}

customElements.define('ll-strategy-simon42-view-security', Simon42ViewSecurityStrategy);
