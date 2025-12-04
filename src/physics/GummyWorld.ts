import { Engine, World, Bodies, Body, Constraint } from 'matter-js';

type GummyMetadata = {
  color: string;
  isBirthday?: boolean;
  title?: string;
  date?: string;
  shape:
    | 'circle'
    | 'square'
    | 'pencil'
    | 'heart'
    | 'bag'
    | 'calendar'
    | 'folder'
    | 'book'
    | 'briefcase'
    | 'plane'
    | 'car'
    | 'game'
    | 'bed'
    | 'hospital';
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
  private draggedBodyId: string | null = null;
  private birthdayIcon: HTMLImageElement | null = null;
  private scrollTexts: Array<{
    text: string;
    x: number;
    date: string;
    lane: number;
    isMonthHeader?: boolean;
  }> = [];
  private scrollSpeed = 2;
  private readonly maxLanes = 5; // 最大5行まで表示
  private readonly lineHeight = 30; // 行の高さ
  private lastUsedLane = -1; // 最後に使用したレーン
  private speedMultiplier = 1; // コメント倍速（1, 2, 3, 5, 10）
  private readonly speedOptions = [1, 2, 3, 5, 10]; // 倍速オプション
  private buttonRect = { x: 0, y: 0, width: 120, height: 40 }; // ボタンの領域
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

    // タッチイベントをセット（passive: false で preventDefault を有効化）
    this.canvas.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    this.canvas.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    this.canvas.addEventListener('touchend', this.handleTouchEnd, { passive: false });
    this.canvas.addEventListener('touchcancel', this.handleTouchEnd, { passive: false });

    // 誕生日アイコンを読み込み
    this.birthdayIcon = new Image();
    this.birthdayIcon.src = '/icon-birthday.svg';

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

  private createBagBody(x: number, y: number, radius: number, bodyOptions: any): any {
    // カバンの形状（長方形 + ハンドル）
    const width = radius * 2.2;
    const height = radius * 1.6;

    const bagVertices = [
      // 左下
      { x: -width / 2, y: height / 2 },
      // 左上
      { x: -width / 2, y: -height / 2 },
      // ハンドル左
      { x: -width * 0.3, y: -height / 2 },
      { x: -width * 0.25, y: -height * 0.8 },
      { x: width * 0.25, y: -height * 0.8 },
      // ハンドル右
      { x: width * 0.3, y: -height / 2 },
      // 右上
      { x: width / 2, y: -height / 2 },
      // 右下
      { x: width / 2, y: height / 2 },
    ];

    return Bodies.fromVertices(x, y, [bagVertices], bodyOptions);
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

  private createCalendarBody(x: number, y: number, radius: number, bodyOptions: any): any {
    const s = radius * 1.8;
    return Bodies.rectangle(x, y, s, s, bodyOptions);
  }

  private createFolderBody(x: number, y: number, radius: number, bodyOptions: any): any {
    const w = radius * 2.4;
    const h = radius * 1.8;
    return Bodies.rectangle(x, y, w, h, bodyOptions);
  }

  private createBookBody(x: number, y: number, radius: number, bodyOptions: any): any {
    const w = radius * 2.0;
    const h = radius * 2.6;
    return Bodies.rectangle(x, y, w, h, bodyOptions);
  }

  private createBriefcaseBody(x: number, y: number, radius: number, bodyOptions: any): any {
    const w = radius * 2.8;
    const h = radius * 2.0;
    return Bodies.rectangle(x, y, w, h, bodyOptions);
  }

  private createPlaneBody(x: number, y: number, radius: number, bodyOptions: any): any {
    const s = radius * 2.5;
    const planeVertices = [
      { x: -s * 0.5, y: 0 },
      { x: -s * 0.2, y: -s * 0.15 },
      { x: s * 0.5, y: -s * 0.2 },
      { x: s * 0.5, y: s * 0.2 },
      { x: -s * 0.2, y: s * 0.15 },
    ];
    return Bodies.fromVertices(x, y, [planeVertices], bodyOptions);
  }

  private createCarBody(x: number, y: number, radius: number, bodyOptions: any): any {
    const w = radius * 3.0;
    const h = radius * 1.8;
    return Bodies.rectangle(x, y, w, h, bodyOptions);
  }

  private createGameBody(x: number, y: number, radius: number, bodyOptions: any): any {
    const w = radius * 2.4;
    const h = radius * 1.6;
    return Bodies.rectangle(x, y, w, h, bodyOptions);
  }

  private createBedBody(x: number, y: number, radius: number, bodyOptions: any): any {
    const w = radius * 3.2;
    const h = radius * 2.0;
    return Bodies.rectangle(x, y, w, h, bodyOptions);
  }

  private createHospitalBody(x: number, y: number, radius: number, bodyOptions: any): any {
    const s = radius * 1.8;
    const crossVertices = [
      { x: -s * 0.3, y: -s * 0.9 },
      { x: s * 0.3, y: -s * 0.9 },
      { x: s * 0.3, y: -s * 0.3 },
      { x: s * 0.9, y: -s * 0.3 },
      { x: s * 0.9, y: s * 0.3 },
      { x: s * 0.3, y: s * 0.3 },
      { x: s * 0.3, y: s * 0.9 },
      { x: -s * 0.3, y: s * 0.9 },
      { x: -s * 0.3, y: s * 0.3 },
      { x: -s * 0.9, y: s * 0.3 },
      { x: -s * 0.9, y: -s * 0.3 },
      { x: -s * 0.3, y: -s * 0.3 },
    ];
    return Bodies.fromVertices(x, y, [crossVertices], bodyOptions);
  }

  addScrollText(text: string, date: string, isMonthHeader: boolean = false) {
    // 利用可能なレーンを見つける（被らないように）
    const lane = isMonthHeader ? Math.floor(this.maxLanes / 2) : this.findAvailableLane();
    console.log(`addScrollText called: ${date} ${text}, lane: ${lane}, isMonth: ${isMonthHeader}`);
    this.scrollTexts.push({
      text,
      date,
      x: this.W,
      lane,
      isMonthHeader,
    });
    if (!isMonthHeader) {
      this.lastUsedLane = lane;
    }
  }

  private findAvailableLane(): number {
    // 前回使ったレーン以外からランダムに選ぶ
    const availableLanes: number[] = [];
    for (let i = 0; i < this.maxLanes; i++) {
      if (i !== this.lastUsedLane) {
        availableLanes.push(i);
      }
    }
    // ランダムに選択
    const randomIndex = Math.floor(Math.random() * availableLanes.length);
    return availableLanes[randomIndex];
  }

  private drawScrollTexts(ctx: CanvasRenderingContext2D) {
    if (this.scrollTexts.length > 0) {
      console.log(`Drawing ${this.scrollTexts.length} scroll texts`);
    }
    ctx.save();

    for (const st of this.scrollTexts) {
      if (st.isMonthHeader) {
        // 月表示は中央（canvas高さの1/2）に大きなフォントで表示
        const centerY = this.H / 2 - 30; // 中央位置
        ctx.font = 'bold 60px sans-serif';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
        ctx.lineWidth = 4;
        ctx.textBaseline = 'middle';

        // 縁取り（白、太め）
        ctx.strokeText(st.text, st.x, centerY);
        // 本体（黒）
        ctx.fillText(st.text, st.x, centerY);
      } else {
        // 通常のイベント表示（上部の複数行）
        const y = 10 + st.lane * this.lineHeight;
        ctx.font = 'bold 18px sans-serif';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 3;
        ctx.textBaseline = 'top';

        const displayText = `${st.date} ${st.text}`;

        // 縁取り（白）
        ctx.strokeText(displayText, st.x, y);
        // 本体（黒）
        ctx.fillText(displayText, st.x, y);
      }
    }

    ctx.restore();
  }

  addGummies(
    gummies: {
      color: string;
      weight: number;
      isBirthday?: boolean;
      title?: string;
      date?: string;
      shape?:
        | 'circle'
        | 'square'
        | 'pencil'
        | 'heart'
        | 'bag'
        | 'calendar'
        | 'folder'
        | 'book'
        | 'briefcase'
        | 'plane'
        | 'car'
        | 'game'
        | 'bed'
        | 'hospital';
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
      } else if (g.shape === 'bag') {
        body = this.createBagBody(x, y, radius, bodyOptions);
      } else if (g.shape === 'heart') {
        body = this.createHeartBody(x, y, radius, bodyOptions);
      } else if (g.shape === 'calendar') {
        body = this.createCalendarBody(x, y, radius, bodyOptions);
      } else if (g.shape === 'folder') {
        body = this.createFolderBody(x, y, radius, bodyOptions);
      } else if (g.shape === 'book') {
        body = this.createBookBody(x, y, radius, bodyOptions);
      } else if (g.shape === 'briefcase') {
        body = this.createBriefcaseBody(x, y, radius, bodyOptions);
      } else if (g.shape === 'plane') {
        body = this.createPlaneBody(x, y, radius, bodyOptions);
      } else if (g.shape === 'car') {
        body = this.createCarBody(x, y, radius, bodyOptions);
      } else if (g.shape === 'game') {
        body = this.createGameBody(x, y, radius, bodyOptions);
      } else if (g.shape === 'bed') {
        body = this.createBedBody(x, y, radius, bodyOptions);
      } else if (g.shape === 'hospital') {
        body = this.createHospitalBody(x, y, radius, bodyOptions);
      } else {
        body = this.createCircleBody(x, y, radius, bodyOptions);
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

  getSpeedMultiplier(): number {
    return this.speedMultiplier;
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

    // ボタンクリックチェック
    if (this.isPointInButton(pos.x, pos.y)) {
      // 次の倍速に切り替え（1→2→3→5→10→1）
      const currentIndex = this.speedOptions.indexOf(this.speedMultiplier);
      const nextIndex = (currentIndex + 1) % this.speedOptions.length;
      this.speedMultiplier = this.speedOptions[nextIndex];
      console.log(`Speed: ${this.speedMultiplier}x`);
      return;
    }

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
      this.draggedBodyId = body.id.toString();
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
      this.draggedBodyId = null;
      this.canvas.style.cursor = 'default';
    }
  };

  private readonly handleTouchStart = (e: TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 0) return;
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousedown', {
      clientX: touch.clientX,
      clientY: touch.clientY,
    });
    this.handleMouseDown(mouseEvent as any);
  };

  private readonly handleTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 0) return;
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousemove', {
      clientX: touch.clientX,
      clientY: touch.clientY,
    });
    this.handleMouseMove(mouseEvent as any);
  };

  private readonly handleTouchEnd = (e: TouchEvent) => {
    e.preventDefault();
    this.handleMouseUp();
  };

  private isPointInButton(x: number, y: number): boolean {
    // ボタン位置を更新（右上）
    this.buttonRect.x = this.W - this.buttonRect.width - 10;
    this.buttonRect.y = 10;

    return (
      x >= this.buttonRect.x &&
      x <= this.buttonRect.x + this.buttonRect.width &&
      y >= this.buttonRect.y &&
      y <= this.buttonRect.y + this.buttonRect.height
    );
  }

  private drawSpeedButton(ctx: CanvasRenderingContext2D) {
    // ボタン位置を更新（右上）
    this.buttonRect.x = this.W - this.buttonRect.width - 10;
    this.buttonRect.y = 10;

    const { x, y, width, height } = this.buttonRect;

    // ボタン背景（倍速が大きいほど赤く）
    const intensity = Math.min(255, 100 + (this.speedMultiplier - 1) * 30);
    ctx.fillStyle =
      this.speedMultiplier > 1 ? `rgba(${intensity}, 100, 100, 0.9)` : 'rgba(100, 100, 100, 0.8)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 2;

    // 角丸矩形
    const radius = 8;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // ボタンテキスト
    ctx.fillStyle = 'white';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${this.speedMultiplier}x`, x + width / 2, y + height / 2);
  }

  private draw() {
    const ctx = this.ctx;
    const W = this.W;
    const H = this.H;

    ctx.clearRect(0, 0, W, H);

    // スクロールテキストを描画（一番上）
    this.drawScrollTexts(ctx);

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

      // ドラッグ中のボディに吹き出しを表示
      if (this.draggedBodyId === body.id.toString()) {
        this.drawTooltip(ctx, x, y, metadata);
      }
    }

    // 倍速ボタンを描画（最前面）
    this.drawSpeedButton(ctx);
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
      case 'bag':
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.translate(-x, -y);
        this.drawBag(ctx, x, y, r, color);
        break;
      case 'heart':
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.translate(-x, -y);
        this.drawHeart(ctx, x, y, r, color);
        break;
      case 'calendar':
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.translate(-x, -y);
        this.drawCalendar(ctx, x, y, r, color);
        break;
      case 'folder':
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.translate(-x, -y);
        this.drawFolder(ctx, x, y, r, color);
        break;
      case 'book':
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.translate(-x, -y);
        this.drawBook(ctx, x, y, r, color);
        break;
      case 'briefcase':
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.translate(-x, -y);
        this.drawBriefcase(ctx, x, y, r, color);
        break;
      case 'plane':
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.translate(-x, -y);
        this.drawPlane(ctx, x, y, r, color);
        break;
      case 'car':
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.translate(-x, -y);
        this.drawCar(ctx, x, y, r, color);
        break;
      case 'game':
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.translate(-x, -y);
        this.drawGame(ctx, x, y, r, color);
        break;
      case 'bed':
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.translate(-x, -y);
        this.drawBed(ctx, x, y, r, color);
        break;
      case 'hospital':
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.translate(-x, -y);
        this.drawHospital(ctx, x, y, r, color);
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
    // 見た目を大きくするため 2.5872倍に (2.156 * 1.2)
    const visualSize = r * 2.5872;
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

  private drawBag(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, fill: string) {
    const width = r * 2.2;
    const height = r * 1.6;

    ctx.fillStyle = fill;

    // カバン本体（長方形）
    ctx.fillRect(cx - width / 2, cy - height / 2, width, height);

    // ハンドル
    ctx.strokeStyle = fill;
    ctx.lineWidth = r * 0.3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy - height / 2, width * 0.3, Math.PI, 0, false);
    ctx.stroke();

    // ハイライト
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(cx - width * 0.3, cy - height * 0.2, width * 0.4, height * 0.3);
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

  private drawCalendar(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    fill: string
  ) {
    const s = r * 1.8;
    ctx.fillStyle = fill;
    ctx.fillRect(cx - s / 2, cy - s / 2, s, s);

    // グリッド線
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    for (let i = 1; i < 3; i++) {
      const offset = (s / 3) * i - s / 2;
      ctx.beginPath();
      ctx.moveTo(cx + offset, cy - s / 2);
      ctx.lineTo(cx + offset, cy + s / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - s / 2, cy + offset);
      ctx.lineTo(cx + s / 2, cy + offset);
      ctx.stroke();
    }
  }

  private drawFolder(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    fill: string
  ) {
    const w = r * 2.4;
    const h = r * 1.8;
    ctx.fillStyle = fill;
    ctx.fillRect(cx - w / 2, cy - h / 2, w, h);

    // タブ
    ctx.fillRect(cx - w / 2, cy - h / 2 - h * 0.2, w * 0.4, h * 0.2);

    // ハイライト
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(cx - w * 0.3, cy - h * 0.2, w * 0.5, h * 0.3);
  }

  private drawBook(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, fill: string) {
    const w = r * 2.0;
    const h = r * 2.6;
    ctx.fillStyle = fill;
    ctx.fillRect(cx - w / 2, cy - h / 2, w, h);

    // ページの線
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const y = cy - h * 0.3 + ((h * 0.6) / 4) * i;
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.3, y);
      ctx.lineTo(cx + w * 0.3, y);
      ctx.stroke();
    }
  }

  private drawBriefcase(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    fill: string
  ) {
    const w = r * 2.8;
    const h = r * 2.0;
    ctx.fillStyle = fill;
    ctx.fillRect(cx - w / 2, cy - h / 2, w, h);

    // ハンドル
    ctx.strokeStyle = fill;
    ctx.lineWidth = r * 0.25;
    ctx.beginPath();
    ctx.arc(cx, cy - h / 2, w * 0.15, Math.PI, 0, false);
    ctx.stroke();

    // ロック
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillRect(cx - w * 0.1, cy, w * 0.2, h * 0.15);
  }

  private drawPlane(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    fill: string
  ) {
    const s = r * 2.5;
    ctx.fillStyle = fill;

    // 胴体
    ctx.fillRect(cx - s * 0.5, cy - s * 0.1, s, s * 0.2);

    // 主翼
    ctx.fillRect(cx - s * 0.3, cy - s * 0.4, s * 0.6, s * 0.15);

    // 尾翼
    ctx.fillRect(cx - s * 0.5, cy - s * 0.05, s * 0.2, s * 0.3);

    // ハイライト
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillRect(cx - s * 0.3, cy - s * 0.05, s * 0.4, s * 0.1);
  }

  private drawCar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, fill: string) {
    const w = r * 3.0;
    const h = r * 1.8;

    // 車体
    ctx.fillStyle = fill;
    ctx.fillRect(cx - w / 2, cy - h / 4, w, h / 2);

    // 車窓
    ctx.fillRect(cx - w * 0.3, cy - h * 0.6, w * 0.25, h * 0.35);
    ctx.fillRect(cx + w * 0.05, cy - h * 0.6, w * 0.25, h * 0.35);

    // タイヤ
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.arc(cx - w * 0.25, cy + h / 4, r * 0.4, 0, Math.PI * 2);
    ctx.arc(cx + w * 0.25, cy + h / 4, r * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawGame(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, fill: string) {
    const w = r * 2.4;
    const h = r * 1.6;

    // コントローラー本体
    ctx.fillStyle = fill;
    ctx.fillRect(cx - w / 2, cy - h / 2, w, h);

    // 十字キー
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(cx - w * 0.35, cy - h * 0.1, w * 0.2, h * 0.05);
    ctx.fillRect(cx - w * 0.3, cy - h * 0.15, w * 0.1, h * 0.15);

    // ボタン
    ctx.beginPath();
    ctx.arc(cx + w * 0.2, cy - h * 0.1, r * 0.15, 0, Math.PI * 2);
    ctx.arc(cx + w * 0.3, cy, r * 0.15, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawBed(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, fill: string) {
    const w = r * 3.2;
    const h = r * 2.0;

    // ベッド本体
    ctx.fillStyle = fill;
    ctx.fillRect(cx - w / 2, cy - h / 4, w, h / 2);

    // 枕
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(cx - w * 0.4, cy - h * 0.45, w * 0.3, h * 0.2);

    // 毛布
    ctx.fillStyle = fill;
    ctx.globalAlpha = 0.7;
    ctx.fillRect(cx - w * 0.3, cy - h * 0.1, w * 0.7, h * 0.4);
    ctx.globalAlpha = 1.0;
  }

  private drawHospital(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    fill: string
  ) {
    const s = r * 1.8;

    // 十字マーク
    ctx.fillStyle = fill;

    // 縦棒
    ctx.fillRect(cx - s * 0.3, cy - s * 0.9, s * 0.6, s * 1.8);

    // 横棒
    ctx.fillRect(cx - s * 0.9, cy - s * 0.3, s * 1.8, s * 0.6);

    // ハイライト
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillRect(cx - s * 0.15, cy - s * 0.6, s * 0.3, s * 0.5);
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
    if (!this.birthdayIcon || !this.birthdayIcon.complete) return;

    const size = r * 1.2;
    ctx.save();

    // 白いフィルターを適用するため、一時的なキャンバスを使用
    ctx.filter = 'brightness(0) invert(1)';
    ctx.drawImage(this.birthdayIcon, x - size / 2, y - size / 2, size, size);

    ctx.restore();
  }

  private drawTooltip(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    metadata: GummyMetadata
  ) {
    if (!metadata.title && !metadata.date) return;

    ctx.save();

    const padding = 8;
    const lineHeight = 18;
    const fontSize = 14;
    ctx.font = `${fontSize}px sans-serif`;

    // テキストの幅を測定
    const dateText = metadata.date || '';
    const titleText = metadata.title || '';
    const dateWidth = ctx.measureText(dateText).width;
    const titleWidth = ctx.measureText(titleText).width;
    const maxWidth = Math.max(dateWidth, titleWidth);

    const tooltipWidth = maxWidth + padding * 2;
    const tooltipHeight = (dateText && titleText ? lineHeight * 2 : lineHeight) + padding * 2;

    // 吹き出しの位置（オブジェクトの上）
    const tooltipX = x - tooltipWidth / 2;
    const tooltipY = y - 60 - tooltipHeight;

    // 背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;

    // 角丸の矩形
    const radius = 4;
    ctx.beginPath();
    ctx.moveTo(tooltipX + radius, tooltipY);
    ctx.lineTo(tooltipX + tooltipWidth - radius, tooltipY);
    ctx.quadraticCurveTo(
      tooltipX + tooltipWidth,
      tooltipY,
      tooltipX + tooltipWidth,
      tooltipY + radius
    );
    ctx.lineTo(tooltipX + tooltipWidth, tooltipY + tooltipHeight - radius);
    ctx.quadraticCurveTo(
      tooltipX + tooltipWidth,
      tooltipY + tooltipHeight,
      tooltipX + tooltipWidth - radius,
      tooltipY + tooltipHeight
    );
    ctx.lineTo(tooltipX + radius, tooltipY + tooltipHeight);
    ctx.quadraticCurveTo(
      tooltipX,
      tooltipY + tooltipHeight,
      tooltipX,
      tooltipY + tooltipHeight - radius
    );
    ctx.lineTo(tooltipX, tooltipY + radius);
    ctx.quadraticCurveTo(tooltipX, tooltipY, tooltipX + radius, tooltipY);
    ctx.closePath();

    ctx.fill();
    ctx.stroke();

    // 吹き出しの尖った部分（三角形）
    ctx.beginPath();
    ctx.moveTo(x, y - 60);
    ctx.lineTo(x - 6, tooltipY + tooltipHeight);
    ctx.lineTo(x + 6, tooltipY + tooltipHeight);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // テキスト
    ctx.fillStyle = 'white';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    let textY = tooltipY + padding;
    if (dateText) {
      ctx.fillText(dateText, tooltipX + padding, textY);
      textY += lineHeight;
    }
    if (titleText) {
      ctx.fillText(titleText, tooltipX + padding, textY);
    }

    ctx.restore();
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

    // ドラッグ中のグミが画面外に行ったら手放す
    if (this.dragConstraint && this.draggedBodyId) {
      const draggedBody = this.bodies.find((b) => b.id.toString() === this.draggedBodyId);
      if (draggedBody) {
        const padding = 50; // 画面外と判定する余白
        if (
          draggedBody.position.x < -padding ||
          draggedBody.position.x > this.W + padding ||
          draggedBody.position.y < -padding ||
          draggedBody.position.y > this.H + padding
        ) {
          // 画面外に行ったので拘束を解除
          World.remove(this.world, this.dragConstraint);
          this.dragConstraint = null;
          this.draggedBodyId = null;
          this.canvas.style.cursor = 'default';
        }
      }
    }

    // スクロールテキストの更新
    const currentSpeed = this.scrollSpeed * this.speedMultiplier;
    this.scrollTexts = this.scrollTexts.filter((st) => {
      st.x -= currentSpeed;
      return st.x > -500; // テキストが完全に画面外に出たら削除
    });

    // 描画
    this.draw();

    // 次フレーム
    this.raf = requestAnimationFrame(() => {
      this.loop();
    });
  }
}
