/**
 * イベントタイトルから形状を判定する辞書
 */

export type EventShape =
  | 'circle'
  | 'square'
  | 'pencil'
  | 'heart'
  | 'bag'
  | 'calendar'
  | 'folder'
  | 'book'
  | 'briefcase'
  | 'plane'
  | 'car'
  | 'game'
  | 'bed'
  | 'hospital';

interface ShapeRule {
  shape: EventShape;
  patterns: RegExp;
}

const shapeRules: ShapeRule[] = [
  // 仕事・会議系
  {
    shape: 'calendar',
    patterns: /会議|ミーティング|meeting|mtg|打ち合わせ|打合せ|面談|面接|interview/i,
  },
  {
    shape: 'folder',
    patterns: /資料|書類|ドキュメント|document|報告|レポート|report|プレゼン|presentation|発表/i,
  },
  {
    shape: 'briefcase',
    patterns: /仕事|ビジネス|business|work|出勤|営業|商談|契約|プロジェクト|project/i,
  },
  {
    shape: 'square',
    patterns: /タスク|task|todo|作業|アポ|appointment|予定|スケジュール/i,
  },

  // 勉強・学習系
  {
    shape: 'pencil',
    patterns: /勉強|study|学習|learning|課題|宿題|homework|テスト|試験|exam|復習|予習|受験/i,
  },
  {
    shape: 'book',
    patterns: /読書|本|book|図書|ライブラリ|library|論文|研究|セミナー|seminar|講義|授業|lecture/i,
  },

  // 遊び・デート系
  {
    shape: 'heart',
    patterns: /デート|date|love|ラブ|恋愛|彼氏|彼女|恋人|パートナー|記念日|anniversary/i,
  },
  {
    shape: 'game',
    patterns:
      /ゲーム|game|遊び|play|娯楽|映画|movie|シネマ|cinema|カラオケ|karaoke|ボーリング|bowling/i,
  },

  // 旅行・お出かけ系
  {
    shape: 'plane',
    patterns: /旅行|trip|travel|観光|tour|ツアー|飛行機|フライト|flight|空港|airport/i,
  },
  {
    shape: 'bag',
    patterns: /出張|外出|お出かけ|おでかけ|散歩|walk|ショッピング|買い物|買物|shopping/i,
  },
  {
    shape: 'car',
    patterns: /ドライブ|drive|車|car|移動|帰省|実家|帰宅/i,
  },

  // ライフイベント系
  {
    shape: 'bed',
    patterns: /休み|休暇|holiday|vacation|休養|休息|睡眠|sleep|リラックス|relax|オフ|off/i,
  },
  {
    shape: 'hospital',
    patterns: /病院|hospital|通院|診察|検診|健診|医者|doctor|歯医者|dentist|薬局|pharmacy/i,
  },
];

/**
 * イベントタイトルから形状を判定する
 * @param title イベントタイトル
 * @returns 形状 (デフォルトは 'circle')
 */
export function getEventShape(title: string): EventShape {
  const lower = title.toLowerCase();

  for (const rule of shapeRules) {
    if (rule.patterns.test(lower)) {
      return rule.shape;
    }
  }

  return 'circle';
}
