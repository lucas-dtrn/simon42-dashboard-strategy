// ====================================================================
// Sections-View Footer (HA Lovelace primitive)
// ====================================================================
// https://www.home-assistant.io/dashboards/sections/#footer-yaml-configuration
// Dashboard strategy stores `footer.card` as YAML; `max_width` is a separate option.
// ====================================================================

import type { LovelaceCardConfig, LovelaceViewConfig, LovelaceViewFooterConfig } from '../types/lovelace';
import type { Simon42StrategyConfig, DashboardViewFooter } from '../types/strategy';

export function isCardConfig(value: unknown): value is LovelaceCardConfig {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && typeof (value as LovelaceCardConfig).type === 'string';
}

function isLegacyFooterWrapper(value: unknown): value is LovelaceViewFooterConfig {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    isCardConfig((value as LovelaceViewFooterConfig).card)
  );
}

/** Accepts stored `parsed_config` as a card or legacy `{ card, max_width? }`. */
function normalizeStoredFooterCard(parsed: unknown): { card?: LovelaceCardConfig; legacyMaxWidth?: number } {
  if (isCardConfig(parsed)) {
    return { card: parsed };
  }
  if (isLegacyFooterWrapper(parsed)) {
    return {
      card: parsed.card,
      legacyMaxWidth: typeof parsed.max_width === 'number' ? parsed.max_width : undefined,
    };
  }
  return {};
}

/** YAML may be a card map or legacy `{ card: …, max_width?: … }`. */
export function parseDashboardFooterYamlPayload(loaded: unknown): {
  card?: LovelaceCardConfig;
  legacyMaxWidth?: number;
} {
  if (isCardConfig(loaded)) {
    return { card: loaded };
  }
  if (isLegacyFooterWrapper(loaded)) {
    return {
      card: loaded.card,
      legacyMaxWidth: typeof loaded.max_width === 'number' ? loaded.max_width : undefined,
    };
  }
  return {};
}

function resolveFooterMaxWidth(config: Simon42StrategyConfig, legacyFromParsedOrYaml?: number): number | undefined {
  const configured = config.dashboard_footer_max_width;
  if (typeof configured === 'number' && Number.isFinite(configured)) {
    return configured;
  }
  if (typeof legacyFromParsedOrYaml === 'number' && Number.isFinite(legacyFromParsedOrYaml)) {
    return legacyFromParsedOrYaml;
  }
  return undefined;
}

/**
 * Resolves `dashboard_footer` (card YAML) and `dashboard_footer_max_width` into HA's `footer` object.
 */
export async function resolveDashboardFooter(
  config: Simon42StrategyConfig
): Promise<LovelaceViewFooterConfig | undefined> {
  const df: DashboardViewFooter | undefined = config.dashboard_footer;

  let card: LovelaceCardConfig | undefined;
  let legacyMw: number | undefined;

  if (df?.parsed_config != null) {
    const normalized = normalizeStoredFooterCard(df.parsed_config);
    card = normalized.card;
    legacyMw = normalized.legacyMaxWidth;
  }

  const y = df?.yaml?.trim();
  if (!card && y) {
    const { default: yaml } = await import('js-yaml');
    try {
      const loaded = yaml.load(y);
      const parsed = parseDashboardFooterYamlPayload(loaded);
      card = parsed.card;
      legacyMw = legacyMw ?? parsed.legacyMaxWidth;
    } catch {
      card = undefined;
    }
  }

  if (!card) {
    return undefined;
  }

  const maxWidth = resolveFooterMaxWidth(config, legacyMw);
  return maxWidth !== undefined ? { card, max_width: maxWidth } : { card };
}

/**
 * Per-view footer: an explicit footer in the view config wins over the
 * dashboard-level footer (custom views from YAML may define their own).
 */
export function mergeViewFooter(
  view: LovelaceViewConfig,
  dashboardFooter: LovelaceViewFooterConfig | undefined
): LovelaceViewConfig {
  if (!dashboardFooter) return view;
  const existing = view.footer;
  if (!existing) {
    return { ...view, footer: { ...dashboardFooter } };
  }
  return {
    ...view,
    footer: {
      ...dashboardFooter,
      ...existing,
      card: existing.card ?? dashboardFooter.card,
      max_width: existing.max_width ?? dashboardFooter.max_width,
    },
  };
}
