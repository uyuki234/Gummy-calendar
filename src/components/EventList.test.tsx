import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { EventList } from '@/components/EventList';
import type { CalendarEvent } from '@/types/calendar';

describe('EventList', () => {
  it('イベント一覧がレンダリング', () => {
    const mockEvents: CalendarEvent[] = [
      {
        id: '1',
        summary: 'テストイベント1',
        start: { date: '2025-01-15' },
        end: { date: '2025-01-15' },
      },
      {
        id: '2',
        summary: 'テストイベント2',
        start: { date: '2025-01-20' },
        end: { date: '2025-01-20' },
      },
    ];

    const { container } = render(<EventList events={mockEvents} />);
    expect(container).toBeTruthy();
  });
});
