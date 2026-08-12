/**
 * 轻量圆盘 2D 物理（平移 + 旋转）
 * 位置修正与速度冲量分开
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
    /** 弧度 */
    angle: opts.angle || 0,
    /** 角速度 rad/s */
    omega: opts.omega || 0,
    r: opts.r,
    level: opts.level,
    mass: Math.max(0.6, (opts.r * opts.r) / 900),
    invMass: 0,
    invI: 0,
    static: !!opts.static,
    held: !!opts.held,
    merging: false,
  };
  recomputeInvMass(b);
  return b;
}

function recomputeInvMass(b) {
  if (b.static || b.held || b.merging) {
    b.invMass = 0;
    b.invI = 0;
    return;
  }
  b.invMass = 1 / b.mass;
  // 圆盘转动惯量 I = 0.5 m r²
  const I = 0.5 * b.mass * b.r * b.r;
  b.invI = I > 0 ? 1 / I : 0;
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
    const maxOmega = 10; // rad/s 上限，避免狂转

    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      if (b.static || b.held || b.merging) continue;
      b.vy += g * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.angle += b.omega * dt;
      if (b.omega > maxOmega) b.omega = maxOmega;
      if (b.omega < -maxOmega) b.omega = -maxOmega;
    }

    for (let k = 0; k < 8; k++) {
      this._separateWalls();
      this._separateCircles();
    }

    this._resolveVelocities();
    this._dampRestingSpin();
  }

  /** 几乎静止时尽快刹住旋转，避免堆叠后一直转 */
  _dampRestingSpin() {
    const bodies = this.bodies;
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      if (b.static || b.held || b.merging) continue;

      if (Math.abs(b.vx) < 2) b.vx = 0;
      if (Math.abs(b.vy) < 2) b.vy = 0;

      const lin = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      if (lin < 40) {
        // 平移慢 → 强角阻尼
        b.omega *= 0.72;
      } else {
        b.omega *= 0.99;
      }

      // 贴地：平移慢则快速停转
      if (b.y + b.r >= this.floor - 1) {
        if (lin < 40) b.omega *= 0.55;
        if (lin < 20) b.omega = 0;
      }

      if (lin < 18 || Math.abs(b.omega) < 0.4) {
        if (lin < 25) b.omega = 0;
      }
    }
  }

  _inv(b) {
    return (b.static || b.held || b.merging) ? 0 : b.invMass;
  }

  _invI(b) {
    return (b.static || b.held || b.merging) ? 0 : b.invI;
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
        const overlap = minDist - dist;
        const invA = this._inv(a);
        const invB = this._inv(b);
        if (invA + invB === 0) continue;

        const corr = (Math.max(overlap - slop, 0) / (invA + invB)) * percent;
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

    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      if (b.static || b.held || b.merging) continue;

      if (b.x - b.r <= left + 0.5 && b.vx < 0) {
        b.vx = -b.vx * rest;
        b.omega *= 0.8;
      } else if (b.x + b.r >= right - 0.5 && b.vx > 0) {
        b.vx = -b.vx * rest;
        b.omega *= 0.8;
      }

      if (b.y + b.r >= floor - 0.5) {
        if (b.vy > 0) {
          b.vy = b.vy < 80 ? 0 : -b.vy * rest;
        }
        const invM = b.invMass;
        const invI = b.invI;
        const lin = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        // 仅在明显滑动时做滚动耦合，避免静止时抖动持续供能
        if (invM > 0 && invI > 0 && lin > 25) {
          const vSurf = b.vx - b.omega * b.r;
          if (Math.abs(vSurf) > 8) {
            const k = invM + invI * b.r * b.r;
            let jt = -vSurf / k * fric * 0.6;
            const maxF = 25;
            if (jt > maxF) jt = maxF;
            if (jt < -maxF) jt = -maxF;
            b.vx += jt * invM;
            b.omega -= jt * b.r * invI;
          }
        } else if (Math.abs(b.vx) > 2) {
          b.vx *= 0.97;
          b.omega *= 0.9;
        } else {
          b.vx = 0;
          b.omega = 0;
        }
      }

      if (b.y - b.r <= 8.5 && b.vy < 0) b.vy = 0;
    }

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
        if (distSq > (minDist + 1.5) * (minDist + 1.5) || distSq < 1e-10) continue;

        const dist = Math.sqrt(distSq);
        const nx = dx / dist;
        const ny = dy / dist;
        const invA = this._inv(a);
        const invB = this._inv(b);
        const invIA = this._invI(a);
        const invIB = this._invI(b);
        if (invA + invB === 0) continue;

        // 接触点速度（含旋转）：v + ω × r
        // r_a = (nx,ny)*ra 从圆心指向接触点；ω×r 在 2D 为 (-ω*ry, ω*rx)
        const rax = nx * a.r;
        const ray = ny * a.r;
        const rbx = -nx * b.r;
        const rby = -ny * b.r;
        const vax = a.vx - a.omega * ray;
        const vay = a.vy + a.omega * rax;
        const vbx = b.vx - b.omega * rby;
        const vby = b.vy + b.omega * rbx;
        const rvx = vbx - vax;
        const rvy = vby - vay;
        const velN = rvx * nx + rvy * ny;
        if (velN >= 0) continue;

        const impact = Math.abs(velN);
        const e = impact < 60 ? rest * 0.4 : rest;
        // 法向有效质量（简化：忽略角对法向的贡献，圆对称下接触法向力矩小）
        const jn = -(1 + e) * velN / (invA + invB);
        const ix = jn * nx;
        const iy = jn * ny;
        if (invA > 0) {
          a.vx -= ix * invA;
          a.vy -= iy * invA;
        }
        if (invB > 0) {
          b.vx += ix * invB;
          b.vy += iy * invB;
        }

        // 切向摩擦 + 扭矩：仅中高速碰撞时施加，堆叠静触不转
        if (impact < 35) continue;

        const tx = -ny;
        const ty = nx;
        const rvx2 = (b.vx - b.omega * rby) - (a.vx - a.omega * ray);
        const rvy2 = (b.vy + b.omega * rbx) - (a.vy + a.omega * rax);
        const velT = rvx2 * tx + rvy2 * ty;
        if (Math.abs(velT) < 12) continue;

        const kT = invA + invB + invIA * a.r * a.r + invIB * b.r * b.r;
        if (kT <= 0) continue;
        let jt = -velT / kT * (fric * 0.35);
        const maxF = Math.abs(jn) * fric * 0.8;
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
        if (invIA > 0) {
          const tauA = rax * (-jt * ty) - ray * (-jt * tx);
          a.omega += tauA * invIA;
        }
        if (invIB > 0) {
          const tauB = rbx * (jt * ty) - rby * (jt * tx);
          b.omega += tauB * invIB;
        }
      }
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
