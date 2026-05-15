// ====================================================================
// Simon42 Dashboard Strategy — Global Styles
// ====================================================================
// Rules for elements outside component shadow roots (e.g. hui-card).
// Loaded once with the strategy entry bundle.
// ====================================================================

export const SIMON42_STRATEGY_GLOBAL_STYLE_ID = 'simon42-dashboard-strategy-global-styles';

const GLOBAL_STYLES = `
  hui-card:has(> simon42-summary-card) {
    display: block;
  }
`;

/** Injects strategy-wide document styles once (idempotent). */
export function ensureSimon42StrategyGlobalStyles(): void {
  if (document.getElementById(SIMON42_STRATEGY_GLOBAL_STYLE_ID)) {
    return;
  }

  const style = document.createElement('style');
  style.id = SIMON42_STRATEGY_GLOBAL_STYLE_ID;
  style.textContent = GLOBAL_STYLES;
  document.head.appendChild(style);
}
