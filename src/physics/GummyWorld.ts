type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  m: number;
  color: string;
  isBirthday?: boolean;
  title?: string;
  date?: string;
};
export class GummyWorld {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private W: number;
  private H: number;
  private raf = 0;
  private particles: Particle[] = [];
  private birthdayIcon?: HTMLImageElement;
  private draggedParticle: Particle | null = null;
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private prevDragX = 0;
  private prevDragY = 0;
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
    // 誕生日アイコンを準備（白色のSVG）
    const whiteSvg = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke-width='1.5' stroke='white'><path stroke-linecap='round' stroke-linejoin='round' d='M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.871c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513M15 8.25v-1.5m-6 1.5v-1.5m12 9.75-1.5.75a3.354 3.354 0 0 1-3 0 3.354 3.354 0 0 0-3 0 3.354 3.354 0 0 1-3 0 3.354 3.354 0 0 0-3 0 3.354 3.354 0 0 1-3 0L3 16.5m15-3.379a48.474 48.474 0 0 0-6-.371c-2.032 0-4.034.126-6 .371m12 0c.39.049.777.102 1.163.16 1.07.16 1.837 1.094 1.837 2.175v5.169c0 .621-.504 1.125-1.125 1.125H4.125A1.125 1.125 0 0 1 3 20.625v-5.17c0-1.08.768-2.014 1.837-2.174A47.78 47.78 0 0 1 6 13.12M12.265 3.11a.375.375 0 1 1-.53 0L12 2.845l.265.265Zm-3 0a.375.375 0 1 1-.53 0L9 2.845l.265.265Zm6 0a.375.375 0 1 1-.53 0L15 2.845l.265.265Z'/></svg>`;
    const img = new Image();
    img.src = whiteSvg;
    this.birthdayIcon = img;
    // マウスイベントを設定
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.canvas.addEventListener('mouseleave', this.handleMouseUp.bind(this));
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
  addGummies(
    gummies: {
      color: string;
      weight: number;
      isBirthday?: boolean;
      title?: string;
      date?: string;
    }[]
  ) {
    const cx = this.W / 2,
      sigmaX = this.W * this.cfg.centerBias;

    // グミサイズの計算式: r = Math.max(6, 5 + weight * 3)
    // weightの範囲は0.9〜4なので、半径の理論上の最大値は 5 + 4 * 3 = 17
    const theoreticalMaxRadius = 5 + 4 * 3; // 17
    // 誕生日グミは常に理論上の最大値の1.5倍のサイズ
    const birthdayRadius = theoreticalMaxRadius * 1.5; // 25.5

    for (const g of gummies) {
      const x = Math.max(20, Math.min(this.W - 20, cx + this.randNormal(0, sigmaX)));
      // 誕生日の場合は固定サイズ、それ以外は通常の計算
      const baseRadius = Math.max(6, 5 + g.weight * 3);
      const radius = g.isBirthday ? birthdayRadius : baseRadius;
      this.particles.push({
        x,
        y: -Math.random() * 200 - 20,
        vx: (Math.random() - 0.5) * 0.25,
        vy: 0,
        r: radius,
        m: Math.max(1, g.weight),
        color: g.color,
        isBirthday: g.isBirthday,
        title: g.title,
        date: g.date,
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
  shake() {
    // 全てのグミにランダムな速度を加えて揺さぶる（大地震のような効果）
    for (const p of this.particles) {
      // 水平方向に大きな揺れ
      p.vx += (Math.random() - 0.5) * 30;
      // 垂直方向にも揺れを加える（上向きの力を強めに）
      p.vy += (Math.random() - 0.7) * 25;
    }
  }
  private getMousePos(e: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }
  private handleMouseDown(e: MouseEvent) {
    const pos = this.getMousePos(e);
    // クリック位置に最も近いグミを探す（後ろから描画されるので逆順に探索）
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      const dx = pos.x - p.x;
      const dy = pos.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= p.r) {
        this.draggedParticle = p;
        this.dragOffsetX = dx;
        this.dragOffsetY = dy;
        this.prevDragX = p.x;
        this.prevDragY = p.y;
        // ドラッグ中は速度をリセット
        p.vx = 0;
        p.vy = 0;
        this.canvas.style.cursor = 'grabbing';
        break;
      }
    }
  }
  private handleMouseMove(e: MouseEvent) {
    const pos = this.getMousePos(e);
    if (this.draggedParticle) {
      // グミをマウス位置に移動
      const newX = pos.x - this.dragOffsetX;
      const newY = pos.y - this.dragOffsetY;
      this.draggedParticle.x = newX;
      this.draggedParticle.y = newY;

      // ドラッグ速度を計算
      const dragVx = newX - this.prevDragX;
      const dragVy = newY - this.prevDragY;
      this.prevDragX = newX;
      this.prevDragY = newY;

      // 他のグミとの衣突をチェック
      for (const other of this.particles) {
        if (other === this.draggedParticle) continue;

        const dx = other.x - this.draggedParticle.x;
        const dy = other.y - this.draggedParticle.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = this.draggedParticle.r + other.r;

        if (dist < minDist && dist > 0) {
          // 衡突している場合、他のグミを弾き飛ばす
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = minDist - dist;

          // 他のグミを押し出す
          other.x += nx * overlap;
          other.y += ny * overlap;

          // ドラッグ速度に基づいて弾き飛ばす速度を付与
          const impactForce = 2.5; // 衡撃の強さ
          other.vx = nx * Math.abs(dragVx) * impactForce + dragVx * 0.8;
          other.vy = ny * Math.abs(dragVy) * impactForce + dragVy * 0.8;
        }
      }

      // 速度をリセットし続ける
      this.draggedParticle.vx = 0;
      this.draggedParticle.vy = 0;
    } else {
      // ホバー検知
      let hovering = false;
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        const dx = pos.x - p.x;
        const dy = pos.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= p.r) {
          hovering = true;
          break;
        }
      }
      this.canvas.style.cursor = hovering ? 'grab' : 'default';
    }
  }
  private handleMouseUp() {
    if (this.draggedParticle) {
      this.draggedParticle = null;
      this.canvas.style.cursor = 'default';
    }
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
      // ドラッグ中のグミは物理演算をスキップ
      if (p === this.draggedParticle) continue;

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
      // 誕生日アイコンのオーバーレイ
      if (p.isBirthday && this.birthdayIcon && this.birthdayIcon.complete) {
        const size = p.r * 1.4;
        ctx.save();
        ctx.globalAlpha = 0.95;
        ctx.drawImage(this.birthdayIcon, p.x - size * 0.5, p.y - size * 0.5, size, size);
        ctx.restore();
      }
    }

    // ドラッグ中のグミに吹き出しを表示
    if (this.draggedParticle && (this.draggedParticle.title || this.draggedParticle.date)) {
      this.drawTooltip(this.draggedParticle);
    }
  }

  private drawTooltip(p: Particle) {
    const ctx = this.ctx;
    const padding = 8;
    const lineHeight = 18;
    const maxWidth = 200;

    ctx.save();
    ctx.font = '14px sans-serif';

    // テキストを準備
    const lines: string[] = [];
    if (p.date) lines.push(p.date);
    if (p.title) {
      // タイトルが長い場合は折り返す
      const words = p.title.split(' ');
      let currentLine = '';
      for (const word of words) {
        const testLine = currentLine ? currentLine + ' ' + word : word;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth - padding * 2 && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);
    }

    // 吹き出しのサイズを計算
    let tooltipWidth = 0;
    for (const line of lines) {
      const metrics = ctx.measureText(line);
      if (metrics.width > tooltipWidth) tooltipWidth = metrics.width;
    }
    tooltipWidth = Math.min(maxWidth, tooltipWidth + padding * 2);
    const tooltipHeight = lines.length * lineHeight + padding * 2;

    // 吹き出しの位置（グミの上）
    let tooltipX = p.x - tooltipWidth / 2;
    let tooltipY = p.y - p.r - tooltipHeight - 15;

    // 画面外に出ないように調整
    if (tooltipX < 5) tooltipX = 5;
    if (tooltipX + tooltipWidth > this.W - 5) tooltipX = this.W - tooltipWidth - 5;
    if (tooltipY < 5) tooltipY = p.y + p.r + 15;

    // 吹き出しの背景（うっすら）
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;

    // 角丸四角形
    const radius = 6;
    ctx.beginPath();
    ctx.moveTo(tooltipX + radius, tooltipY);
    ctx.lineTo(tooltipX + tooltipWidth - radius, tooltipY);
    ctx.arcTo(
      tooltipX + tooltipWidth,
      tooltipY,
      tooltipX + tooltipWidth,
      tooltipY + radius,
      radius
    );
    ctx.lineTo(tooltipX + tooltipWidth, tooltipY + tooltipHeight - radius);
    ctx.arcTo(
      tooltipX + tooltipWidth,
      tooltipY + tooltipHeight,
      tooltipX + tooltipWidth - radius,
      tooltipY + tooltipHeight,
      radius
    );
    ctx.lineTo(tooltipX + radius, tooltipY + tooltipHeight);
    ctx.arcTo(
      tooltipX,
      tooltipY + tooltipHeight,
      tooltipX,
      tooltipY + tooltipHeight - radius,
      radius
    );
    ctx.lineTo(tooltipX, tooltipY + radius);
    ctx.arcTo(tooltipX, tooltipY, tooltipX + radius, tooltipY, radius);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // テキスト描画
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.textBaseline = 'top';
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], tooltipX + padding, tooltipY + padding + i * lineHeight);
    }

    ctx.restore();
  }

  private loop() {
    this.step();
    this.draw();
    this.raf = requestAnimationFrame(() => {
      this.loop();
    });
  }
}
