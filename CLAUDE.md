# CLAUDE.md

Guidance for AI assistants and developers working in this repository.

## Project Overview

《合成大暹罗》(Merge Siamese Cat) — WeChat mini-game: 2D drop-and-merge (Suika-style), 10 cat levels, combo, haptics, local high score, WeChat friend leaderboard.

**There are two codepaths:**

| Path | Stack | When to use |
|------|--------|-------------|
| **`minigame/`（推荐）** | 原生微信小游戏 · Canvas 2D · 自研物理 · **无 Cocos** | 日常开发、预览、发布 |
| 仓库根 `assets/` + Cocos | Cocos Creator **3.8.5** + TypeScript | 仅维护旧编辑器工程时 |

### 原生版（无 Cocos）

```bash
cd minigame
node tools/preview-server.js    # 浏览器 http://127.0.0.1:7456/
# 或：微信开发者工具 → 导入 minigame/ 目录
```

详见 [`minigame/README.md`](minigame/README.md)。

### Cocos 版（遗留）

Build only via Cocos Creator 3.8.5 editor (WeChat Mini Game target). `library/`, `temp/`, `build/` are gitignored. TS non-strict.

### Related docs

| File | Purpose |
|------|---------|
| **CLAUDE.md** (this file) | Canonical project guide |
| **minigame/README.md** | Native build / preview / publish |
| **CAT_DESIGN_GUIDE.md** | Cat art specs (1024×1024, radii 30–230) |

> `GEMINI.md` has been removed. Do not recreate it.

### Design canvas

- **720 × 1280** portrait.
- Lv6–10 radii: 120/136/152/168/184. Two Lv8 must still fit side-by-side on 720 width. Do not inflate without checking.

---

## Native architecture (`minigame/`)

| File | Role |
|------|------|
| `game.js` | WeChat entry → `js/main.js` |
| `js/config.js` | Gravity, radii, score table, theme colors, storage keys |
| `js/physics.js` | Planck/Box2D 封装（对齐旧 Cocos：重力 960、猫 friction 0.2 / restitution 0）；**held 不碰撞** |
| `js/game.js` | State machine: loading → ready → playing → gameover / rank |
| `js/renderer.js` | Canvas draw + UI hit areas (start / gameover / rank) |
| `js/assets.js` | Load `images/cats/cat_1..10.jpeg` |
| `js/storage.js` | `highestScore_Cat` local + `score` cloud; `onHide` flush |
| `js/main.js` | Canvas, input, rAF loop (WeChat + browser) |
| `openDataContext/` | Friend rank; Canvas fallback if no layout engine |
| `tools/preview-server.js` | Local static server + browser bundle |

### Critical constraints (native)

1. Held cat: no circle collision until drop (mirrors old collider-disabled).
2. Merge once per pair; remove both, spawn `level+1` at midpoint; max level 10.
3. Deadline: body top above line (`y - r < deadlineY`) and `|vy|` small for **2s**.
4. After game over: stop spawning; sync cloud score.
5. UI hits use design-space buttons registered in `renderer.hitAreas`.
6. Edit **`minigame/openDataContext`**, not any Cocos `build/` copy.

---

## Cocos architecture (legacy `assets/Scripts/`)

| Script | Role |
|--------|------|
| **GameConfig.ts** | Shared constants + Siamese palette |
| **GameManager.ts** | Singleton, score/combo, merge spawn, cloud |
| **Spawner.ts** | Input, held Static, cooldown |
| **Cat.ts** | BEGIN_CONTACT merge (uuid uniqueness) |
| **Deadline.ts** | Stable-above-line lose condition |
| **WeChatRank.ts** | Main-domain rank panel |
| **SiameseUITheme.ts** | Runtime Graphics theme |

### Critical constraints (Cocos — do not regress)

1. Never mutate physics `active` / RB `enabled` inside `onBeginContact`.
2. Merge: `setScale(0)` + move to (9999,9999), then `scheduleOnce(0)` destroy/spawn; re-check `isGameOver`.
3. GameOver / Rank / Combo must `setSiblingIndex` to top when shown.
4. Merge uniqueness: lower entity-root `uuid` only.
5. Spawner cooldown must no-op when not playable; `onGameOver` unschedules.

---

## Storage keys (both paths)

| Key | Where | Meaning |
|-----|--------|---------|
| `highestScore_Cat` | local / `wx.setStorage` | Local best |
| `score` | `wx.setUserCloudStorage` | Friend rank |

---

## Prefer native for new work

- New features (preview next cat, audio, ads): implement in **`minigame/`** first.
- Keep Cocos tree only if you still ship that binary; otherwise treat as archive.
