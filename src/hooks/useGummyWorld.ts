import { useEffect, useRef } from 'react';
import { GummyWorld } from '@/physics/GummyWorld';

type GummyData = {
  color: string;
  weight: number;
};

export function useGummyWorld(config?: {
  centerBias?: number;
  inwardForce?: number;
  restitution?: number;
  maxParticles?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<GummyWorld | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    worldRef.current = new GummyWorld(canvasRef.current, config);

    return () => {
      // クリーンアップ（必要に応じて）
      worldRef.current = null;
    };
  }, [config]);

  const addGummies = (gummies: GummyData[]) => {
    if (worldRef.current) {
      worldRef.current.addGummies(gummies);
    }
  };

  return { canvasRef, addGummies };
}
