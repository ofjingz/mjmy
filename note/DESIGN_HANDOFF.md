# 留言板（site/note/）· DESIGN_HANDOFF.md

**2026-11-20 前台更新**：留言板采用海报的红蓝配色和浅蓝网格，保留纸笺墙的布局与交互。页面主标题、观众纸笺区标题和书写弹窗标题使用共享龙藏字体，正文沿用共享黑体栈。阿呆的《机器人之梦》留言在 `site/schema.sql` 中作为已审核记录初始化，同时在本地演示中可见。已有 D1 数据库可重复执行该脚本，已有同文记录及其审核状态会保留。

> 交接对象：Gemini（或其他视觉工序）。本文件是「框架 → 视觉」的交接契约。
> 补充总纲见 `/Users/jing/Documents/ChatGPT/迷影展/_tasks/视觉交接规范-给Gemini.md`。
> 交付状态：v4 框架优先 —— 干净框架 + 完整功能，视觉只做到「设计线框级正确」。

## 1. 页面职责与数据流

| 文件 | 职责 |
| --- | --- |
| `index.html` | 前台留言板：写留言（进 pending）+ 展示已审核留言 |
| `admin.html` | 审核台：密码登录 + 全量列表 + 通过/拒绝/删除 + CSV 导入导出 |
| `style.css` | 两页共享样式（房间 3 · 档案温纸令牌） |
| `app.js` | 前台逻辑（读列表 + 提交 + 本地演示兜底） |
| `admin.js` | 审核台逻辑（登录 + 审核 + 导入导出 + 演示模式） |

**数据来源**：线上来自后端 functions（只读契约，见 `site/functions/`）：

- `GET /api/notes` → `{ok, notes:[{id,nickname,content,favorite_movie,created_at}]}`（仅 approved，倒序，≤300）
- `POST /api/notes` body `{nickname, content, favorite_movie}` → 201 `{ok,id,status:'pending'}`；无 D1 → 503 `{ok:false,error:'DB_NOT_BOUND'}`
- `GET /api/admin/notes`（Header `x-admin-key`）→ 全量含 status/reviewed_at
- `PATCH /api/admin/notes` body `{id,status}` 或 `{items:[{id,status}]}`
- `DELETE /api/admin/notes?id=`
- `GET /api/admin/export`（UTF-8 BOM CSV，下载）
- `POST /api/admin/import`（body text/csv，按 id 列 + 审核状态列回写 status）

**内容不在 HTML/JS 里硬编码**：线上留言全部来自接口；内置演示留言只在前端兜底路径出现（见 §6）。

## 2. HTML 结构树（含 JS 依赖的 id / class，不可改）

### 前台 `index.html`

```
body[data-module="note"]
├─ header.exhibit-header
│  └─ .header-inner
│     ├─ .header-meta                     → span ×2（留言板 / 散场之后 · 观众书写）
│     └─ .header-title-row
│        └─ .title-group
│           ├─ h1.exhibit-title
│           └─ p.exhibit-lead
├─ main.exhibit-main
│  ├─ section.note-form-section
│  │  ├─ h2.section-title#form-title
│  │  └─ form.note-form#note-form (novalidate)
│  │     ├─ .field → label[for=nickname] + input#nickname[maxlength=40][required]
│  │     │           + p.field-error#nickname-error (hidden)
│  │     ├─ .field → label[for=content] + textarea#content[maxlength=600][required]
│  │     │           + p.field-error#content-error (hidden)
│  │     │           + .field-count > #content-count
│  │     ├─ .field → label[for=favorite-movie] + input#favorite-movie[maxlength=80]
│  │     ├─ .form-actions → button.c-btn.c-btn--primary[type=submit]
│  │     └─ p.form-hint#form-hint[role=status][aria-live=polite] (hidden)
│  └─ section.notes-section
│     ├─ header.section-head → h2.section-title#notes-title + p.section-count#notes-count
│     ├─ .demo-banner#demo-banner (hidden)      ← 演示兜底标注
│     └─ .notes-list#notes-list[aria-live=polite]   ← JS 渲染
├─ footer.exhibit-footer → p.footer-credit
├─ noscript > p.noscript-note
├─ .toast#toast[role=status][aria-live=polite] (hidden)
└─ template#note-card-template
   └─ article.note-card
      ├─ header.note-head → span.note-nickname + time.note-time
      ├─ p.note-content
      └─ p.note-movie
```

### 审核台 `admin.html`

```
body[data-module="note"][data-hide-dock="true"]
├─ header.exhibit-header.admin-header
│  └─ .header-inner
│     ├─ .header-meta                     → span ×2（审核台 / 留言板管理）
│     └─ .header-title-row
│        ├─ .title-group → h1.exhibit-title + p.exhibit-lead
│        └─ a.admin-front-link (→ ./index.html)
├─ main.exhibit-main.admin-main
│  ├─ section.admin-login#admin-login
│  │  ├─ h2.section-title#login-title
│  │  ├─ form#login-form (novalidate)
│  │  │  ├─ .field → label[for=admin-key] + input#admin-key[type=password][required]
│  │  │  │           + p.field-error#login-error (hidden)
│  │  │  └─ .form-actions → button.c-btn.c-btn--primary[type=submit]
│  │  └─ p.admin-hint
│  └─ section.admin-panel#admin-panel (hidden)
│     ├─ .demo-banner#admin-demo-banner (hidden)   ← 演示兜底横幅
│     ├─ header.section-head.admin-toolbar
│     │  ├─ h2.section-title#panel-title
│     │  ├─ p.section-count#admin-count
│     │  ├─ .toolbar-actions
│     │  │  ├─ button.c-btn.c-btn--secondary#btn-export
│     │  │  ├─ label.c-btn.c-btn--secondary.file-label[for=import-file]（导入 CSV）
│     │  │  ├─ input#import-file[type=file][accept=.csv].sr-file（视觉隐藏、键盘可聚焦）
│     │  │  └─ button.c-btn.c-btn--secondary#btn-logout
│     ├─ .batch-bar#batch-bar
│     │  ├─ label.batch-select-all > input#select-all[type=checkbox]
│     │  ├─ span.batch-count#batch-count
│     │  └─ .batch-actions
│     │     ├─ button#btn-approve-selected (disabled)
│     │     ├─ button#btn-reject-selected (disabled)
│     │     └─ button#btn-delete-selected.danger (disabled)
│     └─ .notes-list.admin-list#admin-list[aria-live=polite]   ← JS 渲染
├─ footer.exhibit-footer → p.footer-credit
├─ .toast#toast (hidden)
└─ template#admin-note-template
   └─ article.note-card.admin-card
      ├─ header.note-head
      │  ├─ .note-head-left → label.admin-select > input.admin-check[type=checkbox] + span.status-badge
      │  └─ time.note-time
      ├─ p.note-nickname
      ├─ p.note-content
      ├─ p.note-movie
      └─ footer.admin-actions
         ├─ button.admin-btn[data-action=approved]
         ├─ button.admin-btn[data-action=rejected]
         └─ button.admin-btn.danger[data-action=delete]
```

**脚本序（不可改）**：`/shared/routes.js` → `/shared/footprint.js` → `/shared/shell.js` → `./app.js`（前台）或 `./admin.js`（审核台）。

## 3. CSS 变量清单（style.css 的 :root）

| 变量 | 值 | 语义 | 可改 |
| --- | --- | --- | --- |
| `--bg-0` | `#F4F1E9` | 档案温纸 · 纸底 | 可（保持温纸令牌语义） |
| `--bg-1` | `#EFE4D2` | 纸底深一档（表单输入区） | 可 |
| `--surface` | `#FBF9F3` | 卡片单一浅表面（略亮于纸底） | 可 |
| `--ink` | `#161616` | 胶片炭黑 · 主文字 | 可 |
| `--ink-2` | `#3B3730` | 次文字 | 可 |
| `--ink-3` | `#6F695F` | 弱文字 | 可 |
| `--accent` | `#B8402F` | 印章朱红 · 仅主按钮 / focus 焦点环 / 成功提示 | 可（用途边界不可扩展） |
| `--status-pending` | `#8A6D3B` | 状态文字色（无框小字，仅文字色） | 可 |
| `--status-approved` | `#4E6E4A` | 状态文字色 | 可 |
| `--status-rejected` | `#8A4A3F` | 状态文字色 | 可 |
| `--font-sans` | 黑体栈 | 正文 / 标题（禁宋体/衬线） | 按 FONT_GUIDELINES.md |
| `--font-mono` | 等宽栈 | （保留，当前未用） | 可 |

字阶四级（当前值，可微调）：
1. 页眉主标题 `h1.exhibit-title`：`clamp(32px, 6vw, 44px)`，600
2. 区块标题 `.section-title`：`18px`，600
3. 正文 / 按钮 / 输入：`16px`
4. 图注 / 时间 / 提示 / 状态徽标：`13px`

间距节奏：`--sp-1`~`--sp-5` = 8 / 16 / 24 / 32 / 40px。

## 4. 可改 / 不可改边界

**可改（Gemini）**：
- `style.css` 全部内容（颜色、字号、间距、圆角、阴影、装饰、布局微调）。
- HTML 中新增纯装饰性元素 / class（不得改动现有 id 与 JS 依赖的 class / data 属性）。
- CSS 变量新增与重定义（保留语义；`--accent` 用途不得扩散到主按钮 / focus 环 / 成功提示之外）。
- 状态文字色 `--status-pending/approved/rejected` 可换（保持「无框小字 + 仅文字色」，不要做成彩色 pill，不要用 `--accent`）。

**不可改**：
- 前端行为的接口契约：`app.js` 的 `/api/notes` GET/POST 与演示兜底判定（404 / 非 ok / `DB_NOT_BOUND`）；`admin.js` 的登录（Header `x-admin-key`）、`PATCH/DELETE`、导出 `fetch+blob`、导入 `POST text/csv`。
- HTML 的 id / class / data 钩子：`note-form`、`nickname`、`content`、`favorite-movie`、`notes-list`、`demo-banner`、`admin-login`、`login-form`、`admin-key`、`admin-panel`、`admin-list`、`select-all`、`batch-count`、`btn-export`、`import-file`、`btn-logout`、`btn-approve-selected`、`btn-reject-selected`、`btn-delete-selected`、`admin-check`、`status-badge`、`admin-btn`、`data-action`。
- 共享底座：`/shared/routes.js`、`/shared/footprint.js`、`/shared/shell.js`、`/shared/shell.css`（问题报修，不直接改）。
- `functions/` 后端（归 Codex）。
- 安全底线：用户内容（昵称/留言/最爱电影）一律 `textContent` 渲染，不得改回 `innerHTML` 拼接。

## 5. 图片自适应底线（不可破）

本页当前无图片 / 头像内容，但 `style.css` 已保留全局规则 `img { display:block; max-width:100%; height:auto; }`。
后续若加入头像，须沿用：不裁切、不变形、带 `width/height` 防跳动、`loading="lazy"`。

## 6. 本地演示兜底与线上行为差异

| 场景 | 前台 `index.html` | 审核台 `admin.html` |
| --- | --- | --- |
| 本地静态（无 functions，`/api/notes` → 404） | 渲染 5 条内置演示留言 + 显著标注「本地演示数据（未连接 D1）」；提交失败时提示「演示模式：留言已本地暂存（仅本机可见）」并写入 `localStorage`（key `mujian.note.demo.v1`）展示 | `detectBackend()` 探测 404 → 直接进入「仅演示」模式：内存演示数据（含 pending/approved/rejected）+ 顶部「仅演示（未连接 D1）」横幅；所有通过/拒绝/删除/导入导出在内存中生效 |
| 线上 D1 已绑定 | 正常 GET/POST；演示横幅自动不触发 | 正常登录 + 全量列表 + 真实 PATCH/DELETE + 导出/导入 CSV |
| 线上但 D1 未绑定（503 `DB_NOT_BOUND`） | GET/POST 落入兜底（与本地一致） | `attemptLogin` 命中 `DB_NOT_BOUND` → 演示模式 |

**判定依据**：前台以 `fetch('/api/notes')` 是否 `res.ok && data.ok === true` 为界；审核台以 `detectBackend()` 是否 404 / 网络错误，及登录后 `DB_NOT_BOUND` 为界。兜底路径只在失败时触发，线上就绪后自动不触发。

**本地暂存说明**：演示模式下提交的留言写入 `localStorage`（key `mujian.note.demo.v1`），仅在演示模式（GET 失败）时展示在列表顶部；线上 GET 恢复后只显示真实已审核留言，本地暂存不会被自动补提交（演示留言从未真正进入后端）。

## 7. 交互契约

- 前台提交：空昵称 / 空留言被本地校验拦截（`aria-invalid` + 错误文案）；成功提示「审核通过后展示」；超长由 `maxlength` 截断（昵称 40 / 留言 600 / 最爱电影 80）。
- 审核台登录：密码存 `sessionStorage`（key `mujian.note.admin-key`），关闭标签页失效；401 清空并提示「密码错误或未授权」；「退出登录」清空并回登录态。
- 审核动作：通过/拒绝走 `PATCH`（单条 `{id,status}`，批量 `{items:[…]}`）；删除走 `DELETE?id=`（批量删除因后端仅支持单条，逐条调用）。
- 导出：线上 `fetch('/api/admin/export')` 取 blob 后 `<a download>` 下载（保留 `Content-Disposition` 文件名）；演示模式前端拼 CSV 下载。
- 导入：读取文件 → 本地 `validateCSV()` 校验「id 列 + 审核状态列」→ 线上 `POST text/csv` / 演示模式本地解析回写。
- `prefers-reduced-motion: reduce` 下所有动画 / 过渡静止；键盘可达，`button` / `input` / `label` 均 `:focus-visible` 朱红焦点环。

## 8. 遗留问题与注意

- `export.js` 额外接受 `?key=` 查询参数传密码（后端已知隐患，前端不依赖、只按 Header 传）；建议 Codex 侧移除该查询参数通道。
- admin 密码经 `sessionStorage` 明文暂存 + `x-admin-key` 明文 Header（同源 HTTP(S)），生产应确认使用 HTTPS，避免明文泄露。
- 审核台表单为同源 fetch，无额外 CSRF 防护；管理员密码强度与轮换策略由部署侧决定。
- 批量删除在线模式下逐条调用 `DELETE`，条数多时会产生多次请求（后端契约如此，报告不修）。
