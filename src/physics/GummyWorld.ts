type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  m: number;
  color: string;
};
export class GummyWorld {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private W: number;
  private H: number;
  private raf = 0;
  private particles: Particle[] = [];
  private cfg = {
    gravity: 0.45,
    air: 0.995,
    restitution: 0.25,
    frictionTangent: 0.02,
    centerBias: 0.12,
    inwardForce: 0.0,
    maxParticles: 1000,
    cellSize: 24,
  };
  constructor(canvas: HTMLCanvasElement, cfg?: Partial<typeof this.cfg>) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.W = canvas.width;
    this.H = canvas.height;
    Object.assign(this.cfg, cfg || {});
    this.loop = this.loop.bind(this);
  }
  setSize(width: number, height: number) {
    if (width === this.W && height === this.H) return;
    this.canvas.width = width;
    this.canvas.height = height;
    this.W = width;
    this.H = height;
  }
  private randNormal(mean = 0, std = 1) {
    const u = 1 - Math.random(),
      v = 1 - Math.random();
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return mean + z * std;
  }
  addGummies(gummies: { color: string; weight: number }[]) {
    const cx = this.W / 2,
      sigmaX = this.W * this.cfg.centerBias;
    for (const g of gummies) {
      const x = Math.max(20, Math.min(this.W - 20, cx + this.randNormal(0, sigmaX)));
      this.particles.push({
        x,
        y: -Math.random() * 200 - 20,
        vx: (Math.random() - 0.5) * 0.25,
        vy: 0,
        r: Math.max(6, 5 + g.weight * 3),
        m: Math.max(1, g.weight),
        color: g.color,
      });
    }
    if (this.particles.length > this.cfg.maxParticles)
      this.particles.splice(0, this.particles.length - this.cfg.maxParticles);
    if (!this.raf)
      this.raf = requestAnimationFrame(() => {
        this.loop();
      });
  }
  clear() {
    this.particles.length = 0;
  }
  private buildGrid() {
    const grid = new Map<string, number[]>(),
      s = this.cfg.cellSize;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const ix = Math.floor(p.x / s),
        iy = Math.floor(p.y / s);
      const k = `${ix},${iy}`;
      const arr = grid.get(k) || [];
      arr.push(i);
      grid.set(k, arr);
    }
    return grid;
  }
  private resolve(i: number, j: number) {
    const p = this.particles[i],
      q = this.particles[j];
    const dx = q.x - p.x,
      dy = q.y - p.y,
      rSum = p.r + q.r;
    const d2 = dx * dx + dy * dy;
    if (d2 <= 0 || d2 >= rSum * rSum) return;
    const d = Math.sqrt(d2) || 0.0001,
      nx = dx / d,
      ny = dy / d,
      overlap = rSum - d;
    const tm = p.m + q.m,
      pushP = overlap * (q.m / tm),
      pushQ = overlap * (p.m / tm);
    p.x -= nx * pushP;
    p.y -= ny * pushP;
    q.x += nx * pushQ;
    q.y += ny * pushQ;
    const rvx = q.vx - p.vx,
      rvy = q.vy - p.vy,
      relN = rvx * nx + rvy * ny;
    if (relN < 0) {
      const e = this.cfg.restitution,
        j = (-(1 + e) * relN) / (1 / p.m + 1 / q.m),
        jx = j * nx,
        jy = j * ny;
      p.vx -= jx / p.m;
      p.vy -= jy / p.m;
      q.vx += jx / q.m;
      q.vy += jy / q.m;
      const tx = -ny,
        ty = nx,
        relT = rvx * tx + rvy * ty,
        jt = Math.max(-this.cfg.frictionTangent, Math.min(this.cfg.frictionTangent, relT));
      p.vx -= (jt * tx) / p.m;
      p.vy -= (jt * ty) / p.m;
      q.vx += (jt * tx) / q.m;
      q.vy += (jt * ty) / q.m;
    }
  }
  private step() {
    const floorY = this.H - 10,
      leftX = 0,
      rightX = this.W,
      cx = this.W / 2;
    for (const p of this.particles) {
      p.vx += (cx - p.x) * this.cfg.inwardForce;
      p.vy += this.cfg.gravity;
      p.vx *= this.cfg.air;
      p.vy *= this.cfg.air;
      p.x += p.vx;
      p.y += p.vy;
      if (p.x - p.r < leftX) {
        p.x = leftX + p.r;
        p.vx *= -this.cfg.restitution;
      } else if (p.x + p.r > rightX) {
        p.x = rightX - p.r;
        p.vx *= -this.cfg.restitution;
      }
      if (p.y + p.r > floorY) {
        p.y = floorY - p.r;
        p.vy *= -this.cfg.restitution;
        if (Math.abs(p.vy) < 0.25) p.vy = 0;
      }
    }
    const grid = this.buildGrid(),
      neigh = [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
        [-1, 0],
        [0, -1],
        [-1, -1],
        [1, -1],
        [-1, 1],
      ];
    for (const [key, idxs] of grid) {
      const [ix, iy] = key.split(',').map(Number);
      for (const [dx, dy] of neigh) {
        const nk = `${ix + dx},${iy + dy}`,
          nbr = grid.get(nk);
        if (!nbr) continue;
        for (const i of idxs) {
          for (const j of nbr) {
            if (j <= i) continue;
            this.resolve(i, j);
          }
        }
      }
    }
  }
  private draw() {
    const ctx = this.ctx,
      W = this.W,
      H = this.H,
      floorY = H - 10;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#eee';
    ctx.fillRect(0, floorY, W, H - floorY);
    for (const p of this.particles) {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.arc(p.x - p.r * 0.4, p.y - p.r * 0.45, p.r * 0.28, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  private loop() {
    this.step();
    this.draw();
    this.raf = requestAnimationFrame(() => {
      this.loop();
    });
  }
}
