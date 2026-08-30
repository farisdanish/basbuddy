import { describe, it, expect } from 'vitest';
import { getNextActiveIndex, filterComboboxOptions } from '../comboboxNavigation.ts';

describe('comboboxNavigation', () => {
  describe('getNextActiveIndex', () => {
    it('returns -1 when there are zero items', () => {
      expect(getNextActiveIndex(-1, 0, 'next')).toBe(-1);
      expect(getNextActiveIndex(0, 0, 'prev')).toBe(-1);
    });

    it('handles initial focus navigation from -1', () => {
      expect(getNextActiveIndex(-1, 5, 'next')).toBe(0);
      expect(getNextActiveIndex(-1, 5, 'prev')).toBe(4);
    });

    it('advances to next index with wrap-around', () => {
      expect(getNextActiveIndex(0, 3, 'next')).toBe(1);
      expect(getNextActiveIndex(1, 3, 'next')).toBe(2);
      expect(getNextActiveIndex(2, 3, 'next')).toBe(0);
    });

    it('regresses to previous index with wrap-around', () => {
      expect(getNextActiveIndex(2, 3, 'prev')).toBe(1);
      expect(getNextActiveIndex(1, 3, 'prev')).toBe(0);
      expect(getNextActiveIndex(0, 3, 'prev')).toBe(2);
    });
  });

  describe('filterComboboxOptions', () => {
    const items = [
      { id: '1', title: 'Pasar Seni' },
      { id: '2', title: 'KL Sentral' },
      { id: '3', title: 'Mid Valley' },
    ];

    it('returns all items when query is empty or whitespace', () => {
      expect(filterComboboxOptions(items, '', (i) => i.title)).toEqual(items);
      expect(filterComboboxOptions(items, '  ', (i) => i.title)).toEqual(items);
    });

    it('filters items matching substring case-insensitively', () => {
      const results = filterComboboxOptions(items, 'pasar', (i) => i.title);
      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe('1');
    });

    it('returns empty array when query does not match', () => {
      const results = filterComboboxOptions(items, 'bangsar', (i) => i.title);
      expect(results).toEqual([]);
    });
  });
});
