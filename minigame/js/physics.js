/**
 * 轻量圆盘 2D 物理
 * 旋转：仅撞击时给短脉冲，随后快速衰减；静止后强制 omega=0
 * （持续滚动耦合会导致堆叠时永不消转，进而拖死危险线判定）
 */
const GameConfig = require('./config');

let _id = 1;

function createBody(opts) {
  const b = {
    id: _id++,
    x: opts.x,
    y: opts.y,
    vx: opts.vx || 0,
    vy: opts.vy || 0,
    angle: opts.angle || 0,
    omega: opts.omega || 0,
    r: opts.r,
    level: opts.level,
    mass: Math.max(0.6, (opts.r * opts.r) / 900),
    invMass: 0,
    static: !!opts.static,
    held: !!opts.held,
    merging: false,
  };
  recomputeInvMass(b);
  return b;
}

function recomputeInvMass(b) {
  b.invMass = (b.static || b.held || b.merging) ? 0 : 1 / b.mass;
}

class PhysicsWorld {
  constructor() {
    this.bodies = [];
    this.left = GameConfig.wallPadding;
    this.right = GameConfig.designWidth - GameConfig.wallPadding;
    this.floor = GameConfig.floorY;
    this.gravity = GameConfig.gravity;
  }

  clear() {
    this.bodies = [];
  }

  add(body) {
    recomputeInvMass(body);
    this.bodies.push(body);
    return body;
  }

  remove(body) {
    const i = this.bodies.indexOf(body);
    if (i >= 0) this.bodies.splice(i, 1);
  }

  step(dt) {
    const g = this.gravity;
    const bodies = this.bodies;

    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      if (b.static || b.held || b.merging) continue;
      b.vy += g * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.angle += b.omega * dt;
    }

    for (let k = 0; k < 8; k++) {
      this._separateWalls();
      this._separateCircles();
    }

    this._resolveVelocities();
    this._finishMotion();
  }

  _inv(b) {
    return (b.static || b.held || b.merging) ? 0 : b.invMass;
  }

  _separateWalls() {
    const left = this.left;
    const right = this.right;
    const floor = this.floor;

    for (let i = 0; i < this.bodies.length; i++) {
      const b = this.bodies[i];
      if (b.merging) continue;
      if (b.held) {
        if (b.x - b.r < left) b.x = left + b.r;
        else if (b.x + b.r > right) b.x = right - b.r;
        continue;
      }
      if (b.static) continue;
      if (b.x - b.r < left) b.x = left + b.r;
      else if (b.x + b.r > right) b.x = right - b.r;
      if (b.y + b.r > floor) b.y = floor - b.r;
      if (b.y - b.r < 8) b.y = 8 + b.r;
    }
  }

  _separateCircles() {
    const bodies = this.bodies;
    const n = bodies.length;
    const percent = 0.8;
    const slop = 0.3;

    for (let i = 0; i < n; i++) {
      const a = bodies[i];
      if (a.merging || a.held) continue;
      for (let j = i + 1; j < n; j++) {
        const b = bodies[j];
        if (b.merging || b.held) continue;

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const minDist = a.r + b.r;
        const distSq = dx * dx + dy * dy;
        if (distSq >= minDist * minDist || distSq < 1e-10) continue;

        const dist = Math.sqrt(distSq);
        const nx = dx / dist;
        const ny = dy / dist;
        const invA = this._inv(a);
        const invB = this._inv(b);
        if (invA + invB === 0) continue;

        const corr = (Math.max(minDist - dist - slop, 0) / (invA + invB)) * percent;
        if (invA > 0) {
          a.x -= nx * corr * invA;
          a.y -= ny * corr * invA;
        }
        if (invB > 0) {
          b.x += nx * corr * invB;
          b.y += ny * corr * invB;
        }
      }
    }
  }

  _resolveVelocities() {
    const bodies = this.bodies;
    const rest = GameConfig.restitution;
    const fric = GameConfig.friction;
    const floor = this.floor;
    const left = this.left;
    const right = this.right;

    // 墙 / 地面：只用平移速度，不维护滚动耦合
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      if (b.static || b.held || b.merging) continue;

      if (b.x - b.r <= left + 0.5 && b.vx < 0) {
        b.vx = -b.vx * rest;
        b.omega *= 0.5;
      } else if (b.x + b.r >= right - 0.5 && b.vx > 0) {
        b.vx = -b.vx * rest;
        b.omega *= 0.5;
      }

      if (b.y + b.r >= floor - 0.5) {
        if (b.vy > 0) {
          // 落地撞击：给一点旋转感，之后靠衰减刹停
          if (b.vy > 120) {
            b.omega += (-Math.sign(b.vx || 1) * Math.min(6, b.vy / 200));
          }
          b.vy = b.vy < 80 ? 0 : -b.vy * rest;
        }
        if (Math.abs(b.vx) > 2) b.vx *= (1 - fric * 0.5);
        else b.vx = 0;
      }

      if (b.y - b.r <= 8.5 && b.vy < 0) b.vy = 0;
    }

    // 圆-圆：法向冲量 + 轻切向摩擦；旋转仅由撞击切向速度脉冲一次
    const n = bodies.length;
    for (let i = 0; i < n; i++) {
      const a = bodies[i];
      if (a.merging || a.held) continue;
      for (let j = i + 1; j < n; j++) {
        const b = bodies[j];
        if (b.merging || b.held) continue;

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const minDist = a.r + b.r;
        const distSq = dx * dx + dy * dy;
        if (distSq > (minDist + 1.2) * (minDist + 1.2) || distSq < 1e-10) continue;

        const dist = Math.sqrt(distSq);
        const nx = dx / dist;
        const ny = dy / dist;
        const invA = this._inv(a);
        const invB = this._inv(b);
        if (invA + invB === 0) continue;

        // 只用平移相对速度（不含 omega），避免旋转互相喂速度
        const rvx = b.vx - a.vx;
        const rvy = b.vy - a.vy;
        const velN = rvx * nx + rvy * ny;
        if (velN >= 0) continue;

        const impact = Math.abs(velN);
        const e = impact < 60 ? rest * 0.35 : rest;
        const jn = -(1 + e) * velN / (invA + invB);
        if (invA > 0) {
          a.vx -= jn * nx * invA;
          a.vy -= jn * ny * invA;
        }
        if (invB > 0) {
          b.vx += jn * nx * invB;
          b.vy += jn * ny * invB;
        }

        // 切向摩擦（平移）
        const tx = -ny;
        const ty = nx;
        const velT = (b.vx - a.vx) * tx + (b.vy - a.vy) * ty;
        let jt = -velT / (invA + invB) * (fric * 0.35);
        const maxF = Math.abs(jn) * fric;
        if (jt > maxF) jt = maxF;
        if (jt < -maxF) jt = -maxF;
        if (invA > 0) {
          a.vx -= tx * jt * invA;
          a.vy -= ty * jt * invA;
        }
        if (invB > 0) {
          b.vx += tx * jt * invB;
          b.vy += ty * jt * invB;
        }

        // 视觉旋转：仅较强撞击给一次脉冲，不持续扭矩
        if (impact > 80) {
          const spin = Math.min(5, impact / 180) * Math.sign(velT || 1);
          if (invA > 0) a.omega -= spin * 0.6;
          if (invB > 0) b.omega += spin * 0.6;
        }
      }
    }
  }

  /** 刹停噪声 + 彻底消除持续旋转 */
  _finishMotion() {
    const bodies = this.bodies;
    const maxOmega = 8;

    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      if (b.static || b.held || b.merging) continue;

      // 硬上限
      if (b.omega > maxOmega) b.omega = maxOmega;
      if (b.omega < -maxOmega) b.omega = -maxOmega;

      // 快速角衰减（约 0.25s 内停转）
      b.omega *= 0.88;

      const lin = Math.sqrt(b.vx * b.vx + b.vy * b.vy);

      // 平移已慢：直接停转，避免视觉狂转 + 扰动堆叠
      if (lin < 80) b.omega *= 0.5;
      if (lin < 45 || Math.abs(b.omega) < 0.6) b.omega = 0;

      if (Math.abs(b.vx) < 2) b.vx = 0;
      if (Math.abs(b.vy) < 2) b.vy = 0;
    }
  }

  collectMergePairs(maxLevel) {
    const pairs = [];
    const used = new Set();
    const bodies = this.bodies;
    const n = bodies.length;

    for (let i = 0; i < n; i++) {
      const a = bodies[i];
      if (a.merging || a.held || a.static || a.level >= maxLevel) continue;
      for (let j = i + 1; j < n; j++) {
        const b = bodies[j];
        if (b.merging || b.held || b.static) continue;
        if (a.level !== b.level) continue;
        if (used.has(a.id) || used.has(b.id)) continue;

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const minDist = a.r + b.r + 2;
        if (dx * dx + dy * dy <= minDist * minDist) {
          pairs.push(a.id < b.id ? [a, b] : [b, a]);
          used.add(a.id);
          used.add(b.id);
        }
      }
    }
    return pairs;
  }
}

module.exports = {
  PhysicsWorld,
  createBody,
  recomputeInvMass,
};
