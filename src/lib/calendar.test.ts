import { describe, it, expect } from 'vitest';
import { formatEventDate, monthKeyFromEvent, groupByMonth } from '@/lib/calendar';
import type { CalendarEvent } from '@/types/calendar';

describe('calendar utilities', () => {
  describe('formatEventDate', () => {
    it('日付形式のイベントをフォーマット', () => {
      const event: CalendarEvent = {
        id: '1',
        start: { date: '2025-01-15' },
      };
      expect(formatEventDate(event)).toBe('2025-01-15');
    });

    it('日時形式のイベントをフォーマット', () => {
      const event: CalendarEvent = {
        id: '1',
        start: { dateTime: '2025-01-15T10:00:00Z' },
      };
      const result = formatEventDate(event);
      expect(result).toMatch(/2025-01-\d{2}/);
    });

    it('start情報がない場合は空文字を返す', () => {
      const event: CalendarEvent = {
        id: '1',
      };
      expect(formatEventDate(event)).toBe('');
    });
  });

  describe('monthKeyFromEvent', () => {
    it('イベントから年月キーを抽出', () => {
      const event: CalendarEvent = {
        id: '1',
        start: { date: '2025-01-15' },
      };
      expect(monthKeyFromEvent(event)).toBe('2025-01');
    });
  });

  describe('groupByMonth', () => {
    it('イベントを月ごとにグループ化', () => {
      const events: CalendarEvent[] = [
        { id: '1', start: { date: '2025-01-15' } },
        { id: '2', start: { date: '2025-01-20' } },
        { id: '3', start: { date: '2025-02-10' } },
      ];

      const grouped = groupByMonth(events);
      expect(grouped.size).toBe(2);
      expect(grouped.get('2025-01')?.length).toBe(2);
      expect(grouped.get('2025-02')?.length).toBe(1);
    });
  });
});
