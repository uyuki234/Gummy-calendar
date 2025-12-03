import { useEffect, useRef, useState } from 'react';
import { GummyWorld } from '@/physics/GummyWorld';

type GummyData = {
  color: string;
  weight: number;
};

interface UseGummyWorldReturn {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  addGummies: (gummies: GummyData[]) => void;
  canvasSize: { width: number; height: number };
}

export function useGummyWorld(config?: {
  centerBias?: number;
  inwardForce?: number;
  restitution?: number;
  maxParticles?: number;
}): UseGummyWorldReturn {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<GummyWorld | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 900, height: 500 });

  useEffect(() => {
    const updateSize = () => {
      // 画面サイズに追従（コンテナ幅優先、なければビューポート幅）
      const vw = Math.max(320, window.innerWidth);
      const vh = Math.max(360, window.innerHeight);
      let width = vw;
      let height = Math.floor(vh * 0.7); // ヘッダーやコントロールを考慮した高さ割合
      if (canvasRef.current) {
        const container = canvasRef.current.parentElement;
        if (container) {
          width = container.clientWidth; // Tailwindのw-fullに合わせる
        }
      }
      setCanvasSize({ width, height });
    };

    updateSize();
    window.addEventListener('resize', updateSize);

    return () => {
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    // 初期化は一度だけ
    if (!worldRef.current) {
      worldRef.current = new GummyWorld(canvasRef.current, config);
    }
    // サイズ変更に追従
    worldRef.current.setSize(canvasSize.width, canvasSize.height);

    return () => {
      // クリーンアップ（必要に応じて）
      // worldRef.currentは維持（アンマウント時は上位で破棄される想定）
    };
  }, [config, canvasSize]);

  const addGummies = (gummies: GummyData[]) => {
    if (worldRef.current) {
      worldRef.current.addGummies(gummies);
    }
  };

  return {
    canvasRef,
    addGummies,
    canvasSize,
  };
}
