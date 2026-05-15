// ====================================================================
// Simon42 Dashboard Strategy — Global Styles
// ====================================================================
// Rules for elements outside component shadow roots (e.g. hui-card).
// Lovelace grid cards live inside hui-grid-section's shadow root, so styles
// must be injected there — document.head alone does not apply.
// ====================================================================

export const SIMON42_STRATEGY_GLOBAL_STYLE_ID = 'simon42-dashboard-strategy-global-styles';

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

const injectedRoots = new WeakSet<Document | ShadowRoot>();

function injectStyles(root: Document | ShadowRoot): void {
  if (injectedRoots.has(root)) {
    return;
  }

  const existing =
    root instanceof Document
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
  } else {
    root.appendChild(style);
  }

  injectedRoots.add(root);
}

/** Injects strategy-wide styles into document and, when possible, HA shadow roots. */
export function ensureSimon42StrategyGlobalStyles(): void {
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
export function ensureSimon42StrategyGlobalStylesForElement(element: Element): void {
  const root = element.getRootNode();
  if (root instanceof ShadowRoot) {
    injectStyles(root);
    return;
  }

  if (root instanceof Document) {
    injectStyles(root);
  }
}

function injectStylesIntoTree(root: ShadowRoot | Element | Document): void {
  if (root instanceof ShadowRoot) {
    injectStyles(root);
  }

  const elements =
    root instanceof Document
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
