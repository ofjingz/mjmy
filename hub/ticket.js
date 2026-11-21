(() => {
  'use strict';

  const CINEMA_NAMES = {
    'stattkino': '施塔特影院',
    'eye': '眼睛电影博物馆',
    'irish-film-institute': '爱尔兰电影资料馆',
    'light-house': '灯塔影院',
    'new-beverly': '新贝弗利影院',
    'academy-museum': '电影学院博物馆影院',
    'billy-wilder': '比利·怀尔德剧院',
    'nfsa-arc': '国家影音档案馆·阿克影院',
    'acmi': '澳大利亚动态影像中心',
    'sydney-cinematheque': '悉尼电影资料馆',
    'cinematheque-francaise': '法国电影资料馆',
    'fondation-pathe': '百代电影基金会',
    'bophana': '博帕纳视听资源中心',
    'the-flicks': '弗利克斯影院',
    'changying': '长影电影院',
    'spot-taipei': '光点台北'
  };

  const DEFAULT_NICK = '一位迷影者';
  const WIDTH = 400;
  const SCALE = 2;
  const TITLE = '幕间漫游';
  const WEBSITE = 'mjmy.ofjing.com';
  const BACKING = '#dae5f3';
  const TITLE_SIZE = 68;
  const BOTTOM_INSET = 13;
  const TOOTH_DEPTH = 6.5;
  const PALETTES = {
    dark: {
      paper: '#081a36', glow: '#142c51', ink: '#f4f0ea', muted: '#aab7ca',
      title: '#e794b5', titleGrain: '#38376468', list: '#e794b5',
      marks: ['#abbad1', '#dc8fae'], grain: 'rgba(244,240,234,.055)',
      edge: '#aab7ca64', rule: 'rgba(244,240,234,.16)'
    }
  };
  const imageCache = new Map();

  function loadImage(url) {
    const image = new Image();
    image.src = url;
    return image.decode().then(() => image, () => null);
  }

  function loadPosterArt(name) {
    const url = './ticket-art/' + name + '.svg';
    if (!imageCache.has(url)) imageCache.set(url, loadImage(url));
    return imageCache.get(url);
  }

  function prepareExhibitIcon(image) {
    if (!image) return null;

    // Crop the homepage artwork's transparent margins before printing at stamp size.
    const size = 160;
    const raster = document.createElement('canvas');
    raster.width = raster.height = size;
    const context = raster.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0, size, size);
    const { data } = context.getImageData(0, 0, size, size);
    let left = size, right = -1, top = size, bottom = -1;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (data[(y * size + x) * 4 + 3] < 24) continue;
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
    if (right < left) return null;
    const width = right - left + 1;
    const height = bottom - top + 1;
    const pixels = context.getImageData(left, top, width, height);
    let filled = 0;
    for (let i = 3; i < pixels.data.length; i += 4) filled += pixels.data[i] / 255;
    return { pixels, coverage: filled / (width * height) };
  }

  function loadExhibitIcon(url) {
    if (!imageCache.has(url)) {
      imageCache.set(url, loadImage(url).then(image => {
        if (!image) imageCache.delete(url);
        return prepareExhibitIcon(image);
      }));
    }
    return imageCache.get(url);
  }

  function drawExhibitIcon(ctx, icon, x, y, light) {
    if (!icon) return;
    const { pixels: image, coverage } = icon;

    const stamp = document.createElement('canvas');
    stamp.width = image.width;
    stamp.height = image.height;
    const context = stamp.getContext('2d');
    const print = context.createImageData(image.width, image.height);
    const rgb = hex => [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16));
    const highlight = rgb(light);
    const shadow = rgb('#233c63');
    for (let i = 0; i < image.data.length; i += 4) {
      const alpha = image.data[i + 3];
      if (!alpha) continue;
      const value = (.2126 * image.data[i] + .7152 * image.data[i + 1] + .0722 * image.data[i + 2]) / 255;
      const grain = ((Math.imul(i, 113) ^ (i >>> 3)) % 13) / 200;
      const density = Math.min(1, .18 + .89 * Math.pow(value, .73) - grain);
      for (let channel = 0; channel < 3; channel++) {
        print.data[i + channel] = shadow[channel] + (highlight[channel] - shadow[channel]) * density;
      }
      print.data[i + 3] = alpha;
    }
    context.putImageData(print, 0, 0);

    // Fit the artwork into the same cell with slight optical compensation for narrow silhouettes.
    const size = Math.max(63, Math.min(75, 66 * Math.pow(.65 / coverage, .25)));
    const ratio = size / Math.max(image.width, image.height);
    const w = image.width * ratio;
    const h = image.height * ratio;
    ctx.drawImage(stamp, x - w / 2, y - h / 2, w, h);
  }

  function randomFrom(seed) {
    let value = seed >>> 0;
    return () => {
      value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  function formatTimestamp(date) {
    const pad = number => String(number).padStart(2, '0');
    return date.getFullYear() + '.' + pad(date.getMonth() + 1) + '.' + pad(date.getDate()) +
      '  ' + pad(date.getHours()) + ':' + pad(date.getMinutes());
  }

  function wrapText(ctx, text, maxWidth) {
    const lines = [];
    let line = '';
    for (const character of text) {
      if (line && ctx.measureText(line + character).width > maxWidth && !'、，。'.includes(character)) {
        lines.push(line.trimEnd());
        line = '';
      }
      line += character;
    }
    if (line) lines.push(line.trimEnd());
    return lines;
  }

  function drawFish(ctx, fish, x, top, ink) {
    if (!fish) return;
    const width = 78;
    const height = width * fish.height / fish.width;
    const mask = document.createElement('canvas');
    mask.width = width * SCALE;
    mask.height = Math.ceil(height * SCALE);
    const tint = mask.getContext('2d');
    tint.drawImage(fish, 0, 0, mask.width, mask.height);
    tint.globalCompositeOperation = 'source-in';
    tint.fillStyle = ink;
    tint.fillRect(0, 0, mask.width, mask.height);
    ctx.save();
    ctx.globalAlpha = .65;
    // The SVG includes a small transparent margin around the original path.
    ctx.drawImage(mask, x - width / 2, top - 1.2, width, height);
    ctx.restore();
  }

  function ticketOutline(ctx, height, tearLine) {
    const left = 11;
    const right = WIDTH - left;
    const top = 8;
    const bottom = height - BOTTOM_INSET;
    const notch = 16.8;
    const teeth = 24;
    const step = (right - left) / teeth;
    ctx.beginPath();
    ctx.moveTo(left, top);
    for (let index = 1; index <= teeth; index++) {
      ctx.lineTo(left + step * (index - .5), top + TOOTH_DEPTH);
      ctx.lineTo(left + step * index, top);
    }
    ctx.lineTo(right, tearLine - notch);
    ctx.arc(right, tearLine, notch, -Math.PI / 2, Math.PI / 2, true);
    ctx.lineTo(right, bottom);
    for (let index = 1; index <= teeth; index++) {
      ctx.lineTo(right - step * (index - .5), bottom - TOOTH_DEPTH);
      ctx.lineTo(right - step * index, bottom);
    }
    ctx.lineTo(left, tearLine + notch);
    ctx.arc(left, tearLine, notch, Math.PI / 2, -Math.PI / 2, true);
    ctx.closePath();
  }

  function paintPaper(ctx, height, tearLine, palette, random) {
    ticketOutline(ctx, height, tearLine);
    ctx.clip();

    ctx.fillStyle = palette.paper;
    ctx.fillRect(0, 0, WIDTH, height);
    if (palette.glow) {
      const center = Math.min(height / 2, 440);
      const glow = ctx.createRadialGradient(WIDTH / 2, center, 0, WIDTH / 2, center, 380);
      glow.addColorStop(0, palette.glow);
      glow.addColorStop(1, palette.paper);
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, WIDTH, height);
    }
    if (palette.panel) {
      ctx.fillStyle = palette.panel;
      ctx.fillRect(0, 0, WIDTH, 162);
    }
    ctx.fillStyle = palette.grain;
    for (let i = 0; i < height * 19; i++) {
      ctx.fillRect(random() * WIDTH, random() * height, .2 + random() * 1.1, .2 + random() * .8);
    }
    ctx.strokeStyle = palette.edge;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function paintTicket({ canvas, footprint, nick, time, theme, seed, marks, fish, bodyFont, displayFont }) {
    const palette = PALETTES[theme];
    const ctx = canvas.getContext('2d');
    const columns = Math.min(3, Math.max(1, marks.length));
    const rows = Math.ceil(marks.length / columns);
    const name = nick || DEFAULT_NICK;
    ctx.font = '600 23.5px ' + bodyFont;
    const nickLines = wrapText(ctx, name, 328);
    ctx.font = '400 16.5px ' + bodyFont;
    const cinemaNames = [footprint.cv, footprint.cw].map(ids =>
      ids.map(id => Object.hasOwn(CINEMA_NAMES, id) ? CINEMA_NAMES[id] : id).join('、') || '暂无标记'
    );
    const cinemas = cinemaNames.map(names => wrapText(ctx, names, 319));
    const stampLabelSize = 14;
    ctx.font = '400 ' + stampLabelSize + 'px ' + bodyFont;
    const labelWidth = columns === 3 ? 104 : 128;
    const stamps = marks.map(mark => ({
      ...mark,
      lines: ctx.measureText(mark.title).width <= labelWidth
        ? [mark.title]
        : mark.title.split(/\s+/).flatMap(word => wrapText(ctx, word, labelWidth))
    }));

    const timeY = 229 + nickLines.length * 32;
    const marksY = timeY + 60;
    const rowHeight = 116;
    const cinemasY = marksY + (rows ? rows * rowHeight + 39 : 85);
    const cinemaTitleLine = 17;
    const cinemaTitleGap = 7;
    const cinemaLine = 28;
    const cinemaGroupGap = 21;
    const tearLine = cinemasY + 17 + 2 * (cinemaTitleLine + cinemaTitleGap) +
      (cinemas[0].length + cinemas[1].length) * cinemaLine + cinemaGroupGap + 22;
    const height = tearLine + 82;
    canvas.width = WIDTH * SCALE;
    canvas.height = height * SCALE;
    ctx.scale(SCALE, SCALE);

    const paperRandom = randomFrom(seed ^ 0xbb67ae85);
    const layoutRandom = randomFrom(seed);
    const write = (text, x, y, size, ink = palette.ink, weight = 400) => {
      ctx.font = weight + ' ' + size + 'px ' + bodyFont;
      ctx.fillStyle = ink;
      ctx.fillText(text, x, y);
    };
    const rule = (y, perforation = false) => {
      ctx.save();
      ctx.strokeStyle = perforation ? (palette.seam || 'rgba(244,240,234,.25)') : palette.rule;
      ctx.lineWidth = 1.15;
      if (perforation) ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(36, y);
      ctx.lineTo(WIDTH - 36, y);
      ctx.stroke();
      ctx.restore();
    };

    paintPaper(ctx, height, tearLine, palette, paperRandom);
    write('漫游票根', 36, 43, 14, palette.ink, 600);

    // Keep the worn ink within the original Dragon Cang letterforms.
    const inkTile = document.createElement('canvas');
    inkTile.width = inkTile.height = 108;
    const ink = inkTile.getContext('2d');
    ink.fillStyle = palette.title;
    ink.fillRect(0, 0, 108, 108);
    ink.fillStyle = palette.titleGrain;
    for (let i = 0; i < 330; i++) {
      ink.fillRect(paperRandom() * 108, paperRandom() * 108, .45 + paperRandom() * 1.8, .5);
    }
    ctx.font = '400 ' + TITLE_SIZE + 'px ' + displayFont;
    const titleMetrics = ctx.measureText(TITLE);
    const titleWidth = titleMetrics.actualBoundingBoxLeft + titleMetrics.actualBoundingBoxRight;
    const titleSize = titleWidth ? TITLE_SIZE * (328 * .80) / titleWidth : TITLE_SIZE;
    ctx.font = '400 ' + titleSize + 'px ' + displayFont;
    ctx.textAlign = 'center';
    ctx.fillStyle = ctx.createPattern(inkTile, 'repeat');
    ctx.fillText(TITLE, WIDTH / 2, 132);
    ctx.textAlign = 'left';
    rule(162);

    write('迷影者', 36, 196, 14, palette.muted, 500);
    nickLines.forEach((line, index) => write(line, 36, 229 + index * 32, 23.5, palette.ink, 600));
    write(time, 36, timeY, 14, palette.muted);
    rule(timeY + 24);

    write('点亮的展区', 36, marksY, 17, palette.ink, 600);
    ctx.textAlign = 'right';
    write(marks.length + ' 个', WIDTH - 36, marksY, 15, palette.muted);
    ctx.textAlign = 'left';
    if (!marks.length) write('还没有点亮展区', 36, marksY + 43, 16, palette.muted);

    // Keep the title beneath its stamp while shuffling and slightly varying each position.
    const scattered = stamps.map(mark => ({ ...mark, order: layoutRandom() }));
    scattered.sort((a, b) => a.order - b.order);
    ctx.textAlign = 'center';
    scattered.forEach((mark, index) => {
      const row = Math.floor(index / columns);
      const columnsHere = Math.min(columns, scattered.length - row * columns);
      const columnWidth = 328 / columnsHere;
      const x = 36 + columnWidth * (index % columns + .5) + (layoutRandom() - .5) * 10;
      const y = marksY + 59 + row * rowHeight;
      const color = palette.marks[mark.colorIndex % palette.marks.length];
      drawExhibitIcon(ctx, mark.image, x, y, color);
      mark.lines.forEach((line, lineIndex) => write(line, x, y + 49 + lineIndex * 20, stampLabelSize, palette.ink));
    });
    ctx.textAlign = 'left';

    rule(cinemasY - 11);
    let cursor = cinemasY + 17;
    ctx.textBaseline = 'top';
    cinemas.forEach((lines, index) => {
      if (index) cursor += cinemaGroupGap;
      write(index === 0 ? '去过的影院' : '想去的影院', 36, cursor, 14, palette.list, 500);
      cursor += cinemaTitleLine + cinemaTitleGap;
      lines.forEach(line => {
        write(line, 36, cursor, 16.5);
        cursor += cinemaLine;
      });
    });

    ctx.textBaseline = 'alphabetic';
    rule(tearLine, true);
    const websiteSize = 15;
    ctx.font = '400 ' + websiteSize + 'px ' + bodyFont;
    const { actualBoundingBoxAscent: ascent, actualBoundingBoxDescent: descent } = ctx.measureText(WEBSITE);
    const footerCenter = (tearLine + height - BOTTOM_INSET - TOOTH_DEPTH) / 2;
    const textTop = footerCenter - (ascent + descent) / 2;
    write(WEBSITE, 36, textTop + ascent, websiteSize, palette.muted);
    drawFish(ctx, fish, 325, textTop, palette.muted);

    return {
      source: canvas.toDataURL('image/png'),
      alt: [TITLE, name, time, '点亮的展区 ' + (marks.map(mark => mark.title).join('、') || '暂无'),
        '去过的影院 ' + cinemaNames[0], '想去的影院 ' + cinemaNames[1], WEBSITE].join('。')
    };
  }

  function downloadImage(canvas) {
    const backed = document.createElement('canvas');
    backed.width = canvas.width;
    backed.height = canvas.height;
    const ctx = backed.getContext('2d');
    ctx.fillStyle = BACKING;
    ctx.fillRect(0, 0, backed.width, backed.height);
    ctx.drawImage(canvas, 0, 0);
    return backed.toDataURL('image/png');
  }

  function createController(roamObjectPath) {
    const byId = id => document.getElementById(id);
    const modal = byId('ticket-modal');
    if (!modal) return null;

    const sheet = byId('ticket-sheet');
    const scroll = byId('ticket-scroll');
    const preview = byId('ticket-preview-img');
    const closeButton = byId('ticket-close-btn');
    const download = byId('ticket-download-btn');
    const edit = byId('ticket-edit');
    const nickname = byId('ticket-nickname');
    const status = byId('ticket-status');
    const canvas = document.createElement('canvas');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const style = getComputedStyle(document.documentElement);
    const bodyFont = style.getPropertyValue('--font-body').trim();
    const displayFont = style.getPropertyValue('--font-display').trim();
    let focusReturn, theme = 'dark', seed, time, printing, animation, statusTimer, printedNickname;
    // 票根固定采用「午夜蓝与玫红」暗色版（101 夜款），已移除纸面/朱红配色切换。
    let renderVersion = 0;

    function stopPrinting() {
      animation?.cancel();
      animation = null;
    }

    function print() {
      const height = preview.offsetHeight;
      const feed = Math.min(height, scroll.clientHeight + 26);
      if (!height || !feed || reduced.matches || !sheet.animate) return;
      const frame = (distance, offset) => {
        const edge = Array.from({ length: 41 }, (_, index) => {
          const x = 100 - index * 100 / 40;
          const y = Math.max(0, distance - (index % 2 ? 4.2 : 0));
          return x + '% ' + y + 'px';
        });
        return { clipPath: 'polygon(0 0, 100% 0, ' + edge.join(', ') + ')', offset };
      };
      animation = sheet.animate([
        frame(0, 0), frame(feed * .05, .11), frame(feed * .36, .34),
        frame(feed * .36, .41), frame(feed * .73, .69), frame(feed * .73, .75),
        frame(feed, .98), frame(height, 1)
      ], { duration: 1280, easing: 'linear' });
    }

    function showStatus(message) {
      clearTimeout(statusTimer);
      status.textContent = message;
      if (message) statusTimer = setTimeout(() => { status.textContent = ''; }, 3800);
    }

    async function render() {
      const version = ++renderVersion;
      download.disabled = true;
      const footprint = window.MujianFootprint.getFootprint();
      const nick = footprint.nick || footprint.noteNick || '';
      nickname.placeholder = footprint.noteNick || DEFAULT_NICK;
      const lit = new Set(footprint.mods);
      const modules = window.MujianRoutes.getEnabledModules().filter(module => lit.has(module.id));
      const [marks, fish] = await Promise.all([
        Promise.all(modules.map(async module => ({
          title: module.title.trim(), colorIndex: module.num - 1, image: await loadExhibitIcon(roamObjectPath(module.id))
        }))),
        loadPosterArt('fish'),
        document.fonts.load('400 ' + TITLE_SIZE + 'px ' + displayFont, TITLE).catch(() => [])
      ]);
      if (version !== renderVersion || !modal.open) return;
      try {
        const ticket = paintTicket({ canvas, footprint, nick, time, theme, seed, marks, fish, bodyFont, displayFont });
        preview.src = ticket.source;
        await preview.decode();
        if (version !== renderVersion || !modal.open) return;
        printedNickname = nick;
        preview.alt = ticket.alt;
        preview.hidden = false;
        download.disabled = false;
        if (printing) {
          printing = false;
          print();
        }
      } catch {
        if (version === renderVersion) showStatus('票根生成失败，可切换款式重试。');
      }
    }

    function open(trigger) {
      if (modal.open) return;
      focusReturn = trigger || byId('ticket-open-btn');
      seed = Math.floor(Math.random() * 4294967296);
      time = formatTimestamp(new Date());
      printing = true;
      preview.hidden = true;
      edit.open = false;
      const footprint = window.MujianFootprint.getFootprint();
      nickname.value = footprint.nick;
      showStatus('');
      modal.setAttribute('aria-labelledby', 'ticket-title');
      modal.showModal();
      document.body.classList.add('is-ticket-open');
      scroll.scrollTop = 0;
      closeButton.focus({ preventScroll: true });
      render();
    }

    function close() {
      if (!modal.open) return;
      ++renderVersion;
      stopPrinting();
      modal.close();
      document.body.classList.remove('is-ticket-open');
      if (location.hash === '#ticket') history.replaceState(null, '', '#hall');
      focusReturn?.focus({ preventScroll: true });
    }

    closeButton.addEventListener('click', close);
    modal.addEventListener('cancel', event => {
      event.preventDefault();
      close();
    });
    modal.addEventListener('click', event => {
      if (event.target === modal) close();
    });
    reduced.addEventListener('change', () => { if (reduced.matches) stopPrinting(); });

    byId('ticket-nickname-form').addEventListener('submit', event => {
      event.preventDefault();
      edit.open = false;
      edit.querySelector('summary').focus();
      window.MujianFootprint.setNickname(nickname.value.trim());
    });
    download.addEventListener('click', () => {
      const link = document.createElement('a');
      link.href = downloadImage(canvas);
      const name = printedNickname.replace(/[\\/:*?"<>|]/g, '').slice(0, 24) || DEFAULT_NICK;
      link.download = '幕间漫游-' + name + '-101夜.png';
      link.click();
      showStatus('已开始下载，也可长按图片保存。');
    });
    function refreshOpenTicket() {
      if (modal.open) render();
    }

    window.addEventListener('mujian:footprint-change', refreshOpenTicket);
    window.addEventListener('focus', refreshOpenTicket);
    window.addEventListener('storage', event => {
      if (event.key === 'mujian.footprint.v1') refreshOpenTicket();
    });

    return { open, close, isOpen: () => modal.open };
  }

  window.MujianTicket = { createController };
})();
