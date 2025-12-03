import { describe, it, expect } from 'vitest';
import { colorFromEmotionText, diversifyColors } from '@/lib/color';

describe('color utilities', () => {
  describe('colorFromEmotionText', () => {
    it('感情テキストから色を生成', () => {
      const result = colorFromEmotionText('楽しい会議', {
        isAllDay: false,
        attendees: 5,
        durationHours: 1,
      });

      expect(result).toHaveProperty('hex');
      expect(result).toHaveProperty('h');
      expect(result).toHaveProperty('s');
      expect(result).toHaveProperty('l');
      expect(result.hex).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('終日イベントは明るい色になる', () => {
      const allDay = colorFromEmotionText('イベント', {
        isAllDay: true,
        attendees: 0,
        durationHours: 0,
      });

      const timed = colorFromEmotionText('イベント', {
        isAllDay: false,
        attendees: 0,
        durationHours: 1,
      });

      expect(allDay.l).toBeGreaterThan(timed.l);
    });
  });

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
