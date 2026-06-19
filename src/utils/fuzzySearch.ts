/**
 * Simple fuzzy search implementation
 * Returns a score indicating how well the query matches the text
 */
export function fuzzySearch(query: string, text: string): number {
  if (!query || !text) return 0;

  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();

  // Exact match gets highest score
  if (textLower === queryLower) return 100;

  // Starts with query gets high score
  if (textLower.startsWith(queryLower)) return 90;

  // Contains query gets medium score
  if (textLower.includes(queryLower)) return 70;

  // Check if all query characters appear in order
  let queryIndex = 0;
  for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      queryIndex++;
    }
  }

  if (queryIndex === queryLower.length) {
    return 50;
  }

  return 0;
}

/**
 * Search and rank items
 */
export function searchItems<T>(
  items: T[],
  query: string,
  getSearchText: (item: T) => string
): T[] {
  if (!query.trim()) return items;

  const scored = items
    .map((item) => ({
      item,
      score: fuzzySearch(query, getSearchText(item)),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);

  return scored;
}
