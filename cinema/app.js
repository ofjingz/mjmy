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
      ? '选择保存在当前浏览器。去过与想去可同时标记。'
      : '当前浏览器无法保存选择，关闭或刷新后可能丢失。请先保存票根或导出记录。';
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

  function listTicket(id, list) {
    const element = $(id); element.replaceChildren();
    if (!list.length) {
      const li = document.createElement('li'); li.className = 'no-selection';
      li.textContent = '尚未标记'; element.append(li); return;
    }
    for (const cinema of list) {
      const li = document.createElement('li'); li.textContent = `${cinema.city} ${cinema.name}${byId.get(cinema.id)?.originalName ? '（'+byId.get(cinema.id).originalName+'）' : ''}`;
      const city = document.createElement('small'); city.textContent = cinema.city;
      element.append(li);
    }
  }

  function dateLabel(date) {
    const d = new Date(date);
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
  }

  function renderTicket() {
    ticketSnapshot = store.snapshot(cinemas);
    $('visited-count').textContent = ticketSnapshot.counts.visited;
    $('wishlist-count').textContent = ticketSnapshot.counts.wishlist;
    $('ticket-date').textContent = dateLabel(ticketSnapshot.generatedAt);
    $('ticket-number').textContent = `NO. ${ticketSnapshot.visitId.replace(/[^a-z0-9]/gi, '').slice(-10).toUpperCase()}`;
    listTicket('visited-list', ticketSnapshot.visited);
    listTicket('wishlist-list', ticketSnapshot.wishlist);
    renderMarks();
    window.dispatchEvent(new CustomEvent('mujian:cinema-ticket', { detail: JSON.parse(JSON.stringify(ticketSnapshot)) }));
  }

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = name;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  }

  function ticketCanvas(snapshot) {
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    const ctx = canvas.getContext('2d');
    const wrap = (text, maxWidth) => {
      const lines = []; let line = '';
      for (const character of String(text)) {
        if (line && ctx.measureText(line + character).width > maxWidth) { lines.push(line); line = character; }
        else line += character;
      }
      if (line) lines.push(line);
      return lines;
    };
    ctx.font = '26px sans-serif';
    const groups = [['去过的影院', snapshot.visited], ['想去的影院', snapshot.wishlist]].map(([title, list]) => ({
      title,
      items: list.map((cinema) => ({ lines: wrap(`${cinema.city} ${cinema.name}${byId.get(cinema.id)?.originalName ? '（'+byId.get(cinema.id).originalName+'）' : ''}`, 730), city: cinema.city })),
    }));
    canvas.height = 670 + groups.reduce((height, group) => height + 85 + Math.max(1, group.items.length) * 42 + group.items.reduce((n, item) => n + item.lines.length * 34, 0), 0);
    ctx.fillStyle = '#0D0D0F'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#F2EFE9'; ctx.fillRect(45, 45, 910, canvas.height - 90);
    ctx.fillStyle = '#a48455'; ctx.fillRect(45, 45, 910, 12);
    ctx.fillStyle = '#25232a'; ctx.font = '24px sans-serif'; ctx.fillText('幕间漫游 / 影院星球', 96, 118);
    ctx.font = '20px monospace'; ctx.fillText(dateLabel(snapshot.generatedAt), 737, 118);
    ctx.strokeStyle = '#aaa99e'; ctx.beginPath(); ctx.moveTo(96, 153); ctx.lineTo(904, 153); ctx.stroke();
    ctx.font = '100px -apple-system, "PingFang SC", "Noto Sans SC", sans-serif'; ctx.fillText(String(snapshot.counts.visited), 160, 290); ctx.fillText(String(snapshot.counts.wishlist), 580, 290);
    ctx.font = '25px sans-serif'; ctx.fillText('去过', 270, 280); ctx.fillText('想去', 690, 280);
    ctx.fillStyle = '#8A8882'; ctx.font = '57px sans-serif'; ctx.fillText('↗', 465, 268);
    ctx.strokeStyle = '#aaa99e'; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(73, 335); ctx.lineTo(927, 335); ctx.stroke(); ctx.setLineDash([]);
    let y = 395;
    for (const group of groups) {
      ctx.fillStyle = '#6d5c42'; ctx.font = '23px sans-serif'; ctx.fillText(group.title, 96, y); y += 48;
      if (!group.items.length) { ctx.fillStyle = '#707067'; ctx.font = '23px sans-serif'; ctx.fillText('尚未标记', 96, y); y += 42; }
      group.items.forEach((item, index) => {
        ctx.fillStyle = '#35343a'; ctx.font = '26px sans-serif';
        ctx.fillText(pad(index + 1), 96, y);
        item.lines.forEach((line) => { ctx.fillText(line, 150, y); y += 34; });
        y += 30;
      });
      y += 37;
    }
    ctx.strokeStyle = '#aaa99e'; ctx.beginPath(); ctx.moveTo(96, y); ctx.lineTo(904, y); ctx.stroke();
    ctx.fillStyle = '#66665e'; ctx.font = '18px monospace';
    ctx.fillText('NO. ' + snapshot.visitId.replace(/[^a-z0-9]/gi, '').slice(-10).toUpperCase(), 96, y + 42);
    ctx.font = '18px sans-serif'; ctx.fillText('本次观展记录', 791, y + 42);
    return canvas;
  }

  $('open-directory').addEventListener('click', showDirectory);
  $('cinema-search').addEventListener('input', renderDirectory);
  $('open-ticket').addEventListener('click', () => { renderTicket(); openDialog('ticket-dialog'); });
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
  $('save-ticket').addEventListener('click', () => {
    if (!ticketSnapshot) return;
    const snapshot = JSON.parse(JSON.stringify(ticketSnapshot));
    ticketCanvas(snapshot).toBlob((blob) => {
      if (!blob) { notify('图片生成失败，请导出影院记录'); return; }
      download(blob, `幕间漫游_影院票根_${dateLabel(snapshot.generatedAt)}.png`);
      notify('票根图片已生成');
    }, 'image/png');
  });
  $('export-record').addEventListener('click', () => {
    if (!ticketSnapshot) return;
    download(new Blob([JSON.stringify(ticketSnapshot, null, 2)], { type: 'application/json;charset=utf-8' }), `幕间漫游_影院记录_${dateLabel(ticketSnapshot.generatedAt)}.json`);
    notify('影院记录已导出');
  });
  $('reset-visit').addEventListener('click', () => {
    store.reset(); renderTicket(); renderMarks();
    $('ticket-dialog').querySelector('details').open = false;
    notify('已开始新的观展');
    window.dispatchEvent(new CustomEvent('mujian:cinema-record-change', { detail: { visitId: store.getState().visitId, summary: store.summary(cinemas) } }));
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
    if (event.matches) { stopTour(); planet?.setRunning(false); }
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
