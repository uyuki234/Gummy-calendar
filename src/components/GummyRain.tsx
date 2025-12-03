import { useEffect, useRef } from "react";
import { Bodies, Engine, Render, Runner, Composite } from "matter-js";
import { colorFromTitle, kindFromTitle } from "../lib/colorAI";
import type { CalendarEvent } from "../lib/types";

export default function GummyRain({ events }: { events: CalendarEvent[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const width = canvasRef.current.clientWidth || 800;
    const height = 600;

    const engine = Engine.create();
    engine.gravity.y = 1;
    const render = Render.create({
      canvas: canvasRef.current,
      engine,
      options: { width, height, background: "#f8fafc", wireframes: false },
    });
    const runner = Runner.create();

    const floor = Bodies.rectangle(width / 2, height + 20, width, 40, {
      isStatic: true,
    });
    const left = Bodies.rectangle(-20, height / 2, 40, height, {
      isStatic: true,
    });
    const right = Bodies.rectangle(width + 20, height / 2, 40, height, {
      isStatic: true,
    });
    Composite.add(engine.world, [floor, left, right]);

    let idx = 0;
    const interval = setInterval(() => {
      if (idx >= events.length) {
        clearInterval(interval);
        return;
      }
      const ev = events[idx++];
      const kind = kindFromTitle(ev.title);
      const color = colorFromTitle(ev.title);
      const x = Math.random() * (width - 100) + 50;
      const durationHours = ev.end
        ? (ev.end.getTime() - ev.start.getTime()) / (1000 * 60 * 60)
        : 1;
      const size = Math.min(80, Math.max(30, durationHours * 10));

      let body;
      switch (kind) {
        case "circle":
          body = Bodies.circle(x, -50, size / 2, {
            restitution: 0.5,
            render: { fillStyle: color },
          });
          break;
        case "capsule":
          body = Bodies.rectangle(x, -50, size, size / 2, {
            chamfer: { radius: size / 3 },
            restitution: 0.4,
            render: { fillStyle: color },
          });
          break;
        case "star":
          body = Bodies.polygon(x, -50, 5, size / 2, {
            restitution: 0.6,
            render: { fillStyle: color },
          });
          break;
        default:
          throw new Error(`Unknown kind: ${kind}`);
      }
      Composite.add(engine.world, body);

      const bodies = Composite.allBodies(engine.world);
      if (bodies.length > 350) {
        // Remove a smaller batch (e.g., 10) to avoid performance spikes
        Composite.remove(engine.world, bodies.slice(0, 10));
      }
    }, 100);

    Runner.run(runner, engine);
    Render.run(render);

    return () => {
      clearInterval(interval);
      Render.stop(render);
      Runner.stop(runner);
      Composite.clear(engine.world, false);
      render.canvas?.remove();
    };
  }, [events]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "60vh", display: "block" }}
    />
  );
}
