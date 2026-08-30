/**
 * Pure helper for circular / bounded keyboard navigation in comboboxes and dropdowns
 */
export function getNextActiveIndex(
  currentIndex: number,
  totalItems: number,
  direction: 'next' | 'prev',
): number {
  if (totalItems <= 0) return -1;
  if (currentIndex < 0) {
    return direction === 'next' ? 0 : totalItems - 1;
  }
  if (direction === 'next') {
    return (currentIndex + 1) % totalItems;
  }
  return (currentIndex - 1 + totalItems) % totalItems;
}

/**
 * Filter generic options list by text query
 */
export function filterComboboxOptions<T>(
  options: T[],
  query: string,
  getLabel: (item: T) => string,
): T[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return options;
  return options.filter((item) => getLabel(item).toLowerCase().includes(trimmed));
}
