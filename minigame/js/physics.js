/**
 * 轻量圆盘 2D 物理（仅平移，无旋转）
 * 强化位置分离 + 低速休眠，减轻堆叠抖动/重合
 */
const GameConfig = require('./config');

let _id = 1;

/** 休眠速度阈值（设计坐标/秒） */
const SLEEP_VEL = 28;
/** 连续低速多久后休眠（秒） */
const SLEEP_TIME = 0.06;
/** 唤醒冲量阈值 */
const WAKE_IMPULSE = 45;

function createBody(opts) {
  const b = {
    id: _id++,
    x: opts.x,
    y: opts.y,
    vx: opts.vx || 0,
    vy: opts.vy || 0,
    r: opts.r,
    level: opts.level,
    mass: Math.max(0.6, (opts.r * opts.r) / 900),
    invMass: 0,
    static: !!opts.static,
    held: !!opts.held,
    merging: false,
    /** 已下落累计时间（held 时不增加），用于危险线忽略刚投下的猫 */
    life: 0,
    /** 休眠：静止堆叠时跳过积分与冲量，避免抖动 */
    sleeping: false,
    sleepTimer: 0,
  };
  recomputeInvMass(b);
  return b;
}

function recomputeInvMass(b) {
  b.invMass = (b.static || b.held || b.merging) ? 0 : 1 / b.mass;
}

function wakeBody(b) {
  if (!b || b.static || b.held || b.merging) return;
  b.sleeping = false;
  b.sleepTimer = 0;
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

  /** 屏幕布局变化后同步墙/地面 */
  syncBounds() {
    this.left = GameConfig.wallPadding;
    this.right = GameConfig.designWidth - GameConfig.wallPadding;
    this.floor = GameConfig.floorY;
    this.gravity = GameConfig.gravity;
  }

  add(body) {
    recomputeInvMass(body);
    wakeBody(body);
    this.bodies.push(body);
    return body;
  }

  remove(body) {
    const i = this.bodies.indexOf(body);
    if (i >= 0) this.bodies.splice(i, 1);
  }

  /** 唤醒某点附近的休眠体（投放后用） */
  wakeAround(x, y, radius) {
    const r2 = radius * radius;
    for (let i = 0; i < this.bodies.length; i++) {
      const b = this.bodies[i];
      if (!b.sleeping) continue;
      const dx = b.x - x;
      const dy = b.y - y;
      if (dx * dx + dy * dy <= r2) wakeBody(b);
    }
  }

  /** 合成拆掉支撑后，整堆需要重新受重力 */
  wakeAll() {
    const bodies = this.bodies;
    for (let i = 0; i < bodies.length; i++) wakeBody(bodies[i]);
  }

  step(dt) {
    const g = this.gravity;
    const bodies = this.bodies;

    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      if (b.static || b.held || b.merging || b.sleeping) continue;
      b.vy += g * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }

    // 多轮位置分离，优先消除重合
    const iters = 16;
    for (let k = 0; k < iters; k++) {
      this._separateWalls();
      this._separateCircles();
    }

    this._resolveVelocities();
    this._postStabilize(dt);
  }

  _inv(b) {
    if (b.static || b.held || b.merging) return 0;
    // 休眠体仍可被推开，但惯性极大，减少链式抖动
    if (b.sleeping) return b.invMass * 0.08;
    return b.invMass;
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

      let hit = false;
      if (b.x - b.r < left) {
        b.x = left + b.r;
        hit = true;
      } else if (b.x + b.r > right) {
        b.x = right - b.r;
        hit = true;
      }
      if (b.y + b.r > floor) {
        b.y = floor - b.r;
        hit = true;
      }
      if (b.y - b.r < 8) {
        b.y = 8 + b.r;
        hit = true;
      }
      // 贴墙/地时若几乎静止，不强制唤醒
      if (hit && (Math.abs(b.vx) > SLEEP_VEL || Math.abs(b.vy) > SLEEP_VEL)) {
        wakeBody(b);
      }
    }
  }

  _separateCircles() {
    const bodies = this.bodies;
    const n = bodies.length;
    // 全量修正 + 极小 slop，避免堆叠残留重合
    const percent = 1.0;
    const slop = 0.02;

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
        if (distSq >= minDist * minDist || distSq < 1e-12) continue;

        let dist = Math.sqrt(distSq);
        let nx = dx / dist;
        let ny = dy / dist;
        // 完全重合时沿竖直方向分开，避免 NaN
        if (dist < 1e-6) {
          nx = 0;
          ny = 1;
          dist = 1e-6;
        }

        let invA = this._inv(a);
        let invB = this._inv(b);
        if (invA + invB === 0) {
          // 双休眠仍强行分开一点，防止视觉重合
          if (a.sleeping && b.sleeping) {
            const half = (minDist - dist) * 0.5;
            a.x -= nx * half;
            a.y -= ny * half;
            b.x += nx * half;
            b.y += ny * half;
            wakeBody(a);
            wakeBody(b);
          }
          continue;
        }

        // 堆叠稳定：下方物体少移动（更像支撑面）
        if (!a.sleeping && !b.sleeping && !a.static && !b.static) {
          if (a.y > b.y + 2) invA *= 0.55;
          else if (b.y > a.y + 2) invB *= 0.55;
        }

        const pen = minDist - dist - slop;
        if (pen <= 0) continue;
        const corr = (pen / (invA + invB)) * percent;
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
      if (b.static || b.held || b.merging || b.sleeping) continue;

      if (b.x - b.r <= left + 0.5 && b.vx < 0) {
        b.vx = Math.abs(b.vx) < 40 ? 0 : -b.vx * rest * 0.5;
      } else if (b.x + b.r >= right - 0.5 && b.vx > 0) {
        b.vx = Math.abs(b.vx) < 40 ? 0 : -b.vx * rest * 0.5;
      }

      if (b.y + b.r >= floor - 0.5) {
        if (b.vy > 0) {
          // 低速直接贴地，杜绝地板弹跳
          b.vy = b.vy < 100 ? 0 : -b.vy * rest * 0.55;
        }
        if (Math.abs(b.vx) > 4) b.vx *= (1 - fric * 0.65);
        else b.vx = 0;
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
        // 仅处理接触/微重叠邻接
        if (distSq > (minDist + 1.5) * (minDist + 1.5) || distSq < 1e-12) continue;

        const dist = Math.sqrt(distSq);
        const nx = dist > 1e-6 ? dx / dist : 0;
        const ny = dist > 1e-6 ? dy / dist : 1;
        const invA = this._inv(a);
        const invB = this._inv(b);
        if (invA + invB === 0) continue;

        const spdA = Math.hypot(a.vx, a.vy);
        const spdB = Math.hypot(b.vx, b.vy);
        // 双方都几乎静止：直接锁死相对速度，跳过冲量（消灭堆叠微颤）
        if (spdA < SLEEP_VEL && spdB < SLEEP_VEL && !a.sleeping && !b.sleeping) {
          // 质量加权均速，消掉相对滑动
          const mA = 1 / Math.max(a.invMass, 1e-6);
          const mB = 1 / Math.max(b.invMass, 1e-6);
          const mx = (a.vx * mA + b.vx * mB) / (mA + mB);
          const my = (a.vy * mA + b.vy * mB) / (mA + mB);
          if (!a.static) { a.vx = mx * 0.5; a.vy = my * 0.5; }
          if (!b.static) { b.vx = mx * 0.5; b.vy = my * 0.5; }
          continue;
        }

        const rvx = b.vx - a.vx;
        const rvy = b.vy - a.vy;
        const velN = rvx * nx + rvy * ny;

        // 分离中：不处理
        if (velN > 0.5) continue;

        const impact = Math.abs(velN);
        // 堆叠微颤：完全消掉法向相对速度，不反弹
        const e = impact < 100 ? 0 : (impact < 220 ? rest * 0.2 : rest);
        const jn = -(1 + e) * velN / (invA + invB);

        if (Math.abs(jn) > WAKE_IMPULSE) {
          wakeBody(a);
          wakeBody(b);
        }

        if (invA > 0) {
          a.vx -= jn * nx * invA;
          a.vy -= jn * ny * invA;
        }
        if (invB > 0) {
          b.vx += jn * nx * invB;
          b.vy += jn * ny * invB;
        }

        // 切向摩擦：低速直接刹停，减少横滑抖动
        const tx = -ny;
        const ty = nx;
        const velT = (b.vx - a.vx) * tx + (b.vy - a.vy) * ty;
        let jt;
        if (impact < 80 && Math.abs(velT) < 60) {
          jt = -velT / (invA + invB);
        } else {
          jt = -velT / (invA + invB) * (fric * 0.65);
          const maxF = Math.abs(jn) * fric;
          if (jt > maxF) jt = maxF;
          if (jt < -maxF) jt = -maxF;
        }
        if (invA > 0) {
          a.vx -= tx * jt * invA;
          a.vy -= ty * jt * invA;
        }
        if (invB > 0) {
          b.vx += tx * jt * invB;
          b.vy += ty * jt * invB;
        }
      }
    }
  }

  _postStabilize(dt) {
    const bodies = this.bodies;
    const floor = this.floor;

    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      if (b.static || b.held || b.merging) continue;

      // 贴地修正
      if (b.y + b.r >= floor - 0.25) {
        b.y = floor - b.r;
        if (b.vy > 0 && b.vy < 120) b.vy = 0;
        if (Math.abs(b.vx) < 20) b.vx = 0;
      }

      if (b.sleeping) {
        b.vx = 0;
        b.vy = 0;
        continue;
      }

      // 强阻尼：接触堆叠后迅速静止
      const spd = Math.hypot(b.vx, b.vy);
      if (spd < 80) {
        b.vx *= 0.72;
        b.vy *= 0.72;
      } else if (spd < 160) {
        b.vx *= 0.9;
        b.vy *= 0.9;
      }

      if (Math.abs(b.vx) < 4) b.vx = 0;
      if (Math.abs(b.vy) < 4) b.vy = 0;

      const still = Math.abs(b.vx) < SLEEP_VEL && Math.abs(b.vy) < SLEEP_VEL;
      if (still && this._canSleep(b)) {
        b.sleepTimer += dt;
        // 几乎完全静止时更快入睡
        if (spd < 4) b.sleepTimer += dt * 2;
        if (b.sleepTimer >= SLEEP_TIME) {
          b.sleeping = true;
          b.vx = 0;
          b.vy = 0;
          b.sleepTimer = 0;
        }
      } else {
        b.sleepTimer = 0;
      }
    }
  }

  /** 是否与地面或其它支撑接触，才允许休眠 */
  _canSleep(b) {
    const floor = this.floor;
    if (b.y + b.r >= floor - 1.5) return true;

    const bodies = this.bodies;
    for (let i = 0; i < bodies.length; i++) {
      const o = bodies[i];
      if (o === b || o.merging || o.held) continue;
      const dx = o.x - b.x;
      const dy = o.y - b.y;
      const minDist = o.r + b.r + 2;
      if (dx * dx + dy * dy > minDist * minDist) continue;
      // 下方有支撑，或对方已休眠
      if (o.y > b.y + 1 || o.sleeping || o.static) return true;
    }
    return false;
  }

  collectMergePairs(maxLevel) {
    const pairs = [];
    const used = new Set();
    const bodies = this.bodies;
    const n = bodies.length;

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

  /** 弹出/锁定中的新猫不参与合成，保证连锁逐步可见 */
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
