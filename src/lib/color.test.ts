import { describe, it, expect } from 'vitest';
import { diversifyColors } from '@/lib/color';

describe('color utilities', () => {
  describe('diversifyColors', () => {
    it('単色のグミに多様性を追加', () => {
      const gummies = [
        { color: '#ff0000', weight: 1 },
        { color: '#ff0000', weight: 1 },
        { color: '#ff0000', weight: 1 },
      ];

      const result = diversifyColors(gummies);
      const uniqueColors = new Set(result.map((g) => g.color));
      expect(uniqueColors.size).toBeGreaterThan(1);
    });
  });
});
