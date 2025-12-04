import { Engine, World, Bodies, Body, Constraint } from 'matter-js';

type GummyMetadata = {
  color: string;
  isBirthday?: boolean;
  title?: string;
  date?: string;
  shape: 'circle' | 'square' | 'pencil' | 'heart' | 'star';
};

export class GummyWorld {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private W: number;
  private H: number;
  private engine: Engine;
  private world: World;
  private bodies: Array<any> = [];
  private metadataMap: Map<string, GummyMetadata> = new Map();
  private raf = 0;
  private dragConstraint: Constraint | null = null;
  private cfg = {
    gravity: 0.0015, // Matter.js の標準単位に合わせたスケーリング
    air: 0.001, // frictionAir として使用
    restitution: 0.9, // 反発係数を調整（より跳ねやすく）
    friction: 0.005, // Body の friction
    frictionAir: 0.001, // Body の frictionAir
    centerBias: 0.12,
    inwardForce: 0.0,
    maxParticles: 1000,
  };

  constructor(canvas: HTMLCanvasElement, cfg?: Partial<typeof this.cfg>) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.W = canvas.width;
    this.H = canvas.height;
    Object.assign(this.cfg, cfg || {});

    // Matter.js エンジンを初期化
    this.engine = Engine.create();
    this.world = this.engine.world;
    // Matter.js の標準重力（1）を基準に、0.0015 に調整
    this.world.gravity.y = this.cfg.gravity * 1000; // 0.0015 * 1000 = 1.5
    this.world.gravity.x = 0;

    // イベントバインド
    this.loop = this.loop.bind(this);

    // マウスイベントをセット
    this.canvas.addEventListener('mousedown', this.handleMouseDown);
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('mouseup', this.handleMouseUp);
    this.canvas.addEventListener('mouseleave', this.handleMouseUp);

    // ワールド境界（壁・床）を作成
    this.setupWorldBoundaries();

    // ループ開始
    this.raf = requestAnimationFrame(() => {
      this.loop();
    });
  }

  private setupWorldBoundaries() {
    this.createBoundaryBodies();
  }

  private createBoundaryBodies() {
    const thickness = 100; // 壁の厚さを増やして貫通を防ぐ
    const margin = 10; // キャンバス端からの距離
    const wallHeight = this.H + thickness * 2 + 1000; // 壁の高さを上方向に1000px拡張

    // 左壁（キャンバスの左端より左、上に伸ばす）
    const leftWall = Bodies.rectangle(
      -thickness / 2 - margin,
      this.H / 2 - 500, // 中心を上にシフト
      thickness,
      wallHeight,
      {
        isStatic: true,
        label: 'wall_left',
        frictionStatic: 0.8,
        friction: 0.8,
      }
    );

    // 右壁（キャンバスの右端より右、上に伸ばす）
    const rightWall = Bodies.rectangle(
      this.W + thickness / 2 + margin,
      this.H / 2 - 500, // 中心を上にシフト
      thickness,
      wallHeight,
      {
        isStatic: true,
        label: 'wall_right',
        frictionStatic: 0.8,
        friction: 0.8,
      }
    );

    // 床（キャンバスの底部）
    const floor = Bodies.rectangle(
      this.W / 2,
      this.H + thickness / 2,
      this.W + thickness * 2,
      thickness,
      {
        isStatic: true,
        label: 'floor',
        friction: 0.8,
        restitution: this.cfg.restitution,
      }
    );

    // 天井（落ちてくるオブジェクト用）
    // グミの生成位置は y = -(Math.random() * 200 + 20) なので、-220 より上に配置
    const ceiling = Bodies.rectangle(
      this.W / 2,
      -300, // グミ生成範囲より十分上に配置
      this.W + thickness * 2,
      thickness,
      {
        isStatic: true,
        label: 'ceiling',
        friction: 0.8,
        restitution: this.cfg.restitution,
      }
    );

    World.add(this.world, [leftWall, rightWall, floor, ceiling]);
  }

  private recreateWorldBoundaries() {
    // 既存の壁・床・天井を削除
    const staticBodies = this.world.bodies.filter(
      (b: any) =>
        b.isStatic && (b.label?.startsWith('wall_') || b.label === 'floor' || b.label === 'ceiling')
    );
    for (const body of staticBodies) {
      World.remove(this.world, body);
    }
    // 新しい境界を作成
    this.createBoundaryBodies();
  }

  setSize(width: number, height: number) {
    if (width === this.W && height === this.H) return;
    this.W = width;
    this.H = height;
    // Canvas 要素自体のサイズを設定
    this.canvas.width = width;
    this.canvas.height = height;
    // CSS スタイルでも設定してスケーリングに対応
    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';
    // 既存の境界を削除して新規作成
    this.recreateWorldBoundaries();
  }

  private randNormal(mean = 0, std = 1) {
    const u = 1 - Math.random(),
      v = 1 - Math.random();
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return mean + z * std;
  }

  private createCircleBody(x: number, y: number, radius: number, bodyOptions: any): any {
    return Bodies.circle(x, y, radius, bodyOptions);
  }

  private createSquareBody(x: number, y: number, radius: number, bodyOptions: any): any {
    const s = radius * 1.6;
    return Bodies.rectangle(x, y, s, s, bodyOptions);
  }

  private createPencilBody(x: number, y: number, radius: number, bodyOptions: any): any {
    const len = radius * 3.2;
    const width = radius * 0.9;
    const tipLength = width * 0.9;

    const pencilVertices = [
      { x: -len / 2, y: -width / 2 },
      { x: len / 2, y: -width / 2 },
      { x: len / 2 + tipLength, y: 0 },
      { x: len / 2, y: width / 2 },
      { x: -len / 2, y: width / 2 },
    ];

    const body = Bodies.fromVertices(x, y, [pencilVertices], bodyOptions);
    Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.1);
    return body;
  }

  private createStarBody(x: number, y: number, radius: number, bodyOptions: any): any {
    const vertices = [];
    const spikes = 5;
    const outer = radius * 1.8;
    const inner = radius * 0.8;
    let rot = (Math.PI / 2) * 3;

    for (let i = 0; i < spikes; i++) {
      vertices.push({
        x: Math.cos(rot) * outer,
        y: Math.sin(rot) * outer,
      });
      rot += Math.PI / spikes;
      vertices.push({
        x: Math.cos(rot) * inner,
        y: Math.sin(rot) * inner,
      });
      rot += Math.PI / spikes;
    }

    return Bodies.fromVertices(x, y, [vertices], bodyOptions);
  }

  private createHeartBody(x: number, y: number, radius: number, bodyOptions: any): any {
    const s = radius * 1.6;
    const heartVertices = [
      { x: 0, y: s * 0.3 },
      { x: -s * 0.7, y: -s * 0.7 },
      { x: s * 0.7, y: -s * 0.7 },
    ];
    return Bodies.fromVertices(x, y, [heartVertices], bodyOptions);
  }

  addGummies(
    gummies: {
      color: string;
      weight: number;
      isBirthday?: boolean;
      title?: string;
      date?: string;
      shape?: 'circle' | 'square' | 'pencil' | 'heart' | 'star';
    }[]
  ) {
    const cx = this.W / 2;
    const sigmaX = this.W * this.cfg.centerBias;

    const theoreticalMaxRadius = 5 + 4 * 3; // 17
    const birthdayRadius = theoreticalMaxRadius * 1.5; // 25.5

    for (const g of gummies) {
      const x = Math.max(20, Math.min(this.W - 20, cx + this.randNormal(0, sigmaX)));
      const y = -(Math.random() * 200 + 20);

      const baseRadius = Math.max(6, 5 + g.weight * 3);
      const radius = g.isBirthday ? birthdayRadius : baseRadius;

      // 初期速度
      const vx = (Math.random() - 0.5) * 0.25;
      const vy = 0;

      // 剛体を作成
      const bodyOptions = {
        label: `gummy_${Date.now()}_${Math.random()}`,
        friction: this.cfg.friction,
        restitution: this.cfg.restitution,
        frictionAir: this.cfg.frictionAir,
      };

      let body: any;
      if (g.shape === 'circle') {
        body = this.createCircleBody(x, y, radius, bodyOptions);
      } else if (g.shape === 'square') {
        body = this.createSquareBody(x, y, radius, bodyOptions);
      } else if (g.shape === 'pencil') {
        body = this.createPencilBody(x, y, radius, bodyOptions);
      } else if (g.shape === 'star') {
        body = this.createStarBody(x, y, radius, bodyOptions);
      } else {
        body = this.createHeartBody(x, y, radius, bodyOptions);
      }

      // 初期速度を設定
      Body.setVelocity(body, { x: vx, y: vy });

      // ワールドに追加
      World.add(this.world, body);
      this.bodies.push(body);

      // メタデータを保存
      this.metadataMap.set(body.id.toString(), {
        color: g.color,
        isBirthday: g.isBirthday,
        title: g.title,
        date: g.date,
        shape: g.shape || 'circle',
      });
    }

    // 粒子数制限
    if (this.bodies.length > this.cfg.maxParticles) {
      const toRemove = this.bodies.slice(0, this.bodies.length - this.cfg.maxParticles);
      for (const body of toRemove) {
        World.remove(this.world, body);
      }
      this.bodies = this.bodies.slice(this.bodies.length - this.cfg.maxParticles);
    }

    if (!this.raf) {
      this.raf = requestAnimationFrame(() => {
        this.loop();
      });
    }
  }

  clear() {
    // すべての剛体をワールドから削除
    for (const body of this.bodies) {
      World.remove(this.world, body);
    }
    this.bodies.length = 0;
    this.metadataMap.clear();
  }

  shake() {
    // 全グミにランダムな速度を追加
    for (const body of this.bodies) {
      const randomVx = (Math.random() - 0.5) * 30;
      const randomVy = (Math.random() - 0.7) * 25;

      Body.setVelocity(body, {
        x: body.velocity.x + randomVx,
        y: body.velocity.y + randomVy,
      });
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

  private findBodyAt(x: number, y: number): any {
    // 逆順に探索（最新のものが上）
    for (let i = this.bodies.length - 1; i >= 0; i--) {
      const body: any = this.bodies[i];

      // Matter.js のデータを使用して正確に判定
      if (this.isPointInBody(body, { x, y })) {
        return body;
      }
    }
    return null;
  }

  private isPointInBody(body: any, point: { x: number; y: number }): boolean {
    // Matter.js の vertices を使用して正確に判定
    if (body.vertices && body.vertices.length > 0) {
      // 多角形の内部判定（Ray Casting Algorithm）
      const vertices = body.vertices;
      let inside = false;

      for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
        const xi = vertices[i].x;
        const yi = vertices[i].y;
        const xj = vertices[j].x;
        const yj = vertices[j].y;

        const intersect =
          yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;

        if (intersect) inside = !inside;
      }

      return inside;
    }

    // フォールバック: circleRadius を使用
    if (body.circleRadius !== undefined && body.circleRadius !== null) {
      const dx = point.x - body.position.x;
      const dy = point.y - body.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      return dist <= body.circleRadius;
    }

    return false;
  }

  private readonly handleMouseDown = (e: MouseEvent) => {
    const pos = this.getMousePos(e);
    const body = this.findBodyAt(pos.x, pos.y);

    if (body) {
      // Constraint でマウス位置に拘束
      this.dragConstraint = Constraint.create({
        bodyB: body,
        pointB: { x: pos.x - body.position.x, y: pos.y - body.position.y },
        pointA: { x: pos.x, y: pos.y },
        length: 0,
        stiffness: 1,
      });

      World.add(this.world, this.dragConstraint);
      this.canvas.style.cursor = 'grabbing';
    }
  };

  private readonly handleMouseMove = (e: MouseEvent) => {
    const pos = this.getMousePos(e);

    if (this.dragConstraint) {
      // Constraint の pointA をマウス位置に更新
      this.dragConstraint.pointA = { x: pos.x, y: pos.y };
    } else {
      // ホバー検知
      const body = this.findBodyAt(pos.x, pos.y);
      this.canvas.style.cursor = body ? 'grab' : 'default';
    }
  };

  private readonly handleMouseUp = () => {
    if (this.dragConstraint) {
      World.remove(this.world, this.dragConstraint);
      this.dragConstraint = null;
      this.canvas.style.cursor = 'default';
    }
  };

  private draw() {
    const ctx = this.ctx;
    const W = this.W;
    const H = this.H;

    ctx.clearRect(0, 0, W, H);

    // 各剛体を描画
    for (const body of this.bodies) {
      const metadata = this.metadataMap.get(body.id.toString());
      if (!metadata) continue;

      const x = body.position.x;
      const y = body.position.y;
      const angle = body.angle;

      // 形状に応じて描画
      this.drawGummy(ctx, metadata.shape, x, y, body.circleRadius || 10, metadata.color, angle);

      // 誕生日マーク
      if (metadata.isBirthday) {
        this.drawBirthdayMark(ctx, x, y, body.circleRadius || 10);
      }
    }
  }

  private drawGummy(
    ctx: CanvasRenderingContext2D,
    shape: string,
    x: number,
    y: number,
    r: number,
    color: string,
    angle: number
  ) {
    ctx.save();

    switch (shape) {
      case 'circle':
        this.drawCircle(ctx, x, y, r, color);
        break;
      case 'square':
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.translate(-x, -y);
        this.drawSquare(ctx, x, y, r, color);
        break;
      case 'pencil':
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.translate(-x, -y);
        this.drawPencil(ctx, x, y, r, color);
        break;
      case 'star':
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.translate(-x, -y);
        this.drawStar(ctx, x, y, r, color);
        break;
      case 'heart':
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.translate(-x, -y);
        this.drawHeart(ctx, x, y, r, color);
        break;
    }

    ctx.restore();
  }

  private drawCircle(
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

  private drawSquare(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    fill: string
  ) {
    // r は radius * 1.6 のサイズ（物理ボディのサイズ）
    // 見た目を大きくするため 1.96倍に (1.4 * 1.4)
    const visualSize = r * 1.96;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.rect(cx - visualSize / 2, cy - visualSize / 2, visualSize, visualSize);
    ctx.fill();
    // ハイライト
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.rect(cx - visualSize * 0.3, cy - visualSize * 0.35, visualSize * 0.3, visualSize * 0.25);
    ctx.fill();
  }

  private drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, fill: string) {
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

  private drawHeart(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    fill: string
  ) {
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

  private drawPencil(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    fill: string
  ) {
    const len = r * 3.2;
    const width = r * 0.9;

    // 本体
    ctx.fillStyle = fill;
    ctx.fillRect(cx - len / 2, cy - width / 2, len, width);

    // 先端
    ctx.fillStyle = this.shade(fill, -0.25);
    ctx.beginPath();
    ctx.moveTo(cx + len / 2, cy - width / 2);
    ctx.lineTo(cx + len / 2 + width * 0.9, cy);
    ctx.lineTo(cx + len / 2, cy + width / 2);
    ctx.closePath();
    ctx.fill();

    // 消しゴム
    ctx.fillStyle = this.shade(fill, 0.2);
    ctx.fillRect(cx - len / 2 - width * 0.7, cy - width / 2, width * 0.7, width);
  }

  private shade(hex: string, amount: number): string {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    const factor = amount >= 0 ? 1 + amount : 1 + amount;
    const rr = Math.round(Math.max(0, Math.min(255, r * factor)));
    const gg = Math.round(Math.max(0, Math.min(255, g * factor)));
    const bb = Math.round(Math.max(0, Math.min(255, b * factor)));
    return `#${[rr, gg, bb].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  }

  private drawBirthdayMark(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
    // 簡易的な誕生日マーク（円）
    ctx.fillStyle = 'rgba(255, 215, 0, 0.6)';
    ctx.beginPath();
    ctx.arc(x, y, r * 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  private loop() {
    // Matter.js エンジンを更新
    Engine.update(this.engine);

    // 中心バイアスを適用
    if (this.cfg.inwardForce > 0) {
      const cx = this.W / 2;
      for (const body of this.bodies) {
        const forceX = (cx - body.position.x) * this.cfg.inwardForce;
        Body.applyForce(body, body.position, { x: forceX, y: 0 });
      }
    }

    // 描画
    this.draw();

    // 次フレーム
    this.raf = requestAnimationFrame(() => {
      this.loop();
    });
  }
}
