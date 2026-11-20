# DESIGN_HANDOFF · 主大厅 hub（site/hub/）

> 给视觉工序（Gemini）的交接契约。本页由 DeepSeek A 线交付「框架 + 功能 + 数据接线 + 自适应」，**不追求最终美观**；视觉统一与美化在后续 Gemini 工序完成。
> 关联规范：根目录 `FONT_GUIDELINES.md`、`_tasks/视觉交接规范-给Gemini.md`、`_tasks/A-主大厅-hub-任务书.md`。

> **2026-11-20 开场接入更新**：按用户要求恢复 `mujian-opening/` 的黑白轮廓、专属动作、慢速显影与手机随机播放。新增 `opening.css`，调整 `index.html`、`hub.js`，删除 `style.css` 中旧的重写版开场样式；大厅、目录、票根视觉未改。标题沿用根规范 v2 的龙藏。`/hub/#opening` 可强制重看；首次 `/hub/` 播开场，`#hall/#catalog/#ticket` 仍直达。完成进入时派发 `mujian:entered`。检查记录见 `qa/opening-check.md`；以下初版交付记录保留为历史。

> **2026-11-20 散场票根本地接入**。大厅的「票根」和「结束漫游」共用 `index.html`、`ticket.css` 和 `ticket.js` 中的新版出纸弹窗。`/hub/#ticket` 可直达预览，「结束漫游」提供打印中可用的「直接离开」。两款票根复用共享龙藏、苹方、展区素材和原有足迹接口，导出宽 800 像素、按内容定高的 PNG。票根相关的旧 3:4 版式、二维码和控件说明为历史记录。本次接入限于本地主大厅，未发布。

> **票根版式与昵称更新**。票面包含展区名、上下锯齿、半圆缺口和副券撕线。PNG 导出带配色底板。朱红和钴蓝参考横版主视觉原色。`ticket-art/` 的鱼和箭头取自横版海报 AI 的 `components.svg` 路径，深色款票头纹饰复用 `1031尝试(1).pdf` 提取的 `ornament`。留言板提交后将本人昵称写入共享足迹，票根手动昵称优先，清空后恢复留言昵称。本地旧演示留言有昵称回填，旧线上留言没有可对应到本机的昵称记录。

> **票根展区图标更新**。票根印章和首页漫游共用 `preview-assets/obj-*.png` 里的展区图标。票根使用原图的轮廓和明暗做双色印刷处理。两款 PNG 导出统一使用浅蓝灰底板。

> **票根精修**。缩小龙藏主标题并留出顶部空白。首页展区图标共用印章尺寸、光影处理与按展区固定的配色顺序。右版采用砖红票头和贯穿票身的钴蓝，副券以一条砖红撕线、小鱼标和网址收尾。

---

## 1. 交付文件

| 文件 | 状态 | 说明 |
|---|---|---|
| `index.html` | 新建 | 主大厅结构页（36 个契约 id 全量齐备） |
| `style.css` | 新建 | 框架优先视觉层（房间色温令牌 + 基础可读样式） |
| `ticket.js` | 修改 | 仅 `SERIF_FONT`（L30）由宋体栈改为黑体栈；其余逻辑未动 |
| `DESIGN_HANDOFF.md` | 新建 | 本文件 |

未改动：`hub.js`、`atmosphere.js`、`site/shared/*`、其他任何目录。

---

## 2. HTML 结构树（契约层级）

```
<body data-module="hub">
└─ #hub-root
   ├─ .hub-backdrop            ← 装饰性新增（房间色温背景层 z0）
   ├─ #atmosphere <canvas>     ← atmosphere.js 挂载（fixed 全屏 z1）
   ├─ #opening (房间1·序幕)
   │   ├─ #opening-objects     ← 29 个 .artifact 由 hub.js 注入
   │   ├─ .title-block > h1.main-title > button#enter（四字显影）
   │   └─ button#skip（右下角「跳过」）
   ├─ .opening-curtain-left / .opening-curtain-right（原版幕布）
   ├─ #hall (hidden 初始)
   │   ├─ header.hall-topbar
   │   │   ├─ button#brand-home-btn
   │   │   ├─ .mode-toggle
   │   │   │   ├─ button#mode-roam-btn (is-active)
   │   │   │   └─ button#mode-catalog-btn
   │   │   └─ .topbar-actions
   │   │       ├─ span#lit-count-badge
   │   │       ├─ button#shuffle-btn
   │   │       ├─ button#replay-btn
   │   │       └─ button#ticket-open-btn
   │   └─ main.hall-main
   │       ├─ section#roam-view → div#roam-stage    ← .roam-node 由 hub.js 注入
   │       └─ section#catalog-view (hidden 初始)
   │           ├─ .catalog-head
   │           │   ├─ .catalog-head-text
   │           │   │   ├─ h2.catalog-head-title
   │           │   │   └─ p#catalog-lit-text
   │           │   ├─ .catalog-progress → div#catalog-progress-fill
   │           │   └─ button#catalog-ticket-btn
   │           └─ div#catalog-groups                  ← .catalog-category 由 hub.js 注入
   ├─ nav.hub-nav
   │   ├─ a#nav-note
   │   ├─ a#nav-info
   │   └─ a#nav-thanks
   ├─ div#announcement (sr-only / role=status / aria-live=polite)
   └─ #ticket-modal (role=dialog aria-modal hidden 初始)
       └─ .ticket-frame
           ├─ header.ticket-head → h2#ticket-title + button#ticket-close-btn
           └─ .ticket-body
               ├─ .ticket-preview → img#ticket-preview-img (1200×1600)
               └─ .ticket-controls
                   ├─ label + input#ticket-nickname
                   ├─ .theme-toggle → button[data-ticket-theme=dark] + button[data-ticket-theme=paper]
                   ├─ button#ticket-generate-btn + button#ticket-download-btn
                   ├─ .ticket-summary → #ticket-summary-lit / -mods / -cinemas / -time
                   └─ p#ticket-status
```

脚本序（body 底部，顺序不可改）：
`/shared/routes.js → /shared/footprint.js → /shared/qrcode.js → ./atmosphere.js → ./ticket.js → ./hub.js`

> 说明：hub 由 `shell.js` 依 `data-module="hub"` 自动跳过点亮与返回浮条，故**不引入 `shell.js`**；`shell.css` 仅为全站一致性引入（hub 上不产生任何可见浮条）。

---

## 3. CSS 变量清单（`style.css`）

### 3.1 全局（`:root`）
| 变量 | 值 | 用途 |
|---|---|---|
| `--font-sans` | `-apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif` | 正文/标题黑体栈 |
| `--font-mono` | `ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, monospace` | 数字/编号/等宽 |

### 3.2 房间色温令牌（定义在 `#hub-root`，随状态类切换）
| 房间 | 触发类 | `--bg` | `--bg-2` | `--fg` | `--fg-muted` | `--fg-subtle` | `--accent` | `--accent-contrast` | `--surface` | `--surface-strong` |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 序幕（默认） | 无/`is-opening-phase` | `#080809` | `#080809` | `#E9E7E2` | 白 72% | 白 46% | `#E9E7E2` | `#080809` | 白 7% | `#17171a` |
| 2 漫游 | `.is-entered:not(.is-catalog-mode)` | `#0D0D0F` | `#1B2028` | `#F2EFE9` | `#A39E93` | `#6E6B64` | `#D4A359` | `#14120D` | 蓝黑 72% | `#171a21` |
| 3 目录（提案） | `.is-entered.is-catalog-mode` | `#EFE4D2` | `#F4F1E9` | `#161616` | 黑 72% | 黑 50% | `#B8402F` | `#F4F1E9` | 白 62% | `#FFFFFF` |

背景渲染：`.hub-backdrop { background: linear-gradient(180deg, var(--bg-2), var(--bg)); }`（z0，位于画布之下）。
分层：`.hub-backdrop`(z0) < `#atmosphere`(z1, canvas) < 内容(#opening/#hall/.hub-nav, z2) < `#ticket-modal`(z9800)。

### 3.3 JS 写入、CSS 消费的自定义属性（不可改语义，可调样式）
- 开屏 `.artifact`：`--x --y --size`（桌面位置/宽度）、`--mx --my --ms`（移动端）、`--ratio`（宽高比）、`--opacity`（outline 基础不透明度）、`--delay`（入场）、`--exposure`（显影，0~1，由 atmosphere 光照与 `.is-active` 驱动）
- 根容器视差：`--parallax-x --parallax-y`（hub.js 写在 `#hub-root`，供 `.artifact` 位移）
- 漫游 `.roam-node`：`--exposure`（光标显影）；`--drift-dur --drift-phase --stagger`（hub.js 写入，框架版暂未做漂浮动效，可留给视觉工序）

---

## 4. 可改 / 不可改边界

### 4.1 不可改（破坏即功能失效）
- **全部 36 个契约 id**（见下表），及其元素语义（canvas/button/a/div/span/input/img）。
- **body `data-module="hub"`**（shell.js 靠它跳过点亮与返回浮条）。
- **脚本序** 与共享 4+1 文件（`routes/footprint/shell.js/shell.css` + `qrcode.js`）的 API。
- **hub.js / ticket.js / atmosphere.js 依赖的 class 与事件**：`is-opening-phase is-entered is-transitioning is-title-visible is-catalog-mode is-ready is-reduced is-background`、`body.is-ticket-open`、`#ticket-modal.is-open`、`roam-node/catalog-card.is-lit`、`#roam-stage.is-shuffling`、`artifact.is-active`、`img.asset-failed`、`ticket-status.is-flash`、`[data-ticket-theme].is-active`。
- **票根双主题语义**：`button[data-ticket-theme]` 的值必须是 `dark` / `paper`（ticket.js 按该值渲染两种画布配色并切换 `aria-pressed`/`.is-active`）。CSS 不得改写其 `data-ticket-theme` 值，只能美化按钮外观。
- **JS 动态注入的 class 名**（结构契约，样式可改、名字不可改）：开屏 `artifact artifact-button gesture outline grain`；漫游 `roam-node roam-art roam-aura roam-img roam-outline roam-img roam-grain roam-caption roam-title-row roam-lit-dot roam-title roam-lit-tag roam-contrib roam-tagline`；目录 `catalog-category catalog-cat-head catalog-cat-num catalog-cat-titles catalog-list catalog-card catalog-thumb thumb-outline thumb-grain catalog-body catalog-top-row catalog-title catalog-contrib catalog-lit-pill catalog-tagline catalog-arrow`。
- **数据来源**：模块与分类来自 `routes.js`（`getEnabledModules()` / `CATEGORIES`），足迹来自 `footprint.js`——不可改字段。

### 4.2 可改（视觉工序的自由区）
- `style.css` 全部内容：颜色、字体大小/字重、间距、圆角、表面渐变、动效、装饰。
- 新增纯装饰元素/class（保持现有 id 与 JS 用到的 class 不变）。
- 重新定义/新增 CSS 变量（保留既有变量名语义）。
- `.hub-backdrop`、`.sr-only`、`.noscript-note` 等自用辅助类可整体替换视觉实现。
- 序幕按原版保持黑白轮廓、微光、标题和跳过；首页的 3D 图形仍待另行设计。

### 4.3 36 个契约 id 全表
**hub.js（25）**：`hub-root` `atmosphere` `opening` `opening-objects` `enter` `skip` `hall` `roam-view` `roam-stage` `catalog-view` `catalog-groups` `catalog-lit-text` `catalog-progress-fill` `catalog-ticket-btn` `mode-roam-btn` `mode-catalog-btn` `ticket-open-btn` `lit-count-badge` `shuffle-btn` `replay-btn` `brand-home-btn` `announcement` `nav-note` `nav-info` `nav-thanks`
**ticket.js（11）**：`ticket-modal` `ticket-nickname` `ticket-generate-btn` `ticket-download-btn` `ticket-close-btn` `ticket-preview-img` `ticket-summary-lit` `ticket-summary-mods` `ticket-summary-cinemas` `ticket-summary-time` `ticket-status`

---

## 5. 图片自适应底线（已落实）
- 全部图片 `max-width:100%`（含 `width/height` 属性防 CLS）；`object-fit: contain`（motif 不裁切）。
- `.gesture img` / `.roam-img` / `.thumb-outline` / `.thumb-grain`：绝对定位铺满容器 + `object-fit:contain`。
- 目录缩略图 `loading="lazy"`（由 hub.js 注入）；开屏/漫游 motif 为 JS 预载/异步解码。
- 票根预览 `#ticket-preview-img`：`width/height=1200/1600` + `aspect-ratio:3/4` + `max-width:340px; height:auto`，自适应容器。

## 6. 已知遗留问题（非本侧可解，如实记录）
- 真机微信内置浏览器未测（长按保存票根、`execCommand` 复制兜底、`backdrop-filter`）。
- 跨子域足迹 Cookie（`Domain=.ofjing.com` + `SameSite=Lax`）需在真实域名下验证。
- iOS `position: fixed` 背景 + `100svh` 在键盘/地址栏伸缩下的表现未真机验证。
- 温纸（目录）房间色温为用户提案，待确认后生效。
- 标题字体已按根规范 v2 落定为龙藏；本次序幕标题已接入，其他区域按各自实际完成范围核对。
