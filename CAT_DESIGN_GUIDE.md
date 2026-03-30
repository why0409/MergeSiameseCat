# 《合成大暹罗》视觉设计与素材规格指南

本文档旨在为 1-10 等级的暹罗猫提供一套连贯、高品质的视觉进化方案。

## 一、 核心技术规格 (Technical Standards)

为了确保在 Cocos Creator 中完美适配物理碰撞体且不产生变形，所有素材必须遵循以下标准：

| 参数 | 要求 | 说明 |
| :--- | :--- | :--- |
| **画布比例** | **1:1 (正方形)** | 必须严格遵守，防止在 UI 中被拉伸或挤压。 |
| **分辨率** | **1024 x 1024 px** | 确保在高等级（大尺寸）下依然清晰，JPEG 格式。 |
| **背景** | **纯白或透明** | 建议使用白背景，配合 Prefab 中的 `cc.Mask` 组件实现圆形裁剪。 |
| **构图** | **居中构图 (Center)** | 猫咪主体位于画面中心，四周预留约 10% 的安全边距，避免被圆形遮罩裁掉耳朵。 |
| **艺术风格** | **3D 风格化渲染** | 统一采用类皮克斯 (Pixar-style) 的 3D 卡通渲染，色调明快。 |

---

## 二、 10 个等级视觉进化方案 (Evolution Path)

| 等级 | 物理半径 | 视觉主题 | 核心特征描述 |
| :--- | :--- | :--- | :--- |
| **Lv1** | 30 | **初生萌芽** | 极小的圆滚滚暹罗奶猫，大脑袋，水汪汪的蓝眼睛。 |
| **Lv2** | 50 | **好奇探索** | 学步阶段的幼崽，歪头杀，爪子张开，充满好奇。 |
| **Lv3** | 70 | **活泼少年** | 佩戴明黄色小铃铛项圈，深色重点色（黑脸）开始清晰。 |
| **Lv4** | 90 | **优雅少年** | 体型开始修长，黑耳朵、黑尾巴特征明显。 |
| **Lv5** | 110 | **精致淑女/绅士** | 佩戴精美的丝绸蝴蝶结项圈。 |
| **Lv6** | 140 | **威严成猫** | 站姿挺拔，眼神自信，佩戴银色金属项圈。 |
| **Lv7** | 170 | **贵族暹罗** | 佩戴金边项圈，可能带有小蓝宝石，气质高贵。 |
| **Lv8** | 200 | **皇家统领** | 佩戴精致的水晶小皇冠，神情优雅睿智。 |
| **Lv9** | 240 | **圣殿守卫** | 散发淡淡的蓝色幽光，佩戴红宝石镶嵌的重型项圈。 |
| **Lv10** | 300 | **至尊猫神** | 漂浮状态，头顶金色神圣光环，毛发带有星空暗纹，压迫感十足。 |

---

## 三、 生图提示词列表 (AI Prompts)

**通用前缀 (Suffix):**
`1:1 Square aspect ratio, Siamese Cat, [等级描述], 3D stylized render, Pixar-like animation style, soft studio lighting, clean white background, vibrant colors, game sprite design, high quality, JPEG.`

### 详细提示词建议：
*   **Lv1:** `Tiny ball-shaped Siamese kitten, huge watery blue eyes, palm-sized, extremely fluffy.`
*   **Lv2:** `Curious toddler Siamese kitten, head-tilting, playing with paws.`
*   **Lv3:** `Playful young Siamese cat, wearing a small yellow bell collar.`
*   **Lv4:** `Sleek teenager Siamese cat, distinct dark facial mask, elegant pose.`
*   **Lv5:** `Elegant young adult Siamese cat, wearing a silk ribbon bow.`
*   **Lv6:** `Majestic adult Siamese cat, standing tall, wearing a silver collar.`
*   **Lv7:** `Noble Siamese cat, gold trim collar with a blue sapphire.`
*   **Lv8:** `Royal Siamese cat, wearing a small crystal tiara, sophisticated gaze.`
*   **Lv9:** `Imperial Siamese cat, glowing blue aura, ruby encrusted heavy collar.`
*   **Lv10:** `Celestial Cat Deity, floating, wearing an ancient golden crown, starry patterns in dark fur parts.`

---

## 四、 资源替换步骤

1.  **生成图片**：使用以上提示词在 Midjourney 或 DALL-E 3 生成图片。
2.  **重命名**：将生成的图片依次命名为 `cat_1.jpeg` 至 `cat_10.jpeg`。
3.  **覆盖资源**：将文件放入 `assets/Textures/` 文件夹下。
4.  **Cocos 导入**：回到 Cocos Creator，编辑器会自动刷新。由于我们采用了 1:1 比例，原本被拉伸的现象将自动消失。

---
*Created by Gemini CLI - 2026-03-26*
