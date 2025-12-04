import { useEffect, useRef, useState } from 'react';
import { GummyWorld } from '@/physics/GummyWorld';

type GummyData = {
  color: string;
  weight: number;
};

interface UseGummyWorldReturn {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  addGummies: (
    gummies: (GummyData & {
      isBirthday?: boolean;
      title?: string;
      date?: string;
      shape?: 'circle' | 'square' | 'pencil' | 'heart' | 'star';
    })[]
  ) => void;
  clearGummies: () => void;
  shakeGummies: () => void;
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
      if (canvasRef.current) {
        const container = canvasRef.current.parentElement;
        if (container) {
          // 容器の実際の幅を取得（パディング除外）
          const containerWidth = container.clientWidth;
          // 容器内の他のコンポーネント（入力欄など）の高さを考慮
          const availableHeight = Math.max(360, window.innerHeight * 0.6);

          // キャンバスサイズを更新
          setCanvasSize({ width: containerWidth, height: availableHeight });
          return;
        }
      }
      // フォールバック
      setCanvasSize({ width: 900, height: 500 });
    };

    updateSize();

    // リサイズイベントとリサイズオブザーバーの両方で対応
    window.addEventListener('resize', updateSize);

    // 容器のリサイズもトラッキング
    if (canvasRef.current?.parentElement) {
      const resizeObserver = new ResizeObserver(updateSize);
      resizeObserver.observe(canvasRef.current.parentElement);

      return () => {
        window.removeEventListener('resize', updateSize);
        resizeObserver.disconnect();
      };
    }

    return () => {
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    if (!worldRef.current) {
      worldRef.current = new GummyWorld(canvasRef.current, config);
    }
    worldRef.current.setSize(canvasSize.width, canvasSize.height);

    return () => {
      // クリーンアップ
    };
  }, [config, canvasSize]);

  const addGummies = (
    gummies: (GummyData & {
      isBirthday?: boolean;
      title?: string;
      date?: string;
      shape?: 'circle' | 'square' | 'pencil' | 'heart' | 'star';
    })[]
  ) => {
    if (worldRef.current) {
      worldRef.current.addGummies(gummies);
    }
  };

  const clearGummies = () => {
    if (worldRef.current) {
      worldRef.current.clear();
    }
  };

  const shakeGummies = () => {
    if (worldRef.current) {
      worldRef.current.shake();
    }
  };

  return {
    canvasRef,
    addGummies,
    clearGummies,
    shakeGummies,
    canvasSize,
  };
}
