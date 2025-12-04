import { clamp, wrapHue } from './utils';
import { scoreEmotion } from './emotion';

export function hslToHex(h: number, s: number, l: number) {
  s = clamp(s, 0, 1);
  l = clamp(l, 0, 1);
  const c = (1 - Math.abs(2 * l - 1)) * s,
    hp = (h % 360) / 60,
    x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0,
    g1 = 0,
    b1 = 0;
  if (0 <= hp && hp < 1) {
    r1 = c;
    g1 = x;
  } else if (1 <= hp && hp < 2) {
    r1 = x;
    g1 = c;
  } else if (2 <= hp && hp < 3) {
    g1 = c;
    b1 = x;
  } else if (3 <= hp && hp < 4) {
    g1 = x;
    b1 = c;
  } else if (4 <= hp && hp < 5) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }
  const m = l - c / 2,
    r = Math.round((r1 + m) * 255),
    g = Math.round((g1 + m) * 255),
    b = Math.round((b1 + m) * 255);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

const BASE_HUE = { joy: 50, calm: 200, busy: 0, focus: 120, stress: 300 };

export function colorFromEmotionText(
  text: string,
  ctx: { isAllDay: boolean; attendees: number; durationHours: number }
) {
  const scores = scoreEmotion(text);
  // ベクトル平均
  const entries = Object.entries(scores).filter(([k]) => k in BASE_HUE) as Array<
    [keyof typeof BASE_HUE, number]
  >;
  const totalW = entries.reduce((a, [, w]) => a + Number(w), 0) || 1;
  let vx = 0,
    vy = 0;
  for (const [k, w] of entries) {
    const rad = (BASE_HUE[k] * Math.PI) / 180;
    vx += Math.cos(rad) * (Number(w) / totalW);
    vy += Math.sin(rad) * (Number(w) / totalW);
  }
  let h = (Math.atan2(vy, vx) * 180) / Math.PI;
  if (h < 0) h += 360;
  // 彩度・明度
  let s = 0.35 + scores.intensity * 0.55;
  let l = ctx.isAllDay ? 0.65 : 0.55;
  l -= Math.min(10, ctx.attendees) * 0.015;
  l -= Math.min(12, ctx.durationHours) * 0.01;
  // 暖色補正（茶色防止）
  const warm = h >= 15 && h <= 75;
  if (warm) {
    s = Math.max(s, 0.6);
    l = Math.max(l, 0.5);
  }
  s = clamp(s + scores.intensity * 0.1, 0, 1);
  l = clamp(l, 0.35, 0.75);
  const hex = hslToHex(wrapHue(h), s, l);
  return { hex, h, s, l, scores };
}

export function diversifyColors<
  T extends { color: string; hsl?: { h: number; s: number; l: number } },
>(
  gummies: T[],
  opts?: Partial<{
    threshold: number;
    jitterDeg: number;
    satMin: number;
    satMax: number;
    lightMin: number;
    lightMax: number;
  }>
) {
  const {
    threshold = 0.6,
    jitterDeg = 22,
    satMin = 0.55,
    satMax = 0.9,
    lightMin = 0.45,
    lightMax = 0.65,
  } = opts || {};
  const families = (h: number) => {
    if (h < 30 || h >= 330) return 'red';
    if (h < 60) return 'orange';
    if (h < 90) return 'yellow';
    if (h < 150) return 'green';
    if (h < 210) return 'cyan';
    if (h < 270) return 'blue';
    return 'purple';
  };
  const hueFromHex = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255,
      g = (n >> 8) & 255,
      b = n & 255;
    const max = Math.max(r, g, b) / 255,
      min = Math.min(r, g, b) / 255;
    let h = 0;
    const d = max - min;
    if (d) {
      const rr = r / 255,
        gg = g / 255,
        bb = b / 255;
      // const l = (max + min) / 2,
      //   s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case rr:
          h = (gg - bb) / d + (gg < bb ? 6 : 0);
          break;
        case gg:
          h = (bb - rr) / d + 2;
          break;
        default:
          h = (rr - gg) / d + 4;
      }
      h *= 60;
    }
    return h;
  };
  const count: Record<string, number> = {};
  const total = gummies.length || 1;
  for (const g of gummies) {
    const h = g.hsl?.h ?? hueFromHex(g.color);
    const fam = families(h);
    count[fam] = (count[fam] || 0) + 1;
  }
  let dominant: string | null = null,
    p = 0;
  for (const [fam, c] of Object.entries(count)) {
    const q = c / total;
    if (q > p) {
      p = q;
      dominant = fam;
    }
  }
  if (!dominant || p < threshold) return gummies;

  const center =
    {
      red: 0,
      orange: 45,
      yellow: 75,
      green: 120,
      cyan: 180,
      blue: 240,
      purple: 300,
    }[dominant] ?? 180;
  let idx = 0;
  const golden = 137.5;
  return gummies.map((g) => {
    const h = g.hsl?.h ?? hueFromHex(g.color);
    if (families(h) !== dominant) return g;
    const jitter = ((idx++ * golden) % (jitterDeg * 2)) - jitterDeg;
    const newH = wrapHue(center + jitter);
    const newS = clamp(satMin + Math.random() * (satMax - satMin), 0, 1);
    const newL = clamp(lightMin + Math.random() * (lightMax - lightMin), 0, 1);
    return {
      ...g,
      color: hslToHex(newH, newS, newL),
      hsl: { h: newH, s: newS, l: newL },
    };
  });
}
