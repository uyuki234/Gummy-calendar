import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 既存のユーティリティ関数
export function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

export function wrapHue(h: number): number {
  while (h < 0) h += 360;
  while (h >= 360) h -= 360;
  return h;
}

export function downloadJSON(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
