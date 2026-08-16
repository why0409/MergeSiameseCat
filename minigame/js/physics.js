/**
 * Box2D（Planck.js）封装，对齐旧 Cocos PhysicsSystem2D
 * Cocos：gravity (0,-960) y-up，像素/米=32；猫 density 1、可旋转
 * 打开旋转 + 轻弹力，避免锁旋转后往上堆成柱、没有撞击感
 */
const GameConfig = require('./config');
const planck = require('./vendor/planck');

const PTM = 32;
const CAT_BIT = 0x0002;
const WALL_BIT = 0x0001;

let _id = 1;

function toM(px) {
  return px / PTM;
}

function toP(m) {
  return m * PTM;
}

function createBody(opts) {
  return {
    id: _id++,
    x: opts.x,
    y: opts.y,
    vx: opts.vx || 0,
    vy: opts.vy || 0,
    angle: opts.angle || 0,
    omega: opts.omega || 0,
    r: opts.r,
    level: opts.level,
    mass: Math.max(0.6, (opts.r * opts.r) / 1024),
    invMass: 0,
    static: !!opts.static,
    held: !!opts.held,
    merging: false,
    life: 0,
    sleeping: false,
    sleepTimer: 0,
    fallGrace: 0,
    mergeLock: 0,
    _b2: null,
    _fix: null,
  };
}

function recomputeInvMass(b) {
  if (!b || !b._b2) {
    b.invMass = (b.static || b.held || b.merging) ? 0 : 1 / Math.max(b.mass, 0.01);
    return;
  }
  syncType(b);
  applyMotion(b);
}

function applyMotion(b) {
  if (!b || !b._b2 || b.held || b.merging || b.static) return;
  b._b2.setLinearVelocity(planck.Vec2(toM(b.vx), toM(b.vy)));
  b._b2.setAngularVelocity(b.omega || 0);
  b._b2.setAwake(true);
}

/**
 * 只在贴地面时轻轻收横移，猫与猫之间不减速，避免胶粘。
 * 不把速度打成 0，否则会像被钉住。
 */
function settleOnFloor(b, floor) {
  if (!b || b.y + b.r < floor - 5) return;
  if (Math.abs(b.vy) > 50) return;
  b.vx *= 0.97;
  b.omega = (b.omega || 0) * 0.97;
  if (b._b2) {
    b._b2.setLinearVelocity(planck.Vec2(toM(b.vx), toM(b.vy)));
    b._b2.setAngularVelocity(b.omega);
  }
}

function wakeBody(b) {
  if (!b || b.static || b.held || b.merging) return;
  b.sleeping = false;
  if (b._b2) b._b2.setAwake(true);
}

function syncType(b) {
  const body = b._b2;
  if (!body) return;
  const locked = b.static || b.held || b.merging;
  body.setType(locked ? 'kinematic' : 'dynamic');
  const mask = locked ? 0 : (CAT_BIT | WALL_BIT);
  for (let f = body.getFixtureList(); f; f = f.getNext()) {
    f.setFilterCategoryBits(CAT_BIT);
    f.setFilterMaskBits(mask);
    f.refilter();
  }
  if (!locked) body.setAwake(true);
}

function pushToBox(b) {
  if (!b._b2) return;
  b._b2.setTransform(planck.Vec2(toM(b.x), toM(b.y)), b.angle || 0);
  b._b2.setLinearVelocity(planck.Vec2(toM(b.vx), toM(b.vy)));
  b._b2.setAngularVelocity(b.omega || 0);
}

function pullFromBox(b) {
  if (!b._b2) return;
  const p = b._b2.getPosition();
  b.x = toP(p.x);
  b.y = toP(p.y);
  const v = b._b2.getLinearVelocity();
  b.vx = toP(v.x);
  b.vy = toP(v.y);
  b.angle = b._b2.getAngle();
  b.omega = b._b2.getAngularVelocity();
  b.sleeping = !b._b2.isAwake();
}

class PhysicsWorld {
  constructor() {
    this.bodies = [];
    this.left = GameConfig.wallPadding;
    this.right = GameConfig.designWidth - GameConfig.wallPadding;
    this.floor = GameConfig.floorY;
    this.gravity = GameConfig.gravity;
    this._world = null;
    this._walls = null;
    this._initWorld();
  }

  _initWorld() {
    const g = toM(GameConfig.gravity || 960);
    this._world = planck.World(planck.Vec2(0, g));
    this._buildWalls();
  }

  _buildWalls() {
    if (this._walls && this._world) {
      this._world.destroyBody(this._walls);
      this._walls = null;
    }
    const left = toM(this.left);
    const right = toM(this.right);
    const floor = toM(this.floor);
    const top = toM(-200);
    const bot = toM(this.floor + 400);

    this._walls = this._world.createBody({ type: 'static' });
    const wallFix = {
      density: 1,
      friction: 0.55,
      restitution: 0.1,
      filterCategoryBits: WALL_BIT,
      filterMaskBits: CAT_BIT,
    };
    this._walls.createFixture(planck.Edge(planck.Vec2(left, top), planck.Vec2(left, bot)), wallFix);
    this._walls.createFixture(planck.Edge(planck.Vec2(right, top), planck.Vec2(right, bot)), wallFix);
    this._walls.createFixture(planck.Edge(planck.Vec2(left - 1, floor), planck.Vec2(right + 1, floor)), wallFix);
  }

  clear() {
    for (let i = 0; i < this.bodies.length; i++) {
      const b = this.bodies[i];
      if (b._b2) {
        this._world.destroyBody(b._b2);
        b._b2 = null;
        b._fix = null;
      }
    }
    this.bodies = [];
  }

  syncBounds() {
    this.left = GameConfig.wallPadding;
    this.right = GameConfig.designWidth - GameConfig.wallPadding;
    this.floor = GameConfig.floorY;
    this.gravity = GameConfig.gravity;
    if (this._world) {
      this._world.setGravity(planck.Vec2(0, toM(this.gravity)));
      this._buildWalls();
    }
  }

  add(body) {
    const type = (body.static || body.held || body.merging) ? 'kinematic' : 'dynamic';
    const b2 = this._world.createBody({
      type,
      position: planck.Vec2(toM(body.x), toM(body.y)),
      angle: body.angle || 0,
      linearVelocity: planck.Vec2(toM(body.vx || 0), toM(body.vy || 0)),
      angularVelocity: body.omega || 0,
      allowSleep: true,
      awake: true,
      fixedRotation: false,
      bullet: false,
      linearDamping: 0,
      angularDamping: GameConfig.angularDamping || 0.35,
      gravityScale: 1,
    });
    const locked = type !== 'dynamic';
    const fix = b2.createFixture(planck.Circle(toM(body.r)), {
      density: 1,
      friction: GameConfig.friction != null ? GameConfig.friction : 0.12,
      restitution: GameConfig.restitution != null ? GameConfig.restitution : 0.08,
      filterCategoryBits: CAT_BIT,
      filterMaskBits: locked ? 0 : (CAT_BIT | WALL_BIT),
    });
    body._b2 = b2;
    body._fix = fix;
    b2.setUserData(body);
    this.bodies.push(body);
    return body;
  }

  remove(body) {
    const i = this.bodies.indexOf(body);
    if (i >= 0) this.bodies.splice(i, 1);
    if (body._b2) {
      this._world.destroyBody(body._b2);
      body._b2 = null;
      body._fix = null;
    }
  }

  wakeAround(x, y, radius) {
    const r2 = radius * radius;
    for (let i = 0; i < this.bodies.length; i++) {
      const b = this.bodies[i];
      if (b.held || b.merging || b.static) continue;
      const dx = b.x - x;
      const dy = b.y - y;
      if (dx * dx + dy * dy <= r2) wakeBody(b);
    }
  }

  wakeAll() {
    for (let i = 0; i < this.bodies.length; i++) wakeBody(this.bodies[i]);
  }

  /**
   * 把 body 从其它圆里拨开（优先往上），避免投放/合成时嵌进去再被位置修正弹飞。
   */
  unstick(body) {
    if (!body || body.held) return;
    const left = this.left;
    const right = this.right;
    const floor = this.floor;
    for (let k = 0; k < 8; k++) {
      let moved = false;
      for (let i = 0; i < this.bodies.length; i++) {
        const o = this.bodies[i];
        if (!o || o === body || o.held || o.merging) continue;
        const dx = body.x - o.x;
        const dy = body.y - o.y;
        const min = body.r + o.r + 0.8;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2);
        if (d < 1e-4) {
          body.y = o.y - min;
        } else {
          const pen = min - d;
          body.x += (dx / d) * pen;
          body.y += (dy / d) * pen;
        }
        body.x = Math.max(left + body.r, Math.min(right - body.r, body.x));
        if (body.y + body.r > floor) body.y = floor - body.r;
        moved = true;
      }
      if (!moved) break;
    }
    if (body._b2) pushToBox(body);
  }

  step(dt) {
    const bodies = this.bodies;
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      if (!b._b2) continue;
      if (b.held || b.merging) {
        b._b2.setTransform(planck.Vec2(toM(b.x), toM(b.y)), b.held ? 0 : (b.angle || 0));
        b._b2.setLinearVelocity(planck.Vec2(0, 0));
        b._b2.setAngularVelocity(0);
      }
    }

    this._world.step(dt, 10, 6);

    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      if (!b._b2 || b.held || b.merging) continue;
      pullFromBox(b);
      settleOnFloor(b, this.floor);
    }
  }

  collectMergePairs(maxLevel) {
    const pairs = [];
    const used = new Set();
    const bodies = this.bodies;
    const n = bodies.length;
    const slop = 8;

    for (let i = 0; i < n; i++) {
      const a = bodies[i];
      if (!this._canStartMerge(a, maxLevel)) continue;
      for (let j = i + 1; j < n; j++) {
        const b = bodies[j];
        if (!this._canStartMerge(b, maxLevel)) continue;
        if (a.level !== b.level) continue;
        if (used.has(a.id) || used.has(b.id)) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const minDist = a.r + b.r + slop;
        if (dx * dx + dy * dy <= minDist * minDist) {
          pairs.push(a.id < b.id ? [a, b] : [b, a]);
          used.add(a.id);
          used.add(b.id);
        }
      }
    }
    return pairs;
  }

  _canStartMerge(b, maxLevel) {
    if (!b || b.merging || b.held || b.static) return false;
    if (b.level >= maxLevel) return false;
    if ((b.mergeLock || 0) > 0) return false;
    if (b.spawnAnim != null && b.spawnAnim < 1) return false;
    return true;
  }
}

module.exports = {
  PhysicsWorld,
  createBody,
  recomputeInvMass,
  wakeBody,
};
