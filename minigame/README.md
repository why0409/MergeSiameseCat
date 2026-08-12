# 合成大暹罗 · 原生微信小游戏

**不依赖 Cocos Creator。** 纯 Canvas 2D + 自研圆盘物理 + 微信小游戏 API。

## 目录结构

```
minigame/
  game.js                 # 微信入口
  game.json
  project.config.json
  index.html              # 浏览器预览页
  js/
    main.js               # 启动 / 主循环 / 输入
    config.js             # 数值与色板
    game.js               # 状态机 / 合成 / 死线
    physics.js            # 轻量圆物理
    renderer.js           # 绘制与 UI 命中
    assets.js             # 猫图加载
    storage.js            # 本地分 + 云存储
  images/cats/            # cat_1.jpeg … cat_10.jpeg
  openDataContext/        # 好友排行榜子域
  tools/
    build-browser-bundle.js
    preview-server.js
```

## 运行方式

### A. 浏览器本地预览（无需微信 / Cocos）

```bash
cd minigame
node tools/preview-server.js
# 打开 http://127.0.0.1:7456/
```

### B. 微信开发者工具

1. 打开微信开发者工具 → 小游戏  
2. 导入目录：选择本仓库下的 **`minigame`**（不是仓库根）  
3. AppID 可用测试号；排行榜需真实 AppID + 开放数据域权限  
4. 编译运行  

### C. 与旧 Cocos 工程关系

| 路径 | 说明 |
|------|------|
| 仓库根（含 `assets/`） | 原 Cocos 3.8.5 工程，可继续用编辑器维护 |
| `minigame/` | **推荐的原生版**，独立构建与发布 |

玩法数值与色板对齐 `js/config.js`（半径、得分表、危险线时间等）。

## 操作

- **开始游戏** → 拖动顶部猫左右 → 松手落下  
- 相同等级碰撞合成下一级（最高 10）  
- 堆过危险线并停稳约 2 秒 → 结算  
- 本地 `highestScore_Cat`；破纪录在结束/切后台时写微信云 `score`  

## 技术说明

- 物理：自研圆-圆 / 墙碰撞，无 Matter.js  
- 渲染：`canvas.getContext('2d')`  
- 适配：设计分辨率 720×1280，屏幕 contain 居中  
- 子域：`openDataContext/index.js` 纯 Canvas 绘制好友榜（可滚动）  

## 发布检查

- [ ] 替换 `project.config.json` 里的 `appid`  
- [ ] 真机验证震动 / 云存储 / 好友榜  
- [ ] 确认 `images/cats` 十张图完整  
