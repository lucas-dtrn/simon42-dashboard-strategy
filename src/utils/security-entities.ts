// ====================================================================
// SECURITY ENTITIES — Shared categorization for Security view/cards
// ====================================================================

import type { HomeAssistant } from '../types/homeassistant';
import { Registry } from '../Registry';
import { SECURITY_EXCLUDED_PLATFORMS } from './entity-filter';

export type SecurityCategory = 'locks' | 'doors' | 'garages' | 'windows' | 'smoke_gas' | 'moisture';

export type SecurityGroupType = 'active' | 'inactive';

const DOOR_COVER_CLASSES = new Set(['door', 'gate', 'window']);
const WINDOW_BINARY_CLASSES = new Set(['door', 'window', 'garage_door', 'opening']);
const SMOKE_GAS_CLASSES = new Set(['smoke', 'gas']);

export function categorizeSecurityEntity(entityId: string, hass: HomeAssistant): SecurityCategory | null {
  const state = hass.states[entityId];
  if (!state) return null;

  const deviceClass = state.attributes?.device_class as string | undefined;

  if (entityId.startsWith('lock.')) return 'locks';

  if (entityId.startsWith('cover.')) {
    if (deviceClass === 'garage') return 'garages';
    if (deviceClass && DOOR_COVER_CLASSES.has(deviceClass)) return 'doors';
    return null;
  }

  if (entityId.startsWith('binary_sensor.')) {
    const entry = Registry.getEntity(entityId);
    if (entry?.platform && SECURITY_EXCLUDED_PLATFORMS.has(entry.platform)) return null;
    if (deviceClass && WINDOW_BINARY_CLASSES.has(deviceClass)) return 'windows';
    if (deviceClass === 'moisture') return 'moisture';
    if (deviceClass && SMOKE_GAS_CLASSES.has(deviceClass)) return 'smoke_gas';
  }

  return null;
}

export function getSecurityEntitiesForCategory(hass: HomeAssistant, category: SecurityCategory): string[] {
  const domains =
    category === 'locks'
      ? ['lock']
      : category === 'doors' || category === 'garages'
        ? ['cover']
        : ['binary_sensor'];

  const result: string[] = [];
  for (const domain of domains) {
    for (const id of Registry.getVisibleEntityIdsForDomain(domain)) {
      if (categorizeSecurityEntity(id, hass) === category) result.push(id);
    }
  }
  return result;
}

export function matchesSecurityGroup(
  entityId: string,
  category: SecurityCategory,
  groupType: SecurityGroupType,
  hass: HomeAssistant,
): boolean {
  const state = hass.states[entityId]?.state;
  if (!state) return false;

  switch (category) {
    case 'locks':
      return groupType === 'active' ? state === 'unlocked' : state === 'locked';
    case 'doors':
    case 'garages':
      return groupType === 'active' ? state === 'open' : state === 'closed';
    default:
      return groupType === 'active' ? state === 'on' : state === 'off';
  }
}

export function sortByLastChanged(a: string, b: string, hass: HomeAssistant): number {
  const stateA = hass.states[a];
  const stateB = hass.states[b];
  if (!stateA || !stateB) return 0;
  return new Date(stateB.last_changed).getTime() - new Date(stateA.last_changed).getTime();
}

export function categoryHasActiveEntities(entities: string[], hass: HomeAssistant, category: SecurityCategory): boolean {
  return entities.some((id) => matchesSecurityGroup(id, category, 'active', hass));
}
