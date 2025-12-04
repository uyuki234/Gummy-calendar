export type ShapeKind = 'circle' | 'square' | 'pencil' | 'heart' | 'star';

export function classifyShape(text: string): ShapeKind {
  const lower = text.toLowerCase();
  if (/会議|mtg|meeting|打ち合わせ|ミーティング/.test(lower)) return 'square';
  if (/勉強|study|講義|学習|自習|ゼミ|課題|論文/.test(lower)) return 'pencil';
  if (/デート|恋|love|遊び|映画|友達|ランチ|飲み会/.test(lower)) return 'heart';
  if (/旅行|trip|旅|遠出|holiday|vacation|観光/.test(lower)) return 'star';
  return 'circle';
}

export function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '').match(/.{1,2}/g);
  const [r, g, b] = (m ?? ['00', '00', '00']).map((x) => parseInt(x, 16));
  return [r, g, b];
}

export function shade(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const factor = amount >= 0 ? 1 + amount : 1 + amount;
  const rr = Math.round(Math.max(0, Math.min(255, r * factor)));
  const gg = Math.round(Math.max(0, Math.min(255, g * factor)));
  const bb = Math.round(Math.max(0, Math.min(255, b * factor)));
  return `#${[rr, gg, bb].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

export function drawCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  fill: string
) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  // ハイライト
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.arc(cx - r * 0.4, cy - r * 0.45, r * 0.28, 0, Math.PI * 2);
  ctx.fill();
}

export function drawSquare(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  fill: string
) {
  const s = r * 1.6; // 少し大きめ
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.rect(cx - s / 2, cy - s / 2, s, s);
  ctx.fill();
  // ハイライト
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.rect(cx - s * 0.3, cy - s * 0.35, s * 0.3, s * 0.25);
  ctx.fill();
}

export function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  fill: string
) {
  // 5角スター
  const spikes = 5;
  const outer = r * 1.8;
  const inner = r * 0.8;
  let rot = (Math.PI / 2) * 3;

  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(cx, cy - outer);
  for (let i = 0; i < spikes; i++) {
    const x = cx + Math.cos(rot) * outer;
    const y = cy + Math.sin(rot) * outer;
    ctx.lineTo(x, y);
    rot += Math.PI / spikes;

    const x2 = cx + Math.cos(rot) * inner;
    const y2 = cy + Math.sin(rot) * inner;
    ctx.lineTo(x2, y2);
    rot += Math.PI / spikes;
  }
  ctx.closePath();
  ctx.fill();
  // ハイライト
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.arc(cx - r * 0.4, cy - r * 0.4, r * 0.25, 0, Math.PI * 2);
  ctx.fill();
}

export function drawHeart(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  fill: string
) {
  // ハート（ベジェ曲線の簡易版）
  const s = r * 1.6;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.2);
  ctx.bezierCurveTo(cx - s, cy - s * 0.5, cx - s * 0.8, cy - s * 1.4, cx, cy - s * 0.9);
  ctx.bezierCurveTo(cx + s * 0.8, cy - s * 1.4, cx + s, cy - s * 0.5, cx, cy + s * 0.2);
  ctx.closePath();
  ctx.fill();
  // ハイライト
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.arc(cx - r * 0.3, cy - r * 0.3, r * 0.2, 0, Math.PI * 2);
  ctx.fill();
}

export function drawPencil(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  fill: string
) {
  // 鉛筆（本体＝長方形＋先端＝三角＋消しゴム＝短い長方形）
  const len = r * 3.2; // 長さ
  const width = r * 0.9; // 太さ
  const angle = -Math.PI / 6; // 斜めに
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  // 基準の4点（本体の長方形）
  const x1 = cx - len / 2;
  const y1 = cy - width / 2;
  const x2 = cx + len / 2;
  const y2 = cy - width / 2;
  const x3 = cx + len / 2;
  const y3 = cy + width / 2;
  const x4 = cx - len / 2;
  const y4 = cy + width / 2;

  // 回転変換
  const rot = (x: number, y: number) => ({
    x: cx + (x - cx) * cos - (y - cy) * sin,
    y: cy + (x - cx) * sin + (y - cy) * cos,
  });

  const p1 = rot(x1, y1);
  const p2 = rot(x2, y2);
  const p3 = rot(x3, y3);
  const p4 = rot(x4, y4);

  // 本体
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.lineTo(p3.x, p3.y);
  ctx.lineTo(p4.x, p4.y);
  ctx.closePath();
  ctx.fill();

  // 先端（三角：芯は少し暗い色）
  const tipLen = width * 0.9;
  const tipMid = rot(cx + len / 2 + tipLen, cy); // 先端の頂点

  ctx.fillStyle = shade(fill, -0.25);
  ctx.beginPath();
  ctx.moveTo(p2.x, p2.y);
  ctx.lineTo(p3.x, p3.y);
  ctx.lineTo(tipMid.x, tipMid.y);
  ctx.closePath();
  ctx.fill();

  // 消しゴム（反対側を少し淡色で）
  const eraserLen = width * 0.7;
  const erBase1 = rot(cx - len / 2 - eraserLen, cy - width / 2);
  const erBase2 = rot(cx - len / 2 - eraserLen, cy + width / 2);

  ctx.fillStyle = shade(fill, 0.2);
  ctx.beginPath();
  ctx.moveTo(erBase1.x, erBase1.y);
  ctx.lineTo(p1.x, p1.y);
  ctx.lineTo(p4.x, p4.y);
  ctx.lineTo(erBase2.x, erBase2.y);
  ctx.closePath();
  ctx.fill();
}

export function drawShape(
  ctx: CanvasRenderingContext2D,
  shape: ShapeKind,
  cx: number,
  cy: number,
  r: number,
  fill: string,
  angle: number = 0
) {
  switch (shape) {
    case 'circle':
      drawCircle(ctx, cx, cy, r, fill);
      break;
    case 'square':
      drawSquare(ctx, cx, cy, r, fill);
      break;
    case 'star':
      drawStar(ctx, cx, cy, r, fill);
      break;
    case 'heart':
      drawHeart(ctx, cx, cy, r, fill);
      break;
    case 'pencil':
      drawPencilWithRotation(ctx, cx, cy, r, fill, angle);
      break;
  }
}

// 回転を考慮した鉛筆描画
export function drawPencilWithRotation(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  fill: string,
  angle: number
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.translate(-cx, -cy);
  drawPencil(ctx, cx, cy, r, fill);
  ctx.restore();
}

// AABB判定関数群
export type Bounds = { minX: number; maxX: number; minY: number; maxY: number };

export function getShapeBounds(
  shape: ShapeKind,
  cx: number,
  cy: number,
  r: number,
  angle: number = 0
): Bounds {
  switch (shape) {
    case 'circle':
      return { minX: cx - r, maxX: cx + r, minY: cy - r, maxY: cy + r };
    case 'square': {
      const s = (r * 1.6) / 2; // 正方形の半辺
      return { minX: cx - s, maxX: cx + s, minY: cy - s, maxY: cy + s };
    }
    case 'star': {
      // スターは外接円
      const starR = r * 1.8;
      return { minX: cx - starR, maxX: cx + starR, minY: cy - starR, maxY: cy + starR };
    }
    case 'heart': {
      const hS = r * 1.6;
      return { minX: cx - hS, maxX: cx + hS, minY: cy - hS * 1.4, maxY: cy + hS * 0.2 };
    }
    case 'pencil': {
      // 鉛筆の回転矩形のAABB
      const len = r * 3.2;
      const width = r * 0.9;
      const tipLen = width * 0.9;
      const eraserLen = width * 0.7;

      // 8つの頂点を生成（本体4点+先端1点+消しゴムベース2点）
      const x1 = -len / 2;
      const y1 = -width / 2;
      const x2 = len / 2;
      const y2 = -width / 2;
      const x3 = len / 2;
      const y3 = width / 2;
      const x4 = -len / 2;
      const y4 = width / 2;
      const tipX = len / 2 + tipLen;
      const tipY = 0;
      const erX = -len / 2 - eraserLen;
      const erY1 = -width / 2;
      const erY2 = width / 2;

      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      const rotatePoint = (x: number, y: number) => ({
        x: x * cos - y * sin,
        y: x * sin + y * cos,
      });

      const points = [
        rotatePoint(x1, y1),
        rotatePoint(x2, y2),
        rotatePoint(x3, y3),
        rotatePoint(x4, y4),
        rotatePoint(tipX, tipY),
        rotatePoint(erX, erY1),
        rotatePoint(erX, erY2),
      ];

      let minX = points[0].x,
        maxX = points[0].x,
        minY = points[0].y,
        maxY = points[0].y;
      for (const p of points) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      }

      return { minX: cx + minX, maxX: cx + maxX, minY: cy + minY, maxY: cy + maxY };
    }
  }
}

// AABB衝突判定
export function boundsIntersect(b1: Bounds, b2: Bounds): boolean {
  return !(b1.maxX < b2.minX || b1.minX > b2.maxX || b1.maxY < b2.minY || b1.minY > b2.maxY);
}
