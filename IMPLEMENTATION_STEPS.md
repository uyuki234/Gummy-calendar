# Matter.js 移行実装計画書

## 全体アーキテクチャ

```
現在の GummyWorld クラス構造
├── Canvas 管理
├── Particle[] 管理（カスタム物理演算）
├── 衝突検出・解決（カスタム実装）
├── ドラッグインタラクション
└── 描画ロジック

↓ 移行後

新しい GummyWorld クラス構造
├── Canvas 管理
├── Matter.Engine（物理シミュレーション）
├── Matter.Body[]（グミの剛体）
├── Matter.Events（衝突コールバック）
├── ドラッグインタラクション（改良）
└── 描画ロジック（改良）
```

---

## 実装フェーズ別ステップ

### Phase 1: 基礎セットアップ (1-3)

#### Step 1: Matter.js の依存関係追加

**目的**: Matter.js を npm パッケージとして導入

**作業内容**:

- `npm install matter-js` (または `matter-js@^2.0.20`)
- TypeScript 型定義: `npm install --save-dev @types/matter-js`
- vite.config.ts で必要に応じて設定調整

**確認項目**:

- `import { Engine, World, Bodies, Body, Events } from 'matter-js'` が可能

---

#### Step 2: GummyWorld クラスの構造改造（基本形）

**目的**: Matter.js エンジンの初期化と基本的な統合

**変更内容**:

```typescript
// 現在: private particles: Particle[] = []
// 変更後:
private engine: Engine;
private world: World;
private bodies: Body[] = [];  // Matter.Body の参照保持
private particleMap: Map<number, ParticleMetadata> = new Map();
// ParticleMetadata: { color, isBirthday, title, date, shape }
```

**実装内容**:

1. `constructor()` で Matter.Engine.create() を呼び出し
2. Engine の重力を設定: `engine.gravity.y = 0.0045` (要調整)
3. `setSize()` でワールド境界を設定
4. `loop()` で `Engine.update()` を毎フレーム実行

**確認項目**:

- エンジンが正常に初期化される
- エンジンのアップデートが実行される
- Canvas がクリアできる

---

#### Step 3: グミの剛体化（addGummies の改造）

**目的**: Particle → Matter.Body への変換

**変更内容**:

```typescript
// 現在: this.particles.push({ x, y, vx, vy, r, m, color, ... })
// 変更後: Matter.Bodies.circle() で剛体を作成

addGummies(gummies: GummyDefinition[]) {
  for (const g of gummies) {
    // 1. 剛体の作成
    const body = Bodies.circle(x, y, r, {
      friction: 0.01,           // 摩擦
      restitution: 0.8,         // 反発係数
      label: `gummy_${id}`,     // 識別用ラベル
    });

    // 2. ワールドに追加
    World.add(this.world, body);

    // 3. メタデータを保存
    this.particleMap.set(body.id, {
      color, isBirthday, title, date, shape, ...
    });

    // 4. 初期速度を設定
    Body.setVelocity(body, { x: vx, y: vy });
  }
}
```

**カスタマイズ項目**:

- `Bodies.circle()` で基本剛体作成
- `Bodies.rectangle()` (square 用)
- `Bodies.polygon()` (star 用)
- **重要**: 非 circle 形状は衝突判定が複雑化 → 当面 circle のみ、後で対応

**確認項目**:

- 剛体がワールドに追加される
- 重力で落下する
- 初期速度が反映される

---

### Phase 2: 境界条件・物理演算 (4-6)

#### Step 4: ワールド境界の実装（壁・床）

**目的**: キャンバス端での反射・衝突

**実装オプション A: 静止剛体境界**

```typescript
// 左壁
const leftWall = Bodies.rectangle(0, H / 2, 10, H, {
  isStatic: true,
  label: 'wall_left',
});

// 右壁
const rightWall = Bodies.rectangle(W, H / 2, 10, H, {
  isStatic: true,
  label: 'wall_right',
});

// 床
const floor = Bodies.rectangle(W / 2, H - 5, W, 10, {
  isStatic: true,
  label: 'floor',
  friction: 0.8,
  restitution: 0.8,
});

World.add(this.world, [leftWall, rightWall, floor]);
```

**実装オプション B: カスタム反射（パフォーマンス重視）**

- 境界衝突を自前で検出
- 速度を反転・減衰
- 位置を修正

→ **推奨**: オプション A（Matter.js に任せる）

**確認項目**:

- グミが床で跳ね返る
- グミが壁で反射する
- 反発係数が正しく適用される

---

#### Step 5: 衝突イベント・反発の自動化

**目的**: Matter.Events で衝突を監視し、自動的に反発を計算

**実装内容**:

```typescript
// collisionStart イベント: グミ同士の衝突を検出
Events.on(this.engine, 'collisionStart', (event) => {
  for (const pair of event.pairs) {
    const { bodyA, bodyB } = pair;

    // グミ同士の衝突か判定
    if (isGummy(bodyA) && isGummy(bodyB)) {
      // Matter.js が自動的に反発力を計算
      // (friction, restitution で制御)
    }
  }
});

// collisionEnd イベント（将来の UI 用）
Events.on(this.engine, 'collisionEnd', (event) => {
  // 接地状態の判定など
});
```

**カスタマイズ項目**:

- `friction`: 接線摩擦（Matter では `frictionAir`, `friction`）
- `restitution`: 反発係数（グミ同士 0.8、壁 0.8）
- **重要**: Matter.js の衝突応答は完全に自動化

**確認項目**:

- グミ同士が衝突して反発する
- 衝突の物理が見た目で確認できる
- 接線摩擦が適用される

---

#### Step 6: 中心バイアス・重力調整

**目的**: パラメータの Matter.js 移行

**実装内容**:

```typescript
// 重力の設定
this.engine.gravity.y = this.cfg.gravity / 10; // スケーリング要調整

// 中心バイアス（inwardForce）
// 方式 A: 定期的に全体に力を加える
if (this.cfg.inwardForce > 0) {
  for (const body of this.bodies) {
    const forceX = (cx - body.position.x) * this.cfg.inwardForce;
    Body.applyForce(body, body.position, { x: forceX, y: 0 });
  }
}

// 方式 B: 空気抵抗 + 重力のみで実装
// (Matter.js の frictionAir で減衰を制御)
```

**パラメータマッピング**:
| 現在の名称 | 現在の値 | Matter.js パラメータ | 備考 |
|-----------|--------|-----------------|------|
| gravity | 0.45 | engine.gravity.y | スケーリング要調整 |
| air | 0.995 | frictionAir | 計算式: 1 - (1 - 0.995) ≈ 0.005 |
| restitution | 0.8 | restitution | 直接使用 |
| frictionTangent | 0.01 | friction | 直接使用 |

**確認項目**:

- グミが適切な速度で落下する
- 空気抵抗が視覚的に確認できる
- 中心バイアスが正しく作用する

---

### Phase 3: 回転物理・形状対応 (7-9)

#### Step 7: 鉛筆の回転物理（回転トルク）

**目的**: Matter.js の角速度・トルク を活用

**実装内容**:

```typescript
// 鉛筆を長方形剛体で表現
if (shape === 'pencil') {
  const body = Bodies.rectangle(x, y, width, length, {
    label: 'gummy_pencil',
    restitution: 0.8,
    friction: 0.01,
    frictionAir: 0.005,
  });

  // 初期角速度を設定
  Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.1);

  // トルク（回転復元力）を毎フレーム加える
  Events.on(this.engine, 'beforeUpdate', () => {
    const angle = body.angle;
    // sin(angle) でトルクを計算（垂直方向に復元）
    const torque = Math.sin(angle) * 0.02;
    Body.rotate(body, torque);
  });
}
```

**Matter.js の回転オプション**:

- `angle`: 現在の回転角度（ラジアン）
- `angularVelocity`: 角速度
- `angularSpeed`: 角速度の大きさ
- `rotationConstraint`: 回転制限（オプション）

**重要なポイント**:

- Matter.js は自動的に角速度を統合する
- トルク計算は `Body.rotate()` または `Body.applyForce()` で実装
- 床衝突時の角速度増幅は `collisionStart` イベントで対応

**確認項目**:

- 鉛筆がランダムに回転する
- 垂直方向に復元する
- 床で跳ね返る際に角速度が変化する

---

#### Step 8: 多形状対応（Circle → 長方形・ポリゴン）

**目的**: circle 以外の形状を剛体として表現

**形状マッピング**:
| 形状 | Matter.Bodies 関数 | 説明 |
|-----|-----------------|------|
| circle | `Bodies.circle()` | 円形（既に実装） |
| square | `Bodies.rectangle()` | 正方形 (s = r \* 1.6) |
| pencil | `Bodies.rectangle()` | 長方形 (width=0.9r, length=3.2r) |
| heart | `Bodies.polygon()` | ハート形（17 頂点の近似） |
| star | `Bodies.polygon()` | 5 角スター（10 頂点） |

**実装方針**:

```typescript
function createGummyBody(x, y, r, shape, options) {
  switch (shape) {
    case 'circle':
      return Bodies.circle(x, y, r, options);
    case 'square':
      const s = r * 1.6;
      return Bodies.rectangle(x, y, s, s, options);
    case 'pencil':
      return Bodies.rectangle(x, y, r * 0.9, r * 3.2, options);
    case 'star':
      return Bodies.polygon(x, y, 5, r * 1.8, options);
    case 'heart':
      // ハート形は複雑→ Circle で近似 or カスタム描画
      return Bodies.circle(x, y, r, options);
  }
}
```

**注意事項**:

- `Bodies.polygon()` は凸ポリゴンのみ対応
- ハート形は複雑なため、円で近似するか、複合剛体を使用
- 衝突判定精度とパフォーマンスのトレードオフ

**確認項目**:

- 各形状が正しく描画される
- 形状別に異なる物理挙動が確認できる
- 衝突判定が正確に動作する

---

#### Step 9: 描画ロジックの適応

**目的**: Matter.Body の状態を読み込んで描画

**変更内容**:

```typescript
private draw() {
  this.ctx.clearRect(0, 0, this.W, this.H);

  // 各 Body を描画
  for (const body of this.bodies) {
    const metadata = this.particleMap.get(body.id);
    if (!metadata) continue;

    // Body から位置・回転角度を読み込み
    const x = body.position.x;
    const y = body.position.y;
    const angle = body.angle;  // ← 回転角度
    const r = this.getBodyRadius(body);

    // 形状に応じて描画
    drawShape(this.ctx, metadata.shape, x, y, r, metadata.color, angle);

    // 誕生日マークなど
    if (metadata.isBirthday) {
      this.drawBirthdayIcon(x, y, r);
    }
  }
}
```

**重要な変更点**:

- `this.particles[]` → `this.bodies[]` (Matter.Body)
- `.x, .y` → `.position.x, .position.y`
- `.angle` → `.angle` (自動更新)
- `.vx, .vy` → `.velocity.x, .velocity.y`

**確認項目**:

- 全グミが正しい位置に表示される
- 回転が反映される
- パフォーマンスが低下しない

---

### Phase 4: インタラクション (10-11)

#### Step 10: ドラッグインタラクション（Constraint を使用）

**目的**: マウスドラッグでグミを移動・操作

**Matter.js の Constraint 活用**:

```typescript
private dragConstraint: Constraint | null = null;

private handleMouseDown(e: MouseEvent) {
  const pos = this.getMousePos(e);

  // クリック位置の Body を検索
  const body = this.findBodyAt(pos.x, pos.y);

  if (body) {
    // Constraint で Body をマウス位置に拘束
    this.dragConstraint = Constraint.create({
      bodyB: body,
      pointB: { x: pos.x - body.position.x, y: pos.y - body.position.y },
      pointA: { x: pos.x, y: pos.y },
      length: 0,
      stiffness: 1,
    });

    World.add(this.world, this.dragConstraint);
    this.draggedBody = body;
  }
}

private handleMouseMove(e: MouseEvent) {
  const pos = this.getMousePos(e);

  if (this.dragConstraint) {
    // Constraint の pointA をマウス位置に更新
    this.dragConstraint.pointA = { x: pos.x, y: pos.y };
  }
}

private handleMouseUp() {
  if (this.dragConstraint) {
    World.remove(this.world, this.dragConstraint);
    this.dragConstraint = null;
    this.draggedBody = null;
  }
}
```

**オプション: 周辺粒子の反発**

```typescript
// ドラッグ中、周辺粒子に力を加える
if (this.draggedBody) {
  for (const body of this.bodies) {
    if (body === this.draggedBody) continue;

    const dx = body.position.x - this.draggedBody.position.x;
    const dy = body.position.y - this.draggedBody.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const minDist = this.getBodyRadius(this.draggedBody) + this.getBodyRadius(body);

    if (dist < minDist && dist > 0) {
      // 反発力を加える
      const force = 2.5 * (minDist - dist);
      Body.applyForce(body, body.position, {
        x: (dx / dist) * force,
        y: (dy / dist) * force,
      });
    }
  }
}
```

**確認項目**:

- グミをドラッグして移動できる
- 周辺粒子が弾き飛ばされる
- ドラッグ終了後に通常の物理演算に戻る

---

#### Step 11: shake() 機能の実装

**目的**: 全粒子にランダムな速度を加える

**実装内容**:

```typescript
public shake() {
  for (const body of this.bodies) {
    const randomVx = (Math.random() - 0.5) * 30;
    const randomVy = (Math.random() - 0.7) * 25;

    Body.setVelocity(body, {
      x: body.velocity.x + randomVx,
      y: body.velocity.y + randomVy,
    });
  }
}
```

**確認項目**:

- 全グミが揺れる
- 揺れの強さが適切

---

### Phase 5: パフォーマンス最適化 (12-13)

#### Step 12: グリッド空間分割の削除（Matter.js に委譲）

**目的**: 衝突検出をすべて Matter.js に任せる

**変更内容**:

```typescript
// 削除対象:
// - this.buildGrid()
// - this.checkCollision()
// - this.resolve() の衝突ペア検出

// 理由:
// Matter.js は内部で Broad Phase / Narrow Phase を実装
// カスタム実装より効率的
```

**確認項目**:

- 衝突がすべて正確に検出される
- パフォーマンスが低下しない（むしろ向上の可能性）

---

#### Step 13: エンジン設定の最適化

**目的**: Matter.js エンジンの詳細設定を調整

**調整対象**:

```typescript
// enableSleeping: 静止オブジェクトを自動スリープ
this.engine.enableSleeping = true;

// gravitScale: 重力スケーリング
this.engine.gravity.scale = 0.001;

// 衝突検出の精度
this.engine.collisionDetection = 'sat'; // SAT 衝突検出

// 演算ステップ数
Engine.update(this.engine, deltaTime, 1); // deltaTime, speed, correction
```

**パフォーマンスチューニング**:
| 設定項目 | 効果 | 副作用 |
|---------|------|------|
| enableSleeping | CPU 削減 | グミが完全に静止する |
| velocityIterations | 精度向上 | CPU 増加 |
| positionIterations | 位置精度 | CPU 増加 |

**確認項目**:

- 60 FPS を維持
- 1000 粒子でも滑らかに動作

---

## コード構造概要

### ファイル編集対象

1. **src/physics/GummyWorld.ts** (主要変更)
   - Matter.js のインポート追加
   - Engine / World の初期化
   - 粒子管理を Body 管理に変更
   - イベントハンドラの追加

2. **src/lib/shape.ts** (参照)
   - drawShape() は変更なし（角度パラメータは活用）
   - getShapeBounds() は参照のみ

3. **package.json** (依存関係追加)
   - `matter-js` パッケージの追加
   - `@types/matter-js` の追加

4. **その他** (変更なし)
   - App.tsx: インターフェース変更なし
   - useGummyWorld.ts: インターフェース変更なし
   - shape.ts, color.ts: そのまま利用

---

## 段階的な実装順序（推奨）

```
Phase 1: 基礎
  ├─ Step 1: Matter.js 導入
  ├─ Step 2: Engine / World 初期化
  └─ Step 3: 剛体化（circle 形状のみ）
       ↓
Phase 2: 物理演算の自動化
  ├─ Step 4: 境界条件（壁・床）
  ├─ Step 5: 衝突イベント・反発
  └─ Step 6: 重力・中心バイアス調整
       ↓
Phase 3: 回転・形状
  ├─ Step 7: 鉛筆の回転トルク
  ├─ Step 8: 多形状対応
  └─ Step 9: 描画ロジック適応
       ↓
Phase 4: インタラクション
  ├─ Step 10: ドラッグ Constraint
  └─ Step 11: shake() 機能
       ↓
Phase 5: 最適化
  ├─ Step 12: グリッド削除
  └─ Step 13: エンジン設定調整
```

---

## テスト検証フロー

各ステップ完了後の確認項目:

```
Step 1-2 → Package インストール確認
Step 3   → グミが表示され、ワールドに存在する確認
Step 4   → 床・壁との衝突が機能する確認
Step 5   → グミ同士の衝突・反発が視覚的に確認できる
Step 6   → 重力・空気抵抗が適切に適用されている確認
Step 7   → 鉛筆がランダムに回転・復元する確認
Step 8   → 各形状が異なる物理挙動を示す確認
Step 9   → 描画漏れがなく、パフォーマンスが低下しない確認
Step 10  → ドラッグで自由にグミを操作できる確認
Step 11  → shake() で全グミが揺れる確認
Step 12  → 衝突検出が正確で、パフォーマンスが向上した確認
Step 13  → 1000 粒子で 60 FPS を維持できる確認
```

---

## リスク・ミティゲーション

### リスク 1: 物理パラメータのスケーリング

**問題**: Matter.js と現在の実装で単位系が異なる可能性
**対応**: Step 6 で実験的に調整、複数の値を試行

### リスク 2: ハート形の衝突判定

**問題**: 複雑な形状は Matter.js で正確に表現困難
**対応**: Step 8 で円で近似するか、複合剛体を検討

### リスク 3: パフォーマンス低下

**問題**: Matter.js のオーバーヘッドでフレームレート低下の可能性
**対応**: Step 12-13 で最適化、sleepingMode 活用

### リスク 4: ドラッグの滑らかさ

**問題**: Constraint のレスポンスが悪い可能性
**対応**: Step 10 で stiffness, damping パラメータを調整

---

## 成功条件

✅ 全 13 ステップが完了し、以下を満たすこと:

1. **機能面**
   - グミが重力で落下する
   - グミ同士が衝突・反発する
   - 鉛筆がランダムに回転する
   - ドラッグでグミを自由に操作できる
   - shake() で全グミが揺れる

2. **パフォーマンス面**
   - 1000 粒子で 60 FPS 以上を維持
   - ドラッグ時の遅延がない

3. **UI/UX 面**
   - 既存の UI に変更がない
   - 誕生日マーク・ツールチップが正常に表示される
   - ビジュアルが損なわれていない

4. **テスト面**
   - 既存の unit test（EventList.test.tsx など）が通過
   - 物理演算の挙動が見た目で確認できる
