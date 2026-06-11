# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

《合成大暹罗》(Merge Siamese Cat) — a WeChat mini-game built with **Cocos Creator 3.8.5 (LTS)** + TypeScript. Gameplay: 2D physics drop-and-merge (Suika-style) with 10 cat levels, WeChat cloud-storage leaderboard, combo system, and haptic feedback.

There are no CLI build/test commands. The project is built and run through the Cocos Creator 3.8.5 editor GUI (build target: WeChat Mini Game), then previewed/published via WeChat DevTools. `library/`, `temp/`, `build/` are editor-generated and gitignored. TypeScript is non-strict (see `tsconfig.json`).

`GEMINI.md` is the original development blueprint (roadmap, milestones, maintenance notes, in Chinese) — keep it updated when making significant changes. `CAT_DESIGN_GUIDE.md` documents art specs for the 10 cat levels (1024×1024 1:1 JPEG, physics radii 30–230; the Lv6–10 curve was deliberately compressed so two Lv8 cats fit side by side in the 720-wide canvas — don't scale it back up without checking that constraint).

## Architecture

All gameplay code lives in `assets/Scripts/` (5 files). Components are wired together via editor-assigned `@property` references on nodes in `assets/scene.scene`, with runtime `find("Canvas/...")` fallbacks in `GameManager.setupUI()`.

- **GameManager.ts** — singleton (`GameManager.instance`). Owns game state (`isGameOver`, score, combo), enables `PhysicsSystem2D` (gravity −960), spawns the merged next-level cat from `catPrefabs[]`, persists high score to `localStorage` (`highestScore_Cat`) and uploads it to WeChat cloud KV (`wx.setUserCloudStorage`, key `score`).
- **Spawner.ts** — handles touch/mouse input. The held cat is a **Static** rigid body with its collider disabled, lerp-following the pointer X (clamped ±320 on a 720-design-width canvas); on release it becomes Dynamic, collider enabled, with a 0.4s cooldown before the next cat appears. New cats are added to `Canvas/CatContainer`.
- **Cat.ts** — per-prefab merge logic via `BEGIN_CONTACT`. Same-level collisions resolve once by comparing entity-root `uuid`s (the lower uuid runs the merge). Each prefab is one of `assets/Prefabs/Cat_Lv1..Lv10`.
- **Deadline.ts** — lose-condition line. A cat must sit *stable* (vertical velocity near 0) above the line for `limitTime` (2s) to trigger game over; fast-falling cats passing through don't count. Drives the flashing warning / solid-red effects.
- **WeChatRank.ts** — main-domain side of the leaderboard. Shows `rankPanel` (contains a `SubContextView`) and posts `{command: 'showFriendRank'}` to the open data context.
- **build-templates/wechatgame/openDataContext/index.js** — the open data context (子域) renderer. Fetches friend scores via `wx.getFriendCloudStorage({keyList: ['score']})`, sorts, and renders to the shared canvas. This folder is copied into the build by Cocos build templates — edit it here, not in `build/`.

All `wx.*` calls are guarded with `typeof wx !== 'undefined'` so the game stays runnable in the editor/browser preview.

## Critical Constraints (hard-won fixes — do not regress)

- **Never mutate physics state inside `onBeginContact`**: no changing `node.active`, `scale` for re-activation purposes, or `RigidBody2D.enabled` during the Box2D step — it throws `Can not active RigidBody` / `is not a function` errors. The established merge pattern in `Cat._startMergeSequence` is: synchronously `setScale(0)` + `setWorldPosition(9999, 9999)` to hide the pair, then `scheduleOnce(..., 0)` to destroy the nodes and spawn the next-level cat on the following frame.
- **Re-check `GameManager.instance.isGameOver` inside deferred callbacks** before spawning merged cats — merges queued before game over must not resolve after it.
- **UI sibling-index competition**: `GameOverPanel` force-tops itself via `setSiblingIndex` when shown, so anything that must appear above it (the rank panel in `WeChatRank.showFriendRank`, the combo label) must also call `setSiblingIndex` to the top when displayed — otherwise it renders behind the panel and clicks appear dead.
- **Merge uniqueness**: a two-cat collision fires callbacks on both sides; only the side whose entity-root `uuid` is lower runs the merge. Entity root = the prefab-instance node found by walking up to `Canvas`/`CatContainer`.

## Editor-Side Setup Expectations

Some behavior depends on scene nodes configured by hand in the editor:
- `Canvas/StartPanel` must exist and be assigned to `GameManager.startPanel`; its button calls `GameManager.startGame()` (the game boots in a "waiting to start" state and the Spawner ignores input until then).
- `GameManager.setupUI()` auto-configures `Canvas/RankPanel/CloseButton` (sets text "关闭", repositions it, wires `hideFriendRank`) at runtime if its click events are empty.
