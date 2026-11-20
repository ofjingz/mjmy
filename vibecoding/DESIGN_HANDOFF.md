# vibecoding 展区 · 视觉交接说明（DESIGN HANDOFF）

本页为「线框级正确」参考实现，目标不是「美」，而是**干净、规范、可被另一个 AI 快速换皮**。
功能与结构已稳定，视觉可在下述边界内整份替换。

---

## 1. HTML 结构树（语义 / class / id / data 钩子）

```
body[data-module="vibecoding"]
├─ header.exhibit-header
│  └─ .header-inner
│     ├─ .header-meta                     → span ×2：NO. 05 / 物与手作
│     └─ .header-title-row
│        ├─ .title-group
│        │  ├─ h1.exhibit-title
│        │  └─ p.exhibit-lead
│        └─ img.header-motif (glasses-outline.png, aria-hidden)
│
├─ main.exhibit-main
│  ├─ .cards-grid#cards-grid               → 由 app.js 渲染
│  │  └─ article.c-card ×3（每件一条）
│  │     ├─ figure.c-shot-wrap
│  │     │  ├─ button.c-shot[data-photo][data-item]   → img.c-shot-img
│  │     │  └─ .c-thumbs
│  │     │     └─ button.c-thumb[data-thumb]           → img（多图时）
│  │     ├─ .c-info
│  │     │  ├─ p.c-type
│  │     │  ├─ h3.c-title
│  │     │  ├─ p.c-author
│  │     │  └─ p.c-desc
│  │     └─ .c-foot
│  │        ├─ button.c-qr[data-qr]  → 内嵌 SVG 二维码（仅 url 条目）
│  │        ├─ p.c-qr-hint
│  │        └─ .c-actions
│  │           ├─ a.c-btn.c-btn--primary（打开）或 button.c-btn--primary（复制口令）
│  │           ├─ button.c-btn.c-btn--secondary[data-copy]（复制链接，仅 url 条目）
│  │           └─ p.c-copy-tip（仅小程序条目）
│  └─ noscript > p.noscript-note
│
├─ .lightbox#lightbox[role=dialog][aria-modal] (hidden)
│  ├─ .lightbox-backdrop[data-lb-close]
│  └─ .lightbox-frame
│     ├─ button.lightbox-close[data-lb-close]
│     └─ figure.lightbox-figure
│        ├─ .lightbox-media#lb-media        → img 或 .lb-qr-box>svg
│        └─ figcaption.lightbox-caption#lb-caption
│
├─ .copy-dialog#copy-dialog[role=dialog][aria-modal] (hidden)
│  ├─ .copy-dialog-backdrop[data-cd-close]
│  └─ .copy-dialog-frame
│     ├─ button.copy-dialog-close[data-cd-close]
│     ├─ h2.copy-dialog-title
│     ├─ p.copy-dialog-hint
│     ├─ input.copy-dialog-input#copy-dialog-input[readonly]
│     └─ button.c-btn.c-btn--primary.copy-dialog-done[data-cd-close]
│
├─ .toast#toast[role=status][aria-live=polite] (hidden)
└─ <script> 顺序固定：/shared/routes.js → /shared/footprint.js → /shared/shell.js
             → /shared/qrcode.js → ./app.js
```

---

## 2. CSS 变量清单（style.css 的 :root）

| 变量 | 用途 | 当前值 |
| --- | --- | --- |
| `--bg-0` | 背景最深色 | `#0D0D0F` |
| `--bg-1` | 背景亮端（body 渐变上端） | `#1B2028` |
| `--surface` | 卡片 / 弹层 / toast 单一浅表面色 | `#141821` |
| `--ink` | 主文字 | `#F2EFE9` |
| `--ink-2` | 次文字 | `#A39E93` |
| `--ink-3` | 弱文字 | `#6E6B64` |
| `--accent` | 强调色：仅主按钮 + focus 焦点环 | `#D4A359` |
| `--qr-fg` | 二维码前景（扫码对比度） | `#161618` |
| `--qr-bg` | 二维码底色（扫码对比度，勿改） | `#ffffff` |
| `--fs-title` | 页面主标题 | `clamp(32px, 6vw, 48px)` |
| `--fs-label` | 卡片标题 / 弹层标题 | `18px` |
| `--fs-body` | 正文 / 描述 / 按钮 | `16px` |
| `--fs-caption` | 类型 / 作者 / 图注 / 提示 | `13px` |
| `--lh-title` | 标题行高 | `1.25` |
| `--lh-label` | 标签行高 | `1.4` |
| `--lh-body` | 正文行高 | `1.7` |
| `--lh-caption` | 图注行高 | `1.5` |
| `--sp-1`…`--sp-5` | 8px 间距节奏 | `8 / 16 / 24 / 32 / 40px` |
| `--radius-lg` | 卡片 / 弹层圆角 | `16px` |
| `--radius-md` | 按钮 / 银幕 / 二维码圆角 | `10px` |
| `--radius-sm` | 缩略图圆角 | `8px` |
| `--font-sans` | 正文黑体栈（标题同用，暂替 I 字体） | 见 style.css |
| `--font-mono` | 等宽（口令输入框） | 见 style.css |

> 注意：app.js 内还有一张 `IMAGE_SIZES` 尺寸表（图片固有宽高，仅供输出
> `width`/`height` 属性防 CLS）。**素材更换时需同步这张表**，它不是视觉样式，
> 但属于 app.js 里唯一与内容相关、需要随素材维护的数据。

---

## 3. 可改边界（换皮时可自由改动）

- `style.css` **全部**：变量值、字阶、行高、间距、圆角、断点、任意视觉层。
- `index.html` 可新增 class / 装饰层（如背景图案容器、wrapper、渐变遮罩）、可改文案。
- 可替换 `header-motif` 图片或整段 header 视觉（保留语义与 class 名即可）。
- 可新增外部图片 / 图标 / 背景素材（仅限 `/shared/motifs/` 已提取资产，勿拷桌面原稿进 site/）。
- 交互状态一律用 class（如 `is-active`），可新增 class 但**不得改现有 data-* 钩子的含义**。

## 4. 不可改边界（换皮时禁止触碰）

- **`data.json` 字段与内容**：`items[].{id,author,name,type,url,copyText,openable,description,images}`；页面条目内容唯一来源，不得硬编码进 HTML/JS。
- **app.js 的行为与事件**：data.json 拉取与渲染、`data-thumb` 图片切换、`data-photo` 预览、`data-qr` 二维码放大、`data-copy` 复制、三级复制兜底（clipboard → execCommand → 手动长按）、lightbox 开合 / Escape、toast 反馈。
- **HTML 的 id**：`cards-grid` / `lightbox` / `lb-media` / `lb-caption` / `copy-dialog` / `copy-dialog-input` / `toast`。
- **HTML 的关键 class 与 data 钩子**：`data-module="vibecoding"`、`data-photo`、`data-item`、`data-qr`、`data-copy`、`data-thumb`、`data-lb-close`、`data-cd-close`。
- **共享底座接线**：`/shared/routes.js`、`/shared/footprint.js`、`/shared/shell.css`、`/shared/shell.js`、`/shared/qrcode.js` 的引入与顺序。
- **复制 / 二维码功能语义**：二维码白底（`--qr-bg` 不可改色相，只可调前景深浅）、口令原文 `#小程序：//GOMOVIE/…`、小程序条目无二维码。
- **`app.js` 不写内联颜色 / 视觉样式**：所有颜色走 CSS 变量（二维码前景/底色经 `cssVar('--qr-fg'/'--qr-bg')` 读取）。

---

## 5. 字体规范

标题暂用黑体栈（`--font-sans`）替代，待「I 歪歪扭扭 · 随性玩世」手写字体文件落定后替换。
不使用宋体 / 衬线 / 伪手写变换。正文与标题均用黑体栈，层级靠字号 + 字重区分。
