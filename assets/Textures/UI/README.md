# Siamese UI Assets

Optional decorative sprites for 《合成大暹罗》. Runtime theme (`SiameseUITheme.ts`) already styles the game with Graphics + color tints and does **not** require these files.

| File | Use |
|------|-----|
| `ui_title_cat.png` | Start panel / branding mascot |
| `ui_panel.png` | Dialog / card 9-slice candidate |
| `ui_btn_primary.png` | Primary CTA normal |
| `ui_btn_pressed.png` | Primary CTA pressed |
| `ui_btn_secondary.png` | Secondary (rank) button |

### Apply in Cocos Editor (optional)

1. Open the project so assets import.
2. Select button nodes → Sprite → assign `ui_btn_*` SpriteFrames; Button transition = SPRITE or COLOR.
3. Start panel title area → add Sprite with `ui_title_cat`.
4. For panels, set Sprite type to **Sliced** and adjust border insets after inspecting edge thickness.

Palette remains defined in `assets/Scripts/GameConfig.ts` → `theme`.
