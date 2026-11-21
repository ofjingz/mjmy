(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const cinemas = window.CINEMA_DATA?.cinemas || [];
  const byId = new Map(cinemas.map((cinema) => [cinema.id, cinema]));
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const store = window.CinemaRecord.createStore();
  let selected = cinemas[0];
  let entered = false;
  let planet = null;
  let playing = false;
  let tourTimer = null;
  let tourRemaining = 4000;
  let tourStartedAt = null;
  let tourEpoch = 0;
  let toastTimer = null;
  let photoIndex = 0;
  let ticketSnapshot = null;
  let directoryFocusId = '';
  const dialogIds = ['directory-dialog', 'detail-dialog', 'lightbox', 'ticket-dialog'];
  const pad = (n) => String(n).padStart(2, '0');

  function notify(message) {
    $('toast').textContent = message;
    $('toast').classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('toast').classList.remove('is-visible'), 2500);
  }

  function hasDialog() { return dialogIds.some((id) => $(id).open); }
  function syncPlanet() { planet?.setActive(entered && !hasDialog() && !document.hidden); }
  function openDialog(id) {
    stopTour();
    planet?.setRunning(false);
    $(id).showModal();
    syncPlanet();
  }

  function suspendTour() {
    if (tourTimer !== null && tourStartedAt !== null) {
      tourRemaining = Math.max(0, tourRemaining - (performance.now() - tourStartedAt));
    }
    clearTimeout(tourTimer);
    tourTimer = null;
    tourStartedAt = null;
    tourEpoch++;
  }

  function tourControls() {
    const detail = $('detail-dialog');
    const started = playing && !detail.classList.contains('is-touring');
    detail.classList.toggle('is-touring', playing);
    if (started) renderTourCaption();
    $('tour').setAttribute('aria-pressed', String(playing));
    $('tour-label').textContent = playing ? '暂停漫游' : '自动漫游';
    $('tour-symbol').textContent = playing ? 'Ⅱ' : '▷';
    for (const id of ['detail-tour', 'lightbox-tour']) {
      $(id).setAttribute('aria-pressed', String(playing));
      $(id).textContent = playing ? 'Ⅱ 暂停漫游' : '▷ 继续漫游';
    }
    $('tour-progress').classList.toggle('is-playing', playing);
    $('tour-progress').style.animationDuration = `${tourRemaining}ms`;
  }

  function stopTour() {
    suspendTour();
    playing = false;
    tourControls();
  }

  function scheduleTour() {
    suspendTour();
    if (!playing || document.hidden || !entered || $('directory-dialog').open || $('ticket-dialog').open) return;
    const epoch = tourEpoch;
    const begin = () => {
      if (epoch !== tourEpoch || !playing || document.hidden) return;
      tourStartedAt = performance.now();
      tourTimer = setTimeout(() => {
        tourTimer = null;
        tourStartedAt = null;
        if (!playing || document.hidden) return;
        tourRemaining = 4000;
        if (photoIndex + 1 < selected.images.length) {
          photoIndex++;
          renderGallery();
        } else {
          choose(cinemas[(cinemas.indexOf(selected) + 1) % cinemas.length].id, { manual: false });
        }
        scheduleTour();
      }, tourRemaining);
      tourControls();
    };
    // Count visible time after the full photo loads, never a loading placeholder.
    const image = $('gallery-image');
    if (image.complete === false) {
      image.addEventListener('load', begin, { once: true });
      image.addEventListener('error', begin, { once: true });
    } else begin();
  }

  function toggleTour() {
    if (playing) { stopTour(); return; }
    if (!$('detail-dialog').open) {
      renderDetail();
      setCinemaHash(selected.id);
      openDialog('detail-dialog');
    }
    playing = true;
    tourControls();
    planet?.setRunning(false);
    planet?.select(selected.id);
    scheduleTour();
  }

  function renderMarks() {
    if (!selected) return;
    const state = store.getState();
    const choice = state.choices[selected.id] || {};
    for (const area of ['preview', 'detail']) {
      $(''+area+'-visited').setAttribute('aria-pressed', String(Boolean(choice.visited)));
      $(''+area+'-wishlist').setAttribute('aria-pressed', String(Boolean(choice.wishlist)));
    }
    $('record-note').textContent = state.persistent
      ? '选择保存在当前浏览器，去过与想去可同时标记。'
      : '当前浏览器无法保存选择，关闭或刷新后可能丢失，请先保存票根。';
  }

  function toggleMark(kind) {
    stopTour();
    planet?.setRunning(false);
    store.toggle(selected.id, kind);
    renderMarks();
    const state = store.getState();
    const on = state.choices[selected.id]?.[kind];
    notify(`${on ? '已标记' : '已取消'}${kind === 'visited' ? '去过' : '想去'} · ${selected.name}`);
    window.dispatchEvent(new CustomEvent('mujian:cinema-record-change', {
      detail: { visitId: state.visitId, summary: store.summary(cinemas) },
    }));
  }

  function showImage(imageElement, image, useThumbnail = false) {
    imageElement.hidden = false;
    imageElement.alt = image?.alt || selected?.name || '影院照片';
    imageElement.onerror = () => {
      imageElement.onerror = null;
      imageElement.hidden = true;
      notify('这张照片暂时无法打开，请切换另一张');
    };
    if (!image) return;
    imageElement.src = useThumbnail ? image.thumb || image.src : image.src;
    const frame = imageElement.closest('.preview-image-button, .gallery-image-button');
    if (frame) frame.style.setProperty('--photo-fill', 'url(' + JSON.stringify(image.thumb || image.src) + ')');
  }

  function renderPreview() {
    $('preview-city').textContent = selected.city;
    $('preview-name').textContent = `${selected.city} ${selected.name}`;
    $('preview-original').textContent = selected.originalName ? `（${selected.originalName}）` : '';
    $('preview-original').hidden = !selected.originalName;
    $('preview-contributor').textContent = `投稿：${selected.contributors.join('、')}`;
    $('preview-open').setAttribute('aria-label', `查看${selected.displayName}的图文`);
    $('read-cinema').setAttribute('aria-label', `查看${selected.displayName}图文`);
    showImage($('preview-image'), selected.images[0]);
    $('preview-open').classList.remove('is-developing');
    void $('preview-open').offsetWidth;
    $('preview-open').classList.add('is-developing');
    renderMarks();
  }

  function choose(id, { manual = true, animate = true } = {}) {
    if (!byId.has(id)) return;
    if (manual) { stopTour(); planet?.setRunning(false); }
    selected = byId.get(id);
    photoIndex = 0;
    tourRemaining = 4000;
    renderPreview();
    planet?.select(id, { animate });
    if ($('detail-dialog').open) {
      renderDetail();
      setCinemaHash(id);
    }
  }

  function step(amount) {
    choose(cinemas[(cinemas.indexOf(selected) + amount + cinemas.length) % cinemas.length].id);
  }

  function makePlanet() {
    if (planet) { planet.resize(); return; }
    try {
      planet = new window.CinemaPlanet({
        canvas: $('planet'), markers: $('planet-markers'), cinemas,
        onSelect: (id) => choose(id),
        onInteract: () => stopTour(),
      });
    } catch (error) {
      // Directory and reading remain available when canvas is unavailable.
      $('planet').hidden = true;
      const fallback = document.createElement('button');
      fallback.className = 'planet-fallback';
      fallback.textContent = '打开影院目录 ↗';
      fallback.addEventListener('click', showDirectory);
      $('planet-stage').append(fallback);
      console.warn('Cinema sculpture unavailable; directory remains accessible.', error.message);
    }
  }

  function enter() {
    if (entered) return;
    entered = true;
    $('universe').hidden = false;
    makePlanet();
    renderPreview();
    planet?.select(selected.id, { animate: false });
    planet?.setRunning(!motion.matches);
    planet?.revealNearby?.();
    syncPlanet();
  }

  function renderDirectory() {
    const query = $('cinema-search').value.trim().toLocaleLowerCase();
    const list = $('directory-list');
    list.replaceChildren();
    let count = 0;
    cinemas.forEach((cinema, index) => {
      if (query && ![cinema.name, cinema.originalName || '', cinema.city, ...cinema.contributors].join(' ').toLocaleLowerCase().includes(query)) return;
      count++;
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'directory-item';
      row.setAttribute('aria-label', `选择${cinema.name}，${cinema.city}`);
      const image = document.createElement('img');
      image.src = cinema.images[0].thumb || cinema.images[0].src;
      image.alt = ''; image.loading = 'lazy';
      const label = document.createElement('span');
      const name = document.createElement('strong'); name.textContent = cinema.displayName;
      const meta = document.createElement('small');
      meta.textContent = `${cinema.contributors.join('、')}`;
      label.append(name, meta);
      const indicator = document.createElement('span');
      indicator.className = cinema.id === selected.id ? 'selection-dot' : '';
      row.append(image, label, indicator);
      row.addEventListener('click', () => {
        directoryFocusId = cinema.id;
        $('directory-dialog').close();
        choose(cinema.id);
        $('read-cinema').focus({ preventScroll: true });
      });
      list.append(row);
    });
    $('search-empty').hidden = count > 0;
  }

  function showDirectory() {
    directoryFocusId = '';
    $('cinema-search').value = '';
    renderDirectory();
    openDialog('directory-dialog');
  }

  function renderGallery() {
    const image = selected.images[photoIndex];
    showImage($('gallery-image'), image);
    $('gallery-credit').textContent = image.credit;
    for (const button of $('gallery-thumbs').children) {
      button.setAttribute('aria-pressed', String(Number(button.dataset.index) === photoIndex));
    }
    for (const id of ['gallery-prev', 'gallery-next', 'lightbox-prev', 'lightbox-next']) $(id).disabled = selected.images.length < 2;
    if ($('lightbox').open) renderLightbox();
  }

  function photoStep(amount) {
    stopTour();
    tourRemaining = 4000;
    photoIndex = (photoIndex + amount + selected.images.length) % selected.images.length;
    renderGallery();
  }

  function renderTourCaption() {
    const caption = $('tour-caption');
    caption.textContent = selected.city + ' · ' + selected.name;
    if (playing && !motion.matches && caption.animate) {
      caption.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], {
        duration: 670, easing: 'steps(' + Array.from(caption.textContent).length + ', end)'
      });
    }
  }

  function renderDetail() {
    renderTourCaption();
    $('detail-city').textContent = selected.city;
    $('detail-name').textContent = `${selected.city} ${selected.name}`;
    $('detail-original').textContent = selected.originalName ? `（${selected.originalName}）` : '';
    $('detail-original').hidden = !selected.originalName;
    $('detail-type').textContent = selected.type;
    $('detail-contributor').textContent = `投稿：${selected.contributors.join('、')}`;
    const stories = $('detail-stories');
    stories.replaceChildren();
    (selected.stories || []).forEach((story) => {
      const section = document.createElement('section'); section.className = 'story';
      const meta = document.createElement('p'); meta.className = 'story-meta';
      meta.textContent = `${story.excerpt ? '投稿原文片段' : '投稿原文'} · ${story.author}${story.shared ? ' · 涉及多家影院' : ''}`;
      const title = document.createElement('h3'); title.textContent = story.title;
      const text = document.createElement('div'); text.className = 'story-text';
      story.paragraphs.forEach((paragraph) => {
        const p = document.createElement('p'); p.textContent = paragraph; text.append(p);
      });
      section.append(meta, title, text); stories.append(section);
    });
    const thumbs = $('gallery-thumbs'); thumbs.replaceChildren();
    selected.images.forEach((image, index) => {
      const button = document.createElement('button');
      button.className = 'gallery-thumb'; button.type = 'button'; button.dataset.index = index;
      button.setAttribute('aria-label', `查看第${index + 1}张影院照片`);
      button.setAttribute('aria-pressed', String(index === photoIndex));
      const img = document.createElement('img');
      img.src = image.thumb || image.src; img.alt = ''; img.loading = 'lazy';
      button.append(img); button.addEventListener('click', () => { stopTour(); tourRemaining = 4000; photoIndex = index; renderGallery(); });
      thumbs.append(button);
    });
    renderGallery(); renderMarks();
    $('detail-dialog').scrollTop = 0;
  }

  function setCinemaHash(id) {
    try { history.replaceState(null, '', `#cinema=${encodeURIComponent(id)}`); } catch (_) {}
  }

  function showDetail() {
    stopTour();
    tourRemaining = 4000;
    photoIndex = 0;
    renderDetail();
    setCinemaHash(selected.id);
    openDialog('detail-dialog');
  }

  function renderLightbox() {
    const image = selected.images[photoIndex];
    showImage($('lightbox-image'), image);
    $('lightbox-label').textContent = `${selected.displayName}`;
    $('lightbox-credit').textContent = image.credit;
    $('lightbox-scroll').classList.remove('is-zoomed');
    $('zoom-image').setAttribute('aria-pressed', 'false');
    $('zoom-image').textContent = '放大';
    $('lightbox-scroll').scrollTo(0, 0);
  }

  const TICKET_WIDTH = 400;
  const TICKET_SCALE = 2;
  const TICKET_TITLE = '幕间漫游';
  const TICKET_WEBSITE = 'mjmy.ofjing.com';
  const TICKET_BACKING = '#dae5f3';
  const TICKET_DEFAULT_NICK = '一位迷影者';
  const TICKET_TITLE_SIZE = 68;
  const TICKET_BOTTOM_INSET = 13;
  const TICKET_TOOTH_DEPTH = 6.5;
  const TICKET_PALETTE = {
    paper: '#081a36',
    glow: '#142c51',
    ink: '#f4f0ea',
    muted: '#aab7ca',
    title: '#e794b5',
    titleGrain: '#38376468',
    list: '#e794b5',
    grain: 'rgba(244,240,234,.055)',
    edge: '#aab7ca64',
    rule: 'rgba(244,240,234,.16)',
    seam: 'rgba(244,240,234,.25)'
  };
  const FISH_SVG_FALLBACK = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="953.683 567.303 320.132 86.001" width="320.132" height="86.001"><mask id="fish-cutouts" maskUnits="userSpaceOnUse" x="953.683" y="567.303" width="320.132" height="86.001"><rect x="953.683" y="567.303" width="320.132" height="86.001" fill="#fff"/><path d="M1120.321 577.7601 C1162.308 581.6561 1204.483 585.8541 1241.956 611.4461 C1204.849 632.4111 1166.406 640.8601 1125.928 642.8471 C1149.145 620.5651 1140.989 590.2591 1120.321 577.7601" fill="#000"/><path d="M963.0078 606.9501 L989.6718 595.2801 L1000.5628 603.7311 L998.4978 611.7291 L987.4378 619.5871 L970.5188 615.1361 L960.5668 609.1241 Z" fill="#000"/><path d="M1245.8635 610.4176 L1263.3055 598.3586 L1265.4155 602.6016 L1263.7275 639.0526 L1244.4565 613.7326 Z" fill="#000"/><path d="M1136.8993 611.7291 C1136.8993 628.9451 1123.8743 642.9021 1107.8063 642.9021 C1091.7393 642.9021 1078.7143 628.9451 1078.7143 611.7291 C1078.7143 594.5131 1091.7393 580.5561 1107.8063 580.5561 C1123.8743 580.5561 1136.8993 594.5131 1136.8993 611.7291" fill="#000"/><path d="M1099.476 576.8715 C1075.346 589.0875 1070.742 622.6125 1091.224 642.8135 C1057.18 640.1925 1024.718 633.1475 992.07 621.0485 C997.908 618.4565 1001.381 614.6385 1001.804 608.5175 C1002.231 602.3495 999.597 597.8045 994.234 594.3305 C1028.869 582.2255 1063.849 577.3885 1099.476 576.8715" fill="#000"/></mask><path d="M1129.9132 616.2619 C1128.4292 618.8139 1127.3852 620.6099 1126.0462 622.9119 C1128.4552 622.7799 1130.3892 622.6739 1133.1252 622.5249 C1131.9082 620.1519 1131.0352 618.4499 1129.9132 616.2619 M978.2502 602.1119 C974.4252 604.0559 970.3132 606.1459 965.2932 608.6979 C970.7262 611.1259 975.1432 613.0999 979.3112 614.9639 C978.9462 610.5409 978.6142 606.5259 978.2502 602.1119 M1103.3672 609.1239 C1105.2872 604.8469 1106.7082 601.6819 1108.3522 598.0209 C1104.5552 596.1269 1100.6412 594.1739 1096.7272 592.2209 C1096.3622 592.6139 1095.9972 593.0069 1095.6322 593.3999 C1098.1212 598.4609 1100.6112 603.5209 1103.3672 609.1239 M991.6952 600.7829 C988.2652 600.0439 985.0012 602.3239 984.2272 605.9979 C983.4452 609.7119 985.7892 613.5249 989.2772 614.2139 C992.6822 614.8859 996.0182 612.5439 996.7612 608.9599 C997.5462 605.1729 995.3082 601.5599 991.6952 600.7829 M1262.6132 602.6019 C1257.9652 606.1039 1253.4622 609.4979 1249.0482 612.8239 C1252.8282 618.3729 1256.9272 624.3909 1261.5282 631.1449 C1261.9132 620.9999 1262.2662 611.7399 1262.6132 602.6019 M1097.4382 585.9209 C1112.9452 592.0909 1125.6862 601.9289 1136.4492 615.1359 C1138.4692 605.7119 1133.5232 594.3179 1124.9042 587.8769 C1116.8112 581.8289 1104.6882 580.8789 1097.4382 585.9209 M1089.5602 592.0849 C1082.6772 597.9529 1079.6682 610.5789 1082.5042 620.9089 C1085.5452 631.9869 1094.8972 640.5209 1105.2242 641.7189 C1116.2132 642.9939 1125.2492 639.5189 1132.0302 629.3089 C1121.6772 628.6759 1112.2492 626.4989 1104.6102 618.8629 C1097.2272 611.4819 1092.3212 602.5289 1089.5602 592.0849 M1124.0272 579.3849 C1143.8072 590.2779 1151.1812 620.9779 1129.9392 641.4499 C1167.9672 638.9509 1203.9052 630.6679 1238.2502 611.1379 C1202.3062 588.7489 1163.6322 582.1569 1124.0272 579.3849 M1095.9962 578.7079 C1061.9352 579.1959 1028.4932 583.7709 995.3802 595.2199 C1000.5072 598.5059 1003.0262 602.8039 1002.6182 608.6379 C1002.2132 614.4259 998.8932 618.0379 993.3112 620.4879 C1024.5252 631.9319 1055.5592 638.5939 1088.1062 641.0729 C1068.5252 621.9679 1072.9272 590.2609 1095.9962 578.7079 M1170.0642 578.8379 C1195.5662 583.9739 1220.1612 591.8089 1242.5012 606.4959 C1243.3392 607.0469 1245.1792 606.7799 1246.0832 606.1369 C1251.6182 602.1979 1256.9642 597.9549 1262.5012 594.0209 C1263.7652 593.1229 1265.8942 592.2469 1266.9672 592.8069 C1268.0412 593.3669 1268.8842 595.7709 1268.8102 597.3109 C1268.1232 611.6509 1267.2652 625.9839 1266.2922 640.3059 C1266.2012 641.6409 1265.2362 643.3919 1264.1932 644.0009 C1263.4802 644.4179 1261.5922 643.5179 1260.8202 642.6229 C1259.2712 640.8239 1258.1162 638.6319 1256.8142 636.5909 C1252.5632 629.9239 1248.3652 623.2179 1243.9872 616.6489 C1243.6282 616.1099 1241.8552 616.0679 1241.0942 616.5039 C1201.8582 639.0049 1159.5182 647.5049 1115.5262 648.2599 C1087.2092 648.7459 1059.2402 645.2189 1031.6192 638.5689 C1008.0652 632.8989 985.2052 624.9419 963.1152 614.4809 C960.7692 613.3709 958.7702 612.4349 958.6852 608.8479 C958.6042 605.3939 960.5182 604.3979 962.6482 603.1959 C985.9302 590.0639 1010.9542 582.8069 1036.7182 578.0909 C1080.3042 570.1129 1127.6172 570.4019 1170.0642 578.8379" fill="#000000" mask="url(#fish-cutouts)"/></svg>';

  const ticketCanvasEl = document.createElement('canvas');
  let ticketFishPromise = null;
  let ticketSeed = Math.floor(Math.random() * 4294967296);
  let ticketTime = '';
  let ticketPrinting = false;
  let ticketAnimation = null;
  let ticketStatusTimer = null;
  let ticketRenderVersion = 0;
  let ticketPrintedNick = '';
  let ticketFallbackNick = '';

  function loadTicketImage(url) {
    const image = new Image();
    image.src = url;
    return image.decode().then(() => image, () => null);
  }

  function loadTicketFish() {
    if (!ticketFishPromise) {
      ticketFishPromise = loadTicketImage('/hub/ticket-art/fish.svg').then((image) => {
        if (image) return image;
        return loadTicketImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(FISH_SVG_FALLBACK));
      });
    }
    return ticketFishPromise;
  }

  function randomFrom(seed) {
    let value = seed >>> 0;
    return () => {
      value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  function formatTicketTimestamp(date) {
    const d = date instanceof Date ? date : new Date(date);
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}  ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function wrapTicketText(ctx, text, maxWidth) {
    const lines = [];
    let line = '';
    for (const character of String(text)) {
      if (line && ctx.measureText(line + character).width > maxWidth && !'、，。'.includes(character)) {
        lines.push(line.trimEnd());
        line = '';
      }
      if (!line && character === ' ') continue;
      line += character;
    }
    if (line) lines.push(line.trimEnd());
    return lines;
  }

  function drawTicketFish(ctx, fish, x, top, ink) {
    if (!fish) return;
    const width = 78;
    const height = width * fish.height / fish.width;
    const mask = document.createElement('canvas');
    mask.width = width * TICKET_SCALE;
    mask.height = Math.ceil(height * TICKET_SCALE);
    const tint = mask.getContext('2d');
    tint.drawImage(fish, 0, 0, mask.width, mask.height);
    tint.globalCompositeOperation = 'source-in';
    tint.fillStyle = ink;
    tint.fillRect(0, 0, mask.width, mask.height);
    ctx.save();
    ctx.globalAlpha = .65;
    ctx.drawImage(mask, x - width / 2, top - 1.2, width, height);
    ctx.restore();
  }

  function ticketOutline(ctx, height, tearLine) {
    const left = 11;
    const right = TICKET_WIDTH - left;
    const top = 8;
    const bottom = height - TICKET_BOTTOM_INSET;
    const notch = 16.8;
    const teeth = 24;
    const step = (right - left) / teeth;
    ctx.beginPath();
    ctx.moveTo(left, top);
    for (let index = 1; index <= teeth; index++) {
      ctx.lineTo(left + step * (index - .5), top + TICKET_TOOTH_DEPTH);
      ctx.lineTo(left + step * index, top);
    }
    ctx.lineTo(right, tearLine - notch);
    ctx.arc(right, tearLine, notch, -Math.PI / 2, Math.PI / 2, true);
    ctx.lineTo(right, bottom);
    for (let index = 1; index <= teeth; index++) {
      ctx.lineTo(right - step * (index - .5), bottom - TICKET_TOOTH_DEPTH);
      ctx.lineTo(right - step * index, bottom);
    }
    ctx.lineTo(left, tearLine + notch);
    ctx.arc(left, tearLine, notch, Math.PI / 2, -Math.PI / 2, true);
    ctx.closePath();
  }

  function paintTicketPaper(ctx, height, tearLine, random) {
    ticketOutline(ctx, height, tearLine);
    ctx.clip();

    ctx.fillStyle = TICKET_PALETTE.paper;
    ctx.fillRect(0, 0, TICKET_WIDTH, height);
    const center = Math.min(height / 2, 440);
    const glow = ctx.createRadialGradient(TICKET_WIDTH / 2, center, 0, TICKET_WIDTH / 2, center, 380);
    glow.addColorStop(0, TICKET_PALETTE.glow);
    glow.addColorStop(1, TICKET_PALETTE.paper);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, TICKET_WIDTH, height);

    ctx.fillStyle = TICKET_PALETTE.grain;
    for (let i = 0; i < height * 19; i++) {
      ctx.fillRect(random() * TICKET_WIDTH, random() * height, .2 + random() * 1.1, .2 + random() * .8);
    }
    ctx.strokeStyle = TICKET_PALETTE.edge;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function paintCinemaTicket({ canvas, snapshot, nick, time, seed, fish, bodyFont, displayFont }) {
    const ctx = canvas.getContext('2d');
    const name = nick || TICKET_DEFAULT_NICK;
    ctx.font = '600 23.5px ' + bodyFont;
    const nickLines = wrapTicketText(ctx, name, 328);

    const groups = [
      { label: '去过的影院', list: snapshot.visited },
      { label: '想去的影院', list: snapshot.wishlist }
    ].map((group) => ({
      label: group.label,
      items: group.list.map((cinema) => {
        const meta = byId.get(cinema.id);
        const primary = cinema.city ? `${cinema.city} · ${cinema.name}` : cinema.name;
        const original = meta?.originalName || '';
        ctx.font = '400 16px ' + bodyFont;
        const nameLines = wrapTicketText(ctx, primary, 328);
        ctx.font = '400 12.5px ' + bodyFont;
        const origLines = original ? wrapTicketText(ctx, original, 328) : [];
        return { nameLines, origLines };
      })
    }));

    const timeY = 229 + nickLines.length * 32;
    const countsTop = timeY + 24;
    const countsHeight = 88;
    const listRuleY = countsTop + countsHeight;

    let measureCursor = listRuleY + 26;
    groups.forEach((group, groupIndex) => {
      if (groupIndex) measureCursor += 24;
      measureCursor += 24;
      if (!group.items.length) {
        measureCursor += 26;
      } else {
        group.items.forEach((item, itemIndex) => {
          measureCursor += item.nameLines.length * 23;
          if (item.origLines.length) measureCursor += item.origLines.length * 18;
          if (itemIndex + 1 < group.items.length) measureCursor += 9;
        });
      }
    });

    const tearLine = measureCursor + 24;
    const height = tearLine + 82;
    canvas.width = TICKET_WIDTH * TICKET_SCALE;
    canvas.height = height * TICKET_SCALE;
    ctx.scale(TICKET_SCALE, TICKET_SCALE);

    const paperRandom = randomFrom(seed ^ 0xbb67ae85);
    const write = (text, x, y, size, ink = TICKET_PALETTE.ink, weight = 400) => {
      ctx.font = weight + ' ' + size + 'px ' + bodyFont;
      ctx.fillStyle = ink;
      ctx.fillText(text, x, y);
    };
    const rule = (y, perforation = false) => {
      ctx.save();
      ctx.strokeStyle = perforation ? TICKET_PALETTE.seam : TICKET_PALETTE.rule;
      ctx.lineWidth = 1.15;
      if (perforation) ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(36, y);
      ctx.lineTo(TICKET_WIDTH - 36, y);
      ctx.stroke();
      ctx.restore();
    };

    paintTicketPaper(ctx, height, tearLine, paperRandom);
    write('影院票根', 36, 43, 14, TICKET_PALETTE.ink, 600);
    ctx.textAlign = 'right';
    write('影院星球', TICKET_WIDTH - 36, 43, 13, TICKET_PALETTE.muted, 400);
    ctx.textAlign = 'left';

    const inkTile = document.createElement('canvas');
    inkTile.width = inkTile.height = 108;
    const ink = inkTile.getContext('2d');
    ink.fillStyle = TICKET_PALETTE.title;
    ink.fillRect(0, 0, 108, 108);
    ink.fillStyle = TICKET_PALETTE.titleGrain;
    for (let i = 0; i < 330; i++) {
      ink.fillRect(paperRandom() * 108, paperRandom() * 108, .45 + paperRandom() * 1.8, .5);
    }
    ctx.font = '400 ' + TICKET_TITLE_SIZE + 'px ' + displayFont;
    const titleMetrics = ctx.measureText(TICKET_TITLE);
    const titleWidth = titleMetrics.actualBoundingBoxLeft + titleMetrics.actualBoundingBoxRight;
    const titleSize = titleWidth ? TICKET_TITLE_SIZE * (328 * .80) / titleWidth : TICKET_TITLE_SIZE;
    ctx.font = '400 ' + titleSize + 'px ' + displayFont;
    ctx.textAlign = 'center';
    ctx.fillStyle = ctx.createPattern(inkTile, 'repeat');
    ctx.fillText(TICKET_TITLE, TICKET_WIDTH / 2, 132);
    ctx.textAlign = 'left';
    rule(162);

    write('迷影者', 36, 196, 14, TICKET_PALETTE.muted, 500);
    nickLines.forEach((line, index) => write(line, 36, 229 + index * 32, 23.5, TICKET_PALETTE.ink, 600));
    write(time, 36, timeY, 14, TICKET_PALETTE.muted);
    rule(countsTop);

    ctx.save();
    ctx.strokeStyle = TICKET_PALETTE.rule;
    ctx.lineWidth = 1.15;
    ctx.beginPath();
    ctx.moveTo(TICKET_WIDTH / 2, countsTop + 20);
    ctx.lineTo(TICKET_WIDTH / 2, countsTop + countsHeight - 20);
    ctx.stroke();
    ctx.restore();

    ctx.textAlign = 'center';
    write(String(snapshot.counts.visited), 118, countsTop + 47, 34, TICKET_PALETTE.ink, 600);
    write('去过', 118, countsTop + 70, 13, TICKET_PALETTE.list, 500);
    write(String(snapshot.counts.wishlist), 282, countsTop + 47, 34, TICKET_PALETTE.ink, 600);
    write('想去', 282, countsTop + 70, 13, TICKET_PALETTE.list, 500);
    ctx.textAlign = 'left';
    rule(listRuleY);

    let cursor = listRuleY + 26;
    ctx.textBaseline = 'top';
    groups.forEach((group, groupIndex) => {
      if (groupIndex) cursor += 24;
      write(group.label, 36, cursor, 14, TICKET_PALETTE.list, 500);
      cursor += 24;
      if (!group.items.length) {
        write('暂无标记', 36, cursor, 15.5, TICKET_PALETTE.muted, 400);
        cursor += 26;
      } else {
        group.items.forEach((item, itemIndex) => {
          item.nameLines.forEach((line) => {
            write(line, 36, cursor, 16, TICKET_PALETTE.ink, 400);
            cursor += 23;
          });
          item.origLines.forEach((line) => {
            write(line, 36, cursor, 12.5, TICKET_PALETTE.muted, 400);
            cursor += 18;
          });
          if (itemIndex + 1 < group.items.length) cursor += 9;
        });
      }
    });

    ctx.textBaseline = 'alphabetic';
    rule(tearLine, true);
    const websiteSize = 15;
    ctx.font = '400 ' + websiteSize + 'px ' + bodyFont;
    const { actualBoundingBoxAscent: ascent, actualBoundingBoxDescent: descent } = ctx.measureText(TICKET_WEBSITE);
    const footerCenter = (tearLine + height - TICKET_BOTTOM_INSET - TICKET_TOOTH_DEPTH) / 2;
    const textTop = footerCenter - (ascent + descent) / 2;
    write(TICKET_WEBSITE, 36, textTop + ascent, websiteSize, TICKET_PALETTE.muted);
    drawTicketFish(ctx, fish, 325, textTop, TICKET_PALETTE.muted);

    const visitedAlt = snapshot.visited.map((c) => `${c.city} ${c.name}`).join('、') || '暂无标记';
    const wishlistAlt = snapshot.wishlist.map((c) => `${c.city} ${c.name}`).join('、') || '暂无标记';
    return {
      source: canvas.toDataURL('image/png'),
      alt: [TICKET_TITLE, '影院票根', name, time, `去过的影院 ${visitedAlt}`, `想去的影院 ${wishlistAlt}`, TICKET_WEBSITE].join('。')
    };
  }

  function backedTicketCanvas(sourceCanvas) {
    const backed = document.createElement('canvas');
    backed.width = sourceCanvas.width;
    backed.height = sourceCanvas.height;
    const ctx = backed.getContext('2d');
    ctx.fillStyle = TICKET_BACKING;
    ctx.fillRect(0, 0, backed.width, backed.height);
    ctx.drawImage(sourceCanvas, 0, 0);
    return backed;
  }

  function showTicketStatus(message) {
    const status = $('ticket-status');
    clearTimeout(ticketStatusTimer);
    status.textContent = message;
    if (message) ticketStatusTimer = setTimeout(() => { status.textContent = ''; }, 3800);
  }

  function stopTicketPrinting() {
    ticketAnimation?.cancel();
    ticketAnimation = null;
  }

  function printTicketSheet() {
    const preview = $('ticket-preview-img');
    const sheet = $('ticket-sheet');
    const scroll = $('ticket-scroll');
    const height = preview.offsetHeight;
    const feed = Math.min(height, scroll.clientHeight + 26);
    if (!height || !feed || motion.matches || !sheet.animate) return;
    const frame = (distance, offset) => {
      const edge = Array.from({ length: 41 }, (_, index) => {
        const x = 100 - index * 100 / 40;
        const y = Math.max(0, distance - (index % 2 ? 4.2 : 0));
        return x + '% ' + y + 'px';
      });
      return { clipPath: 'polygon(0 0, 100% 0, ' + edge.join(', ') + ')', offset };
    };
    ticketAnimation = sheet.animate([
      frame(0, 0), frame(feed * .05, .11), frame(feed * .36, .34),
      frame(feed * .36, .41), frame(feed * .73, .69), frame(feed * .73, .75),
      frame(feed, .98), frame(height, 1)
    ], { duration: 1280, easing: 'linear' });
  }

  function currentNickname() {
    const fp = window.MujianFootprint?.getFootprint?.();
    if (fp) return { nick: fp.nick || fp.noteNick || '', rawNick: fp.nick || '', placeholder: fp.noteNick || TICKET_DEFAULT_NICK };
    return { nick: ticketFallbackNick, rawNick: ticketFallbackNick, placeholder: TICKET_DEFAULT_NICK };
  }

  async function renderTicket() {
    const version = ++ticketRenderVersion;
    const dialog = $('ticket-dialog');
    const preview = $('ticket-preview-img');
    const saveButton = $('save-ticket');
    const nicknameInput = $('ticket-nickname');

    saveButton.disabled = true;
    ticketSnapshot = store.snapshot(cinemas);
    renderMarks();
    window.dispatchEvent(new CustomEvent('mujian:cinema-ticket', { detail: JSON.parse(JSON.stringify(ticketSnapshot)) }));

    const { nick, placeholder } = currentNickname();
    nicknameInput.placeholder = placeholder;
    if (!ticketTime) ticketTime = formatTicketTimestamp(ticketSnapshot.generatedAt);

    const style = getComputedStyle(document.documentElement);
    const bodyFont = style.getPropertyValue('--font-body').trim() || '-apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Sans SC", sans-serif';
    const displayFont = style.getPropertyValue('--font-display').trim() || '"Long Cang", -apple-system, "PingFang SC", sans-serif';

    const [fish] = await Promise.all([
      loadTicketFish(),
      document.fonts?.load('400 ' + TICKET_TITLE_SIZE + 'px ' + displayFont, TICKET_TITLE).catch(() => [])
    ]);
    if (version !== ticketRenderVersion || !dialog.open) return;

    try {
      const ticket = paintCinemaTicket({
        canvas: ticketCanvasEl,
        snapshot: ticketSnapshot,
        nick,
        time: ticketTime,
        seed: ticketSeed,
        fish,
        bodyFont,
        displayFont
      });
      preview.src = ticket.source;
      await preview.decode();
      if (version !== ticketRenderVersion || !dialog.open) return;
      ticketPrintedNick = nick;
      preview.alt = ticket.alt;
      preview.hidden = false;
      saveButton.disabled = false;
      if (ticketPrinting) {
        ticketPrinting = false;
        printTicketSheet();
      }
    } catch (_) {
      if (version === ticketRenderVersion) showTicketStatus('票根生成失败，请稍后重试。');
    }
  }

  function openTicketDialog() {
    ticketSeed = Math.floor(Math.random() * 4294967296);
    ticketTime = formatTicketTimestamp(new Date());
    ticketPrinting = true;
    $('ticket-preview-img').hidden = true;
    $('ticket-edit').open = false;
    $('ticket-nickname').value = currentNickname().rawNick;
    showTicketStatus('');
    openDialog('ticket-dialog');
    document.body.classList.add('is-ticket-open');
    $('ticket-scroll').scrollTop = 0;
    $('ticket-close-btn').focus({ preventScroll: true });
    renderTicket();
  }

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = name;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  }

  $('open-directory').addEventListener('click', showDirectory);
  $('cinema-search').addEventListener('input', renderDirectory);
  $('open-ticket').addEventListener('click', openTicketDialog);
  $('preview-open').addEventListener('click', showDetail);
  $('read-cinema').addEventListener('click', showDetail);
  $('previous').addEventListener('click', () => step(-1));
  $('next').addEventListener('click', () => step(1));
  $('detail-prev').addEventListener('click', () => step(-1));
  $('detail-next').addEventListener('click', () => step(1));
  $('tour').addEventListener('click', toggleTour);
  $('detail-tour').addEventListener('click', toggleTour);
  for (const id of ['detail-visited','detail-wishlist','gallery-prev','gallery-next','gallery-open','detail-prev','detail-next','lightbox-prev','lightbox-next','zoom-image']) {
    for (const event of ['pointerdown','focusin']) $(id).addEventListener(event, stopTour);
  }
  for (const event of ['pointerdown','focusin']) $('gallery-thumbs').addEventListener(event, stopTour);
  $('lightbox-tour').addEventListener('click', toggleTour);
  // Freeze the visible venue before a press can straddle an automatic transition.
  for (const eventName of ['pointerdown', 'focusin']) {
    $('cinema-preview').addEventListener(eventName, () => {
      stopTour();
      planet?.setRunning(false);
    });
  }
  for (const area of ['preview', 'detail']) {
    $(area + '-visited').addEventListener('click', () => toggleMark('visited'));
    $(area + '-wishlist').addEventListener('click', () => toggleMark('wishlist'));
  }
  $('gallery-prev').addEventListener('click', () => photoStep(-1));
  $('gallery-next').addEventListener('click', () => photoStep(1));
  $('lightbox-prev').addEventListener('click', () => photoStep(-1));
  $('lightbox-next').addEventListener('click', () => photoStep(1));
  $('gallery-open').addEventListener('click', () => { openDialog('lightbox'); renderLightbox(); });
  $('zoom-image').addEventListener('click', () => {
    const zoom = $('lightbox-scroll').classList.toggle('is-zoomed');
    $('zoom-image').setAttribute('aria-pressed', String(zoom));
    $('zoom-image').textContent = zoom ? '适合屏幕' : '放大';
  });
  $('copy-link').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(location.href); notify('影院链接已复制'); }
    catch (_) { notify('请复制地址栏中的影院链接'); }
  });
  document.querySelectorAll('[data-close]').forEach((button) => {
    button.addEventListener('click', () => $(button.dataset.close).close());
  });
  dialogIds.forEach((id) => {
    const dialog = $(id);
    dialog.addEventListener('close', () => {
      if (id === 'detail-dialog' || id === 'lightbox') stopTour();
      if (id === 'detail-dialog') {
        try { history.replaceState(null, '', location.pathname + location.search); } catch (_) {}
      }
      if (id === 'ticket-dialog') {
        ++ticketRenderVersion;
        stopTicketPrinting();
        $('ticket-edit').open = false;
        document.body.classList.remove('is-ticket-open');
      }
      syncPlanet();
    });
    dialog.addEventListener('click', (event) => {
      if (event.target !== dialog) return;
      const box = dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
    });
  });
  $('planet-stage').addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault(); step(event.key === 'ArrowLeft' ? -1 : 1);
    }
  });
  $('lightbox').addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault(); photoStep(event.key === 'ArrowLeft' ? -1 : 1);
    }
  });
  $('ticket-nickname-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const edit = $('ticket-edit');
    edit.open = false;
    edit.querySelector('summary').focus();
    const nextNick = $('ticket-nickname').value.trim();
    if (window.MujianFootprint?.setNickname) {
      window.MujianFootprint.setNickname(nextNick);
    } else {
      ticketFallbackNick = nextNick;
      if ($('ticket-dialog').open) renderTicket();
    }
  });
  $('save-ticket').addEventListener('click', () => {
    if (!ticketSnapshot || !ticketCanvasEl.width) return;
    const safeName = ticketPrintedNick.replace(/[\\/:*?"<>|]/g, '').slice(0, 24) || TICKET_DEFAULT_NICK;
    const filename = `幕间漫游-${safeName}-影院票根.png`;
    const backed = backedTicketCanvas(ticketCanvasEl);
    if (backed.toBlob) {
      backed.toBlob((blob) => {
        if (!blob) { showTicketStatus('票根保存失败，请长按图片保存。'); return; }
        download(blob, filename);
        showTicketStatus('已开始下载，也可长按图片保存。');
      }, 'image/png');
    } else {
      const link = document.createElement('a');
      link.href = backed.toDataURL('image/png');
      link.download = filename;
      link.click();
      showTicketStatus('已开始下载，也可长按图片保存。');
    }
  });
  function refreshOpenTicket() {
    if ($('ticket-dialog').open) renderTicket();
  }
  window.addEventListener('mujian:footprint-change', refreshOpenTicket);
  window.addEventListener('focus', refreshOpenTicket);
  window.addEventListener('storage', (event) => {
    if (event.key === 'mujian.footprint.v1' || event.key === 'mujian.cinema-visit.v1') refreshOpenTicket();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      suspendTour();
      $('tour-progress').style.animationPlayState = 'paused';
    } else {
      $('tour-progress').style.animationPlayState = '';
      scheduleTour();
    }
    syncPlanet();
  });
  motion.addEventListener('change', (event) => {
    if (event.matches) { stopTour(); stopTicketPrinting(); planet?.setRunning(false); }
  });
  window.addEventListener('hashchange', readDeepLink);
  function readDeepLink() {
    let id;
    try { id = new URLSearchParams(location.hash.slice(1)).get('cinema'); } catch (_) { return; }
    if (!byId.has(id)) return;
    enter();
    choose(id, { animate: false });
    if (!$('detail-dialog').open) showDetail();
  }

  if (!cinemas.length) {
    $('cinema-status').className = 'no-script';
    $('cinema-status').textContent = '影院资料暂时无法加载，请刷新重试。';
    $('universe').hidden = true;
    return;
  }
  enter();
  readDeepLink();
})();
