const GRID_COLUMNS = 12;

/**
 * Returns per-card grid column widths for summary cards on the overview.
 * When stretchWrappingSummaries is enabled, cards on the last incomplete row
 * share the full grid width evenly instead of keeping the configured column width.
 */
export function getSummaryCardColumnWidths(
  cardCount: number,
  summariesColumns: 2 | 4,
  stretchWrappingSummaries: boolean,
): number[] {
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

  return Array.from({ length: cardCount }, (_, index) =>
    index < fullRowCardCount ? defaultColumnWidth : stretchedColumnWidth,
  );
}
