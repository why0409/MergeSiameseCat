/**
 * 轻量圆盘 2D 物理（仅平移，无旋转）
 * 空中保持正常下落；仅在贴地/有支撑时刹停与休眠，避免上顶堆高
 */
const GameConfig = require('./config');

let _id = 1;

const SLEEP_VEL = 20;
const SLEEP_TIME = 0.1;
const WAKE_IMPULSE = 90;
/** 碰撞比绘制略胖，贴紧时圆边不咬合 */
const CONTACT_SKIN = 1.6;
/** 低于此相对法向速度视为静接触：只消闭合速度，不给弹力 */
const REST_IMPACT = 85;

function createBody(opts) {
  const b = {
    id: _id++,
    x: opts.x,
    y: opts.y,
    vx: opts.vx || 0,
    vy: opts.vy || 0,
    r: opts.r,
    level: opts.level,
    // 质量随半径缓增，避免大猫把小猫弹飞（r² 质量比可达 50:1）
    mass: Math.max(0.9, 0.7 + opts.r / 90),
    invMass: 0,
    static: !!opts.static,
    held: !!opts.held,
    merging: false,
    life: 0,
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

    const n = bodies.length;
    const iters = n > 16 ? 10 : 8;
    for (let k = 0; k < iters; k++) {
      this._separateWalls();
      this._separateCircles(0.85, 0.04);
    }
    this._separateWalls();
    this._separateCircles(1, 0);

    this._resolveVelocities();
    this._postStabilize(dt);
  }

  /** 速度冲量：休眠当固定支撑，避免整堆被弹起来 */
  _velInv(b) {
    if (b.static || b.held || b.merging || b.sleeping) return 0;
    return b.invMass;
  }

  /** 位置分离：休眠可被轻轻挤开，密堆才能把穿透解开 */
  _posInv(b) {
    if (b.static || b.held || b.merging) return 0;
    if (b.sleeping) return b.invMass * 0.22;
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

      if (b.x - b.r < left) b.x = left + b.r;
      else if (b.x + b.r > right) b.x = right - b.r;
      if (b.y + b.r > floor) {
        b.y = floor - b.r;
        if (b.sleeping) {
          b.vx = 0;
          b.vy = 0;
        }
      }
      if (b.y - b.r < 8) b.y = 8 + b.r;
    }
  }

  _separateCircles(percent, slop) {
    const bodies = this.bodies;
    const n = bodies.length;
    const minGap = CONTACT_SKIN;

    for (let i = 0; i < n; i++) {
      const a = bodies[i];
      if (a.merging || a.held) continue;
      for (let j = i + 1; j < n; j++) {
        const b = bodies[j];
        if (b.merging || b.held) continue;

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const minDist = a.r + b.r + minGap;
        const distSq = dx * dx + dy * dy;
        if (distSq >= minDist * minDist || distSq < 1e-12) continue;

        let dist = Math.sqrt(distSq);
        let nx;
        let ny;
        if (dist < 1e-6) {
          nx = 0;
          ny = 1;
          dist = 1e-6;
        } else {
          nx = dx / dist;
          ny = dy / dist;
        }

        let invA = this._posInv(a);
        let invB = this._posInv(b);
        if (invA + invB === 0) {
          const half = Math.max(0, minDist - dist) * 0.5;
          if (half > 0 && !a.static && !b.static) {
            a.x -= nx * half;
            a.y -= ny * half;
            b.x += nx * half;
            b.y += ny * half;
          }
          continue;
        }

        const pen = minDist - dist - slop;
        if (pen <= 0) continue;
        let corr = (pen / (invA + invB)) * percent;
        // 单次位移封顶，避免大重叠时一帧弹飞
        const maxMove = 22;
        const moveA = corr * invA;
        const moveB = corr * invB;
        if (moveA > maxMove || moveB > maxMove) {
          const s = maxMove / Math.max(moveA, moveB);
          corr *= s;
        }
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
        b.vx = Math.abs(b.vx) < 45 ? 0 : -b.vx * rest * 0.55;
      } else if (b.x + b.r >= right - 0.5 && b.vx > 0) {
        b.vx = Math.abs(b.vx) < 45 ? 0 : -b.vx * rest * 0.55;
      }

      if (b.y + b.r >= floor - 0.5) {
        if (b.vy > 0) {
          // 重力主导：快碰才弹一下，随后能量按 e² 衰减
          b.vy = b.vy < 75 ? 0 : -b.vy * rest;
        }
        if (Math.abs(b.vx) > 3) b.vx *= (1 - fric * 0.7);
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
        // 只在真正压进碰撞壳时才做冲量；贴着皮肤间距的静接触不要每帧弹
        const touch = a.r + b.r + 0.5;
        const distSq = dx * dx + dy * dy;
        if (distSq > touch * touch || distSq < 1e-12) continue;

        const dist = Math.sqrt(distSq);
        const nx = dist > 1e-6 ? dx / dist : 0;
        const ny = dist > 1e-6 ? dy / dist : 1;
        const invA = this._velInv(a);
        const invB = this._velInv(b);
        if (invA + invB === 0) continue;

        const rvx = b.vx - a.vx;
        const rvy = b.vy - a.vy;
        const velN = rvx * nx + rvy * ny;
        if (velN > 0.3) continue;

        const impact = Math.abs(velN);
        // 砸到已经稳住的支撑才弹；整列一起下沉不弹，避免堆里抖
        const aLand = a.vy > 140 && (b.sleeping || Math.abs(b.vy) < 30) && b.y > a.y + 10;
        const bLand = b.vy > 140 && (a.sleeping || Math.abs(a.vy) < 30) && a.y > b.y + 10;
        const canBounce = (aLand || bLand) && impact >= REST_IMPACT;
        const e = canBounce ? rest : 0;
        const jn = -(1 + e) * velN / (invA + invB);

        if (canBounce && Math.abs(jn) > WAKE_IMPULSE) {
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

        const tx = -ny;
        const ty = nx;
        const velT = (b.vx - a.vx) * tx + (b.vy - a.vy) * ty;
        const fricScale = canBounce ? (fric * 0.7) : 1;
        let jt = -velT / (invA + invB) * fricScale;
        const maxF = Math.abs(jn) * (canBounce ? fric : 1);
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
      }
    }
  }

  _postStabilize(dt) {
    const bodies = this.bodies;
    const floor = this.floor;

    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      if (b.static || b.held || b.merging) continue;

      if (b.y + b.r >= floor - 0.25) {
        b.y = floor - b.r;
        if (b.vy > 0 && b.vy < 70) b.vy = 0;
      }

      if (b.sleeping) {
        b.vx = 0;
        b.vy = 0;
        continue;
      }

      const supported = this._canSleep(b);
      if (supported) {
        if (Math.abs(b.vx) < 120) b.vx *= 0.78;
        // 已经压在支撑上：消掉向下的余速，否则会每帧砸进去再被顶出来（重叠+抖动）
        if (b.vy > 0) b.vy = 0;
      }

      const spd = Math.hypot(b.vx, b.vy);
      if (spd > 820) {
        const k = 820 / spd;
        b.vx *= k;
        b.vy *= k;
      }

      if (Math.abs(b.vx) < 2.5) b.vx = 0;
      if (supported && Math.abs(b.vy) < 6) b.vy = 0;

      const still = Math.abs(b.vx) < SLEEP_VEL && Math.abs(b.vy) < SLEEP_VEL;
      if (still && supported) {
        b.sleepTimer += dt;
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

  /** 地面，或接触点法向朝下（压在另一只猫上） */
  _canSleep(b) {
    const floor = this.floor;
    if (b.y + b.r >= floor - 1.2) return true;

    const bodies = this.bodies;
    for (let i = 0; i < bodies.length; i++) {
      const o = bodies[i];
      if (o === b || o.merging || o.held) continue;
      const dx = o.x - b.x;
      const dy = o.y - b.y;
      const minDist = o.r + b.r + CONTACT_SKIN + 2;
      const distSq = dx * dx + dy * dy;
      if (distSq > minDist * minDist || distSq < 1e-12) continue;
      const ny = dy / Math.sqrt(distSq);
      if (ny > 0.18) return true;
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
