import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EventList } from '@/components/EventList';
import { useGummyWorld } from '@/hooks/useGummyWorld';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { useCalendarEvents, type CalendarEvent } from '@/hooks/useCalendarEvents';
import { diversifyColors } from '@/lib/color';
import { monthKeyFromEvent } from '@/lib/calendar';
import { getEventShape, type EventShape } from '@/lib/eventShapes';
import '@/index.css';

function toGummies(events: CalendarEvent[]): Array<{
  color: string;
  weight: number;
  isBirthday?: boolean;
  title?: string;
  date?: string;
  shape?: EventShape;
}> {
  return events.map((ev) => {
    const title = ev.summary || '';
    const dateStr =
      ev.start?.date ||
      (ev.start?.dateTime ? new Date(ev.start.dateTime).toLocaleDateString('ja-JP') : '');

    // 簡易的な重みの計算
    const isAllDay = !!ev.start?.date && !ev.start?.dateTime;
    const attendees = ev.attendees?.length || 0;
    let durationHours = 0;

    if (ev.start?.dateTime && ev.end?.dateTime) {
      durationHours = Math.max(
        0,
        (new Date(ev.end.dateTime).getTime() - new Date(ev.start.dateTime).getTime()) / 3600000
      );
    }

    const baseWeight = isAllDay ? 0.9 : 1.0;
    let weight = Math.min(
      4,
      baseWeight + Math.log2(attendees + 1) + Math.min(1.5, durationHours / 6)
    );

    // 誕生日判定
    const isBirthday = /誕生日|birthday/i.test(title);
    if (isBirthday) {
      weight = Math.min(4, weight * 1.5);
    }

    // 簡易的な色選択
    const color = isAllDay ? '#FF6B6B' : '#4ECDC4';

    // 形状選択（辞書から判定）
    const shape = getEventShape(title);

    return {
      color,
      weight,
      isBirthday,
      title,
      date: dateStr,
      shape,
    };
  });
}

export default function App() {
  const [year, setYear] = useState(2025);
  const [status, setStatus] = useState('');
  const [keyword, setKeyword] = useState('');
  const [allDayOnly, setAllDayOnly] = useState(false);
  const [isGummified, setIsGummified] = useState(false);

  const { initialize, getAccessToken } = useGoogleAuth();
  const { filteredEvents, fetchEvents, applyFilter } = useCalendarEvents();
  const { canvasRef, addGummies, shakeGummies, addScrollText, getSpeedMultiplier, canvasSize } =
    useGummyWorld({
      centerBias: 0.12,
      inwardForce: 0.0,
      restitution: 0.8,
      maxParticles: 1000,
    });

  useEffect(() => {
    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFetch = async () => {
    setStatus(`${year}年のイベント取得中…`);
    setIsGummified(true); // ボタンを無効化
    try {
      await getAccessToken();
      const events = await fetchEvents(year);
      setStatus(`取得完了:${events.length}件 (グミを生成中…)`);
      toast.success(`${events.length}件のイベントを取得しました`);

      // イベントを古い順にソート
      const sortedEvents = [...events].sort((a, b) => {
        const dateA = a.start?.date || a.start?.dateTime || '';
        const dateB = b.start?.date || b.start?.dateTime || '';
        return dateA.localeCompare(dateB);
      });

      // スクロールテキストを追加（月ごとに区切りを表示）
      const eventsByMonth: Map<string, CalendarEvent[]> = new Map();
      sortedEvents.forEach((ev) => {
        const dateA =
          ev.start?.date ||
          (ev.start?.dateTime ? new Date(ev.start.dateTime).toISOString().split('T')[0] : '');
        const month = dateA.substring(0, 7); // YYYY-MM
        if (!eventsByMonth.has(month)) {
          eventsByMonth.set(month, []);
        }
        eventsByMonth.get(month)!.push(ev);
      });

      // イベントキューを作成（月ヘッダーとイベントのペア、および該当月のグミ生成）
      const eventQueue: Array<{
        text: string;
        date: string;
        isMonthHeader: boolean;
        baseDelay: number;
        monthKey?: string; // 月のキー（グミ生成用）
      }> = [];

      let totalDelay = 0;
      const months = Array.from(eventsByMonth.keys()).sort();
      months.forEach((month) => {
        // 月の表示（この時点でその月のグミを生成）
        eventQueue.push({
          text: `${month.split('-')[1]}月`,
          date: '',
          isMonthHeader: true,
          baseDelay: totalDelay,
          monthKey: month, // YYYY-MM形式
        });
        totalDelay += 1500;

        // その月のイベント
        const monthEvents = eventsByMonth.get(month) || [];
        monthEvents.forEach((ev) => {
          const title = ev.summary || '無題';
          const dateStr =
            ev.start?.date ||
            (ev.start?.dateTime ? new Date(ev.start.dateTime).toLocaleDateString('ja-JP') : '');

          eventQueue.push({
            text: title,
            date: dateStr,
            isMonthHeader: false,
            baseDelay: totalDelay,
          });
          totalDelay += 2000;
        });
      });

      // キューから順次イベントを追加（倍速モードを考慮）
      let queueIndex = 0;
      const processQueue = () => {
        if (queueIndex >= eventQueue.length) return;

        const event = eventQueue[queueIndex];
        const speedMultiplier = getSpeedMultiplier();
        const delay =
          queueIndex === 0
            ? 0
            : (event.baseDelay - eventQueue[queueIndex - 1].baseDelay) / speedMultiplier;

        setTimeout(() => {
          addScrollText(event.text, event.date, event.isMonthHeader);

          // 月ヘッダーの場合、その月のグミを生成
          if (event.isMonthHeader && event.monthKey) {
            const batch = events.filter((ev) => monthKeyFromEvent(ev) === event.monthKey);
            if (batch.length) {
              let gummies = toGummies(batch);
              gummies = diversifyColors(gummies);
              addGummies(gummies);
            }
          }

          queueIndex++;
          processQueue();
        }, delay);
      };

      processQueue();
    } catch (e) {
      const message = e instanceof Error ? e.message : '取得に失敗しました';
      setStatus(`失敗：${message}`);
      toast.error(`エラー: ${message}`);
      setIsGummified(false); // エラー時はボタンを再度有効化
    }
  };

  const handleFilter = () => {
    const filtered = applyFilter({ keyword, allDayOnly });
    setStatus(`フィルター適用：${filtered.length}件`);
  };

  return (
    <div className="container mx-auto p-6 space-y-4">
      <div className="flex items-baseline gap-3">
        <h1 className="text-3xl font-bold">カレンダーの予定をグミにする</h1>
        <span className="text-sm text-muted-foreground">〜一年を振り返ろう〜</span>
      </div>

      <Card className="p-4">
        <div className="flex gap-4 items-center flex-wrap">
          <div className="flex items-center gap-2">
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2023">2023</SelectItem>
                <SelectItem value="2024">2024</SelectItem>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2026">2026</SelectItem>
              </SelectContent>
            </Select>
            <label>年のカレンダーを</label>
          </div>
          <Button
            onClick={() => {
              void handleFetch();
            }}
            disabled={isGummified}
          >
            グミにする
          </Button>
          <Button variant="outline" onClick={shakeGummies}>
            ゆらす
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const text = `${year}年のカレンダーイベント${filteredEvents.length}件をグミにしました！#グミカレンダー #GummyCalendar`;
              const url = window.location.origin;
              const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
              window.open(xUrl, '_blank');
            }}
          >
            Xに投稿
          </Button>
          <span className="text-sm text-muted-foreground">{status}</span>
        </div>
      </Card>

      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="border border-border rounded-md w-full h-auto block"
        style={{ maxWidth: '100%', display: 'block' }}
      />

      <Card className="p-4">
        <div className="flex gap-4 items-center flex-wrap">
          <Input
            placeholder="キーワード（タイトル/説明）"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="max-w-xs"
          />
          <div className="flex items-center gap-2">
            <Checkbox
              id="allDayOnly"
              checked={allDayOnly}
              onCheckedChange={(checked) => setAllDayOnly(checked === true)}
            />
            <Label htmlFor="allDayOnly">終日の予定のみ</Label>
          </div>
          <Button onClick={handleFilter} variant="secondary">
            フィルター適用
          </Button>
        </div>
      </Card>

      <div className="text-sm text-muted-foreground mb-2">
        取得済みイベント: {filteredEvents.length}件
      </div>

      <EventList events={filteredEvents} />
    </div>
  );
}
