# same（SAME 展区）· DESIGN_HANDOFF.md

> 交接对象：Gemini（或其他视觉工序）。本文件是「框架 → 视觉」的交接契约。
> 补充总纲见 `/Users/jing/Documents/ChatGPT/迷影展/_tasks/视觉交接规范-给Gemini.md`。
> 交付状态：v4 框架优先 —— 干净框架 + 完整功能，视觉只做到「设计线框级正确」。

## 1. 页面职责与数据流

- 页面：`site/same/index.html` + `style.css` + `app.js`
- 唯一数据源：`site/same/data.json`（`title / subtitle / author / promoVideo / photos`）
- 渲染：全部由 `app.js` 在客户端 `fetch('./data.json')` 后渲染；**不在 HTML / JS 里硬编码内容**。
- 例外（结构标识，非内容）：页眉 `NO. 09 · 银幕背后`、画廊章节标题「胶片放映档案」、
  页脚署名「same · kai · 幕间漫游线上迷影展 09 号展厅」为固定结构文案；「30 张」等计数由 `photos.length` 计算。
- 图片固有尺寸表 `IMAGE_SIZES`（`app.js` 顶部）仅用于 `<img width/height>` 防布局跳动，属素材元数据，素材更换时同步。

## 2. HTML 结构树（含 JS 依赖的 id / class，不可改）

```
body[data-module="same"]
├─ header.exhibit-header
│  └─ .header-inner
│     ├─ .header-meta  (NO. 09 · 银幕背后)
│     └─ .header-title-row
│        ├─ .title-group
│        │  ├─ h1.exhibit-title#exhibit-title      ← JS 写入 data.title
│        │  ├─ p.exhibit-lead#exhibit-lead        ← JS 写入 data.subtitle
│        │  └─ p.exhibit-author#exhibit-author    ← JS 写入 data.author
│        └─ img.header-motif  (/shared/motifs/eyes-outline.png)
├─ main.exhibit-main
│  ├─ section.promo-hero#promo-hero
│  │  └─ .promo-inner#promo-inner                  ← JS 渲染（平台/标题/按钮/二维码/复制）
│  └─ section.gallery#gallery
│     ├─ .film-edge (装饰，可改/可删)
│     ├─ header.section-head
│     │  ├─ h2.section-title#gallery-title
│     │  └─ p.section-count#gallery-count          ← JS 写入照片张数
│     ├─ .gallery-grid#gallery-grid                ← JS 渲染 30 个 .g-card
│     └─ .film-edge (装饰，可改/可删)
├─ footer.exhibit-footer
├─ noscript > p.noscript-note
├─ .lightbox#lightbox (role=dialog)
│  ├─ .lightbox-backdrop[data-lb-close]
│  └─ .lightbox-frame
│     ├─ button.lightbox-close[data-lb-close]
│     ├─ button.lightbox-nav.lightbox-prev#lb-prev
│     ├─ figure.lightbox-figure
│     │  ├─ .lightbox-media#lb-media               ← JS 写入 <img> 或 .lb-qr-box
│     │  └─ figcaption.lightbox-caption#lb-caption
│     └─ button.lightbox-nav.lightbox-next#lb-next
├─ .copy-dialog#copy-dialog (role=dialog)
│  ├─ .copy-dialog-backdrop[data-cd-close]
│  └─ .copy-dialog-frame
│     ├─ button.copy-dialog-close[data-cd-close]
│     ├─ h2.copy-dialog-title
│     ├─ p.copy-dialog-hint
│     ├─ input.copy-dialog-input#copy-dialog-input
│     └─ button.c-btn.c-btn--primary.copy-dialog-done[data-cd-close]
└─ .toast#toast (role=status, aria-live=polite)

脚本序（不可改）：/shared/routes.js → /shared/footprint.js → /shared/shell.js → /shared/qrcode.js → ./app.js
```

### JS 渲染出的动态结构（依赖的 data 属性 / class，不可改）

- Hero：
  - `.promo-platform`（平台小字，来自 `promoVideo.platform`）
  - `h2.promo-title#promo-title`（`promoVideo.title`）
  - `.promo-actions` 内 `a.c-btn.c-btn--primary`（`href=promoVideo.url`, `target=_blank`, `rel=noopener noreferrer`）
  - `button.c-btn.c-btn--secondary[data-copy]`（复制链接）
  - `.promo-qr` 内 `button.c-qr[data-qr]`（内含 `window.MujianQR.toSVG` 生成的 SVG）+ `p.c-qr-hint`
- 画廊每个条目：
  - `figure.g-card`
  - `button.g-shot[data-photo="<i>"]` → `img.g-shot-img`（`alt=caption`, `loading=lazy`，首 3 张 `eager`）
  - `figcaption.g-caption`（`caption` 原文）

## 3. CSS 变量清单（:root）

| 变量 | 值 | 语义 | 可改 |
|---|---|---|---|
| `--bg-0` | `#0D0D0F` | 蓝黑最深处（页面底） | 可（保持午夜放映令牌语义） |
| `--bg-1` | `#1B2028` | 午夜蓝黑亮端（渐变顶） | 可 |
| `--bg-card` | `#141821` | 卡片表面 | 可 |
| `--screen-warm` | `#F2EFE9` | 暖白 · 主文字 / 标题 | 可 |
| `--amber` | `#D4A359` | 琥珀金 · 仅主按钮 / focus 环 / toast | 可（但用途边界不可扩展） |
| `--ink-muted` | `#A39E93` | 次级文字 | 可 |
| `--ink-subtle` | `#6E6B64` | 弱文字 | 可 |
| `--qr-fg` | `#161618` | 二维码前景（JS 读取） | 可 |
| `--qr-bg` | `#ffffff` | 二维码底色（JS 读取） | 可 |
| `--font-sans` | 黑体栈 | 正文 / 标题 | 可（按 FONT_GUIDELINES.md） |
| `--font-mono` | 等宽栈 | 复制输入框 | 可 |

字阶四级（当前值，可微调）：
1. 页眉主标题 `h1.exhibit-title`：`clamp(40px, 7vw, 64px)`，600
2. 章节 / Hero 标题 `h2.promo-title` / `.section-title`：`clamp(24px, ~3vw, 30~32px)`，600
3. 正文 / 卡片标题 / 按钮：`14–16px`
4. 图注 / 次要：`13px`

## 4. 可改 / 不可改边界

**可改（Gemini）**：
- `style.css` 全部内容（颜色、字号、间距、圆角、阴影、装饰、布局微调）。
- `.film-edge` 齿孔纹理可重做 / 删除。
- HTML 中新增纯装饰性元素 / class（不得改动现有 id 与 JS 依赖的 class / data 属性）。
- CSS 变量新增与重定义（保留语义；`--amber` 用途不得扩散到主按钮与 focus 环之外）。

**不可改**：
- `data.json` 字段结构与内容（署名、caption、链接、图片路径）。
- `app.js` 行为契约：`fetch('./data.json')` 渲染、复制三级兜底、二维码生成与点击放大、
  lightbox（点开 / 左右翻看 / Esc 关闭 / 焦点返回）、toast、`data-photo` / `data-copy` / `data-qr` 委托。
- 共享底座：`/shared/routes.js`、`/shared/footprint.js`、`/shared/shell.js`、`/shared/shell.css`、`/shared/qrcode.js`（问题报修，不直接改）。
- `functions/` 后端（归 Codex）。
- 图片自适应底线（见 §5）。

## 5. 图片自适应底线（不可破）

- 所有照片 `max-width:100%; width:100%; height:auto; object-fit:contain`（不裁切）。
- `<img>` 带 `width/height` 属性（来自 `IMAGE_SIZES`）防布局跳动。
- `loading="lazy"`（首 3 张 `eager`）、`decoding="async"`。
- 画廊网格用「自然高度」（每张按自身比例，网格 `align-items:start`），非固定 `aspect-ratio` 盒。
- lightbox 大图 `max-width:min(840px,84vw); max-height:76vh; width:auto; height:auto`（百分比自适应）。
- 二维码 `width/height: clamp(96px, 16vw, 132px)`；放大态 `min(260px, 68vw)`。
- 视觉工序不得把画廊图片塞进固定尺寸盒后用 `cover` 裁切。

## 6. 交互契约

- 「观看短片」：新窗口打开 `promoVideo.url`，`rel="noopener noreferrer"`。
- 「复制链接」：`navigator.clipboard.writeText` → `execCommand('copy')` → 手动复制弹窗，成功 `showToast('已复制宣传片链接')`。
- 二维码：点击在 lightbox 中放大（白底 SVG）。
- 画廊：点击 `.g-shot` 打开 lightbox；`‹ / ›` 或 `← / →` 翻看；`Esc` / 遮罩 / 关闭按钮关闭；关闭后焦点返回触发元素。
- `prefers-reduced-motion: reduce` 下所有动画 / 过渡静止。
- 键盘可达：按钮 / 卡片 / 关闭均 `:focus-visible` 琥珀焦点环。

## 7. 与 vibecoding 参考实现的一致性

- 同用午夜放映色温令牌、黑体栈、文字三级、`--amber` 用途边界。
- 复用其三级复制兜底、`window.MujianQR.toSVG` 二维码、lightbox / toast / 手动复制弹窗实现方式。
- 差异：画廊 30 张，lightbox 增加左右翻看（‹ › + 方向键）；Hero 为单条宣传片（非多卡片）。
- 页眉 motif 由 `glasses-outline.png` 换为 `eyes-outline.png`（数据身份，非视觉）。
