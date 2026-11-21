"""Generate the two static Lin Li pages from the curated project data."""
import json
from html import escape as html
from pathlib import Path

root = Path(__file__).resolve().parent
source = json.loads((root / 'data.json').read_text(encoding='utf-8'))
blocks = [item['text'] for item in source['blocks']]
photos = {item['index']: item for item in source['photos']}

stations = [
    dict(id='seaside', when='2021.07', title='海边银幕', poster=1, screen=2, group=[2, 4, 5, 3, 1], anchor='reflection', words='2021年与9个使馆、阿那亚联动的海边主题影展“海边银幕”'),
    dict(id='access', when='2023.12.01 — 12.10', title='万物有灵', poster=6, screen=None, group=[6], anchor='reflection', words='2023年与6个使馆、中国盲文图书馆、上海聋人影展、8所高校、40多位导演、嘉宾一起联动呈现的无障碍主题影展“万物有灵”'),
    dict(id='nordic', when='2023.12', title='斯堪的纳维亚漫游', poster=None, screen=None, group=[], anchor='nordic', words='我们组成策展团队。'),
    dict(id='lassnig', when='2023.12 — 2024.03', title='拉斯尼格系列影像', poster=11, screen=15, group=[15, 11, 12, 14, 13], anchor='lassnig', words='与此同时，我也策划了三场玛丽亚·拉斯尼格的系列影像活动。'),
    dict(id='film16', when='2024.06.08', title='手工与机械', poster=31, screen=37, group=[37, 31, 32, 33, 34, 35, 36], anchor='reflection', words='与澳大利亚使馆合作呈现的澳大利亚导演Richard Tuohy 和Dianna Barrie创作的16毫米胶片的现场放映'),
    dict(id='europe', when='2024.11.01 — 11.03', title='新世纪的跨国关怀', poster=10, screen=8, group=[8, 10, 9, 7], anchor='europe', words='我们将影展视野从“北欧”拓展至整个“欧洲”。'),
    dict(id='ageing', when='2025.10.12 — 12.27', title='一起变老', poster=16, screen=24, group=[24, 28, 27, 16, 17, 18, 19, 20, 21, 22, 25, 29], anchor='ageing', words='“一起变老”影展围绕“AGEING TOGETHER”的老龄化主题展开，影片涵盖剧情、纪录、实验、喜剧等多元类型。'),
]

captions = {
  1:'海边银幕 · 活动海报',2:'《篮球冠军》· 海边放映现场',3:'《海洋之歌》· 海边放映现场',4:'《海洋之歌》· 海边放映现场',5:'《苹果和虫子》· 海边放映现场',
  6:'万物有灵 · 无障碍影像展海报',7:'欧洲影像 · 闭幕酒会（摄影 FJ）',8:'欧洲影像 · 林立开场（摄影 FJ）',9:'欧洲影像 · 北师大开幕现场（摄影 FJ）',10:'新世纪的跨国关怀 · 活动海报',
  11:'动画作为一种艺术形式 · 活动海报',12:'拉斯尼格系列影像 · 谭慧致辞（摄影 FJ）',13:'拉斯尼格系列影像 · 合影（摄影 FJ）',14:'拉斯尼格系列影像 · Mandl 致辞（摄影 FJ）',15:'拉斯尼格系列影像 · 映后交流（摄影 FJ）',
  16:'一起变老 · 影展主视觉',17:'《提醒我》· 放映现场（摄影 FJ）',18:'《大地之歌》· 丹麦文化中心（摄影 FJ）',19:'《一些鸟》· 匈牙利文化中心（摄影 FJ）',20:'荷兰艺术家影像 · 金台艺术馆映后交流（摄影 FJ）',21:'荷兰艺术家影像 · 映后全景（摄影 FJ）',22:'《萝榭与弗兰克》· 放映现场（摄影 FJ）',24:'2025.11.03 · 泰康燕园 ·《音乐之光》（摄影 FJ）',25:'《北斗七星》· 法国文化中心',27:'2025.12.14 · 丹麦文化中心 ·《永远的人类》（摄影 FJ）',28:'2025.12.19 · 北京大学电影协会 ·《北斗七星》',29:'《我的生活》· 映后交流（摄影 FJ）',
  31:'2024.06.08 · 手工与机械 · 海报', **{i:'2024.06.08 · 16 毫米胶片放映现场' for i in range(32,38)},
}
# Keep film poster edition titles from their source files. Date-like file prefixes are not event dates.
for i, asset in photos.items():
    if i not in captions:
        name = asset['originalName']
        movie = name[name.index('《'):name.index('》')+1]
        captions[i] = f'{movie} · 活动海报'

outline = [
    ('opening','开篇',4), ('nordic','北欧电影合作',5), ('europe','欧洲影像',8),
    ('ageing','一起变老',13), ('lassnig','拉斯尼格系列',19), ('reflection','回望与继续',41),
]
assert all(s['words'] in '\n'.join(blocks) for s in stations), '时间轴摘句须能在原文找到'


def head(title, css_class, description):
    return f'''<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#10243d">
  <meta name="description" content="{html(description)}">
  <title>{html(title)}</title>
  <link rel="icon" href="icon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/shared/shell.css">
  <link rel="stylesheet" href="style.css?v=projection-20261121">
  <script defer src="/shared/routes.js"></script>
  <script defer src="/shared/footprint.js"></script>
  <script defer src="/shared/shell.js"></script>
  <script defer src="app.js?v=projection-20261121"></script>
</head>
<body class="{css_class}" data-module="linli">'''


def media(i, variant='src', *, alt=None, loading='lazy', priority=False):
    fetch = ' fetchpriority="high"' if priority else ''
    return f'<img src="{html(photos[i][variant])}" alt="{html(captions[i] if alt is None else alt)}" loading="{loading}" decoding="async"{fetch}>'


def view_link(i, body, class_name):
    return (f'<a class="{class_name}" href="{html(photos[i]["src"])}" '
            f'data-photo="{i}" data-caption="{html(captions[i])}" aria-label="放大：{html(captions[i])}">{body}</a>')


def essay_href(station):
    return f'./essay.html?from={station["id"]}#{station["anchor"]}'


def gallery(name, ids, class_name=''):
    items = '\n'.join(f'<figure>{view_link(i, media(i, "thumb"), "photo-link")}<figcaption>{html(captions[i])}</figcaption></figure>' for i in ids)
    return f'<details class="collection {class_name}"><summary>{html(name)} <span>{len(ids)} 张</span></summary><div class="photo-grid" data-album>{items}</div></details>'


def next_frame(next_station):
    if next_station is None:
        return ''
    sid, title = (next_station[key] for key in ('id', 'title'))
    artwork = next_station['screen'] or next_station['poster']
    preview = media(artwork, 'thumb', alt='') if artwork else f'<span class="frame-far-title">{html(title)}</span>'
    classes = 'frame-far' if artwork else 'frame-far frame-far-text'
    return (f'<a class="{classes}" href="#{sid}" data-scene-link aria-label="下一场：{html(title)}">'
            f'{preview}<span class="frame-next-label">下一场 <span aria-hidden="true">→</span></span></a>')


def station_markup(s, previous, next_station, number):
    sid, title, date = (s[key] for key in ('id', 'title', 'when'))
    poster = s['poster']
    main = s['screen']
    if main:
        image = view_link(main, media(main, loading='eager' if number == 1 else 'lazy'), 'photo-link frame-main')
        reflection = media(main, 'thumb', alt='')
    elif poster:
        image = view_link(poster, media(poster), 'photo-link frame-main frame-vertical')
        reflection = media(poster, 'thumb', alt='')
    else:
        excerpt = blocks[7].split('。',1)[0]+'。'
        image = f'<a href="{essay_href(s)}" class="frame-main frame-text" data-essay><span>北欧电影展暨艺术研讨会</span><p>{html(excerpt)}</p></a>'
        reflection = ''
    poster_markup = view_link(poster, media(poster, 'thumb'), 'photo-link frame-near') if poster and main else ''
    previous_id = previous['id'] if previous else 'opening'
    previous_label = '上一场' if previous else '返回开场'
    body = f'''<section class="station" id="{sid}" aria-labelledby="title-{sid}">
  <div class="station-view">
    <div class="station-optics" data-album>
      {next_frame(next_station)}
      <div class="frame-reflection" aria-hidden="true">{reflection}</div>
      {image}
      {poster_markup}
    </div>
    <div class="station-copy wrap">
      <p class="station-date"><span>{number:02d}</span><span aria-hidden="true">/</span><span>{html(date)}</span></p>
      <h2 id="title-{sid}" class="display" tabindex="-1">{html(title)}</h2>
      <p class="station-quote">{html(s['words'])}</p>
      <div class="station-actions">
        <a class="text-link" href="#{previous_id}" data-scene-link><span aria-hidden="true">←</span> {previous_label}</a>
        <a class="text-link" href="{essay_href(s)}" data-essay>阅读这一段 <span aria-hidden="true">↗</span></a>
        {'<a class="text-link" href="#album-'+sid+'" data-album-jump>查看图集 <span aria-hidden="true">↗</span></a>' if s['group'] else ''}
      </div>
    </div>
  </div>'''
    if s['group']:
        body += f'<div id="album-{sid}" class="station-archive wrap">'
        if sid == 'ageing':
            body += '<p class="ageing-stats">22 部电影<span aria-hidden="true">·</span>34 次放映</p>'
        body += gallery('放映现场与活动海报' if len(s['group']) > 1 else '活动海报', s['group'])
        if sid == 'ageing':
            posters = [23,26,30,*range(38,67)]
            body += gallery('影片海报与场次资料', posters)
        body += '</div>'
    return body + '\n</section>'


track = ''.join(f'<a href="#{s["id"]}" data-stop data-scene-link aria-label="{html(s["when"])} {html(s["title"])}"><span>{s["when"][:4]}</span><span>{html(s["title"])}</span></a>' for s in stations)
sections = '\n'.join(
    station_markup(s, stations[i - 1] if i else None, stations[i + 1] if i + 1 < len(stations) else None, i + 1)
    for i, s in enumerate(stations)
)
page = head(source['title']+' · 幕间漫游','exhibit-page', '从海边银幕出发，沿着林立的策展手记，看人们如何在影像中相遇。') + f'''
  <a class="skip" href="#seaside" data-scene-link>跳到活动手记</a>
  <header class="site-header wrap">
    <a class="mj-return mj-return--header" href="/hub/#catalog" data-exhibit-return><span aria-hidden="true">←</span><span class="mj-orbit-mark" aria-hidden="true"></span><span>返回展厅</span></a>
    <div class="wordmark">{html(source['title'])}</div>
    <a href="./essay.html?from=opening" class="text-link" data-essay>完整手记 <span aria-hidden="true">↗</span></a>
  </header>
  <main id="main">
    <section class="opening" id="opening" aria-labelledby="opening-title">
      <div class="coast"></div>
      <a class="opening-light" href="#seaside" data-scene-link aria-label="进入海边银幕">{media(stations[0]['screen'], 'thumb', alt='', loading='eager', priority=True)}</a>
      <canvas id="sea-grain" class="sea-grain" aria-hidden="true"></canvas>
      <div class="opening-copy wrap">
        <p>在影像中相遇</p>
        <h1 class="display" id="opening-title" tabindex="-1">林立的活动手记</h1>
        <a class="opening-enter" href="#seaside" data-scene-link>进入 <span aria-hidden="true">→</span></a>
      </div>
    </section>
    <div class="exhibit" id="exhibit">
      <div class="exhibit-coast" aria-hidden="true"></div>
      <nav aria-label="活动时间轴" class="timeline"><div class="wrap timeline-links">{track}</div></nav>
      {sections}
    </div>
  </main>
  <dialog class="viewer" aria-labelledby="viewer-title">
    <p id="viewer-title" class="viewer-title" data-viewer-title></p>
    <form method="dialog"><button class="viewer-close" aria-label="关闭图集" autofocus>×</button></form>
    <figure><img alt=""><figcaption id="viewer-caption"></figcaption></figure>
    <div class="viewer-controls"><button type="button" data-prev aria-label="上一张">←</button><span aria-live="polite" data-count></span><button type="button" data-next aria-label="下一张">→</button></div>
    <div class="viewer-thumbs" data-thumbnails role="group" aria-label="图集缩略图"></div>
  </dialog>
</body></html>'''

article = ''.join(
    f'<p id="{next((key for key, name, start in outline if start==i), "p"+str(i))}" data-source-index="{i}"'
    f'{" class=guest-label" if i in (29,32,36) else ""}>{html(b)}</p>\n'
    for i,b in enumerate(blocks[4:],4)
)
essay_title = html(blocks[0]).replace('——我的', '——<br><span class="keep-phrase">我的</span>', 1)
nav = ''.join(f'<a href="#{key}">{name}</a>' for key,name,_ in outline)
essay = head(source['essayTitle']+' · 林立', 'reading-page', '林立《在影像中相遇——我的欧洲电影策展叙事》完整手记。') + f'''
  <a class="skip" href="#paper">跳到文章正文</a>
  <header class="reading-header wrap">
    <a class="mj-return mj-return--header" href="./#opening" data-back><span aria-hidden="true">←</span><span class="mj-orbit-mark" aria-hidden="true"></span><span>返回活动手记</span></a>
    <span>林立 · 完整手记</span>
  </header>
  <div class="reading-coast" aria-hidden="true"></div>
  <main class="reader-layout wrap" id="paper">
    <aside class="reader-aside"><nav aria-label="段落导航"><span>段落导航</span>{nav}</nav></aside>
    <article class="paper">
      <header class="paper-title">
        <h1 class="display" data-source-index="0">{essay_title}</h1>
        <p class="author">林立</p>
        <p class="subtitle" data-source-index="1">{html(blocks[1])}</p>
      </header>
      <details class="reader-mobile-nav"><summary>段落导航</summary><nav aria-label="段落导航">{nav}</nav></details>
      <blockquote class="epigraph"><p data-source-index="2">{html(blocks[2])}</p><p data-source-index="3">{html(blocks[3])}</p></blockquote>
      <div class="original-text">{article}</div>
      <footer>
        <details class="reader-about">
          <summary>关于林立</summary>
          <a href="{html(source['portrait'])}"><img src="{html(source['portrait'])}" width="675" height="1200" loading="lazy" decoding="async" alt="林立肖像、艺术影像策展经历与自述"></a>
        </details>
        <div class="station-actions">
          <a href="./#opening" class="text-link" data-back>← 返回活动手记</a>
          <a href="/hub/#catalog" class="text-link" data-hub-link>返回幕间漫游展厅</a>
        </div>
      </footer>
    </article>
  </main>
</body></html>'''

(root/'index.html').write_text(page+'\n',encoding='utf-8')
(root/'essay.html').write_text(essay+'\n',encoding='utf-8')
