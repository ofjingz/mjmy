(function () {
  'use strict';

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const page = document.body;
  const sessionKey = 'linli-reading-return-v1';
  const opening = document.getElementById('opening');
  const exhibit = document.getElementById('exhibit');
  const timeline = document.querySelector('.timeline-links');
  const stations = new Map(Array.from(document.querySelectorAll('.station'), function (station) {
    return [station.id, station];
  }));
  let current = null;

  function remember(link) {
    const route = new URL(link.href);
    const from = route.searchParams.get('from') || 'opening';
    try {
      sessionStorage.setItem(sessionKey, JSON.stringify({
        from: from,
        scene: current ? current.id : 'opening'
      }));
    } catch (_) {
      // On restricted browsers the return link goes to the active station.
    }
  }

  const allowedStops = new Set(['opening', 'seaside', 'access', 'nordic', 'lassnig', 'film16', 'europe', 'ageing']);
  const params = new URLSearchParams(window.location.search);
  const visitedFrom = params.get('via');
  const hubView = visitedFrom === 'hall' || visitedFrom === 'catalog' ? visitedFrom : null;
  const roamSeed = hubView && params.get('roam');
  function carryHubView(url) {
    if (hubView) url.searchParams.set('via', hubView);
    if (roamSeed) url.searchParams.set('roam', roamSeed);
    return url;
  }

  const from = params.get('from');
  const backLink = document.querySelector('[data-back]');
  if (backLink) {
    const target = carryHubView(new URL(backLink.href));
    if (allowedStops.has(from)) {
      target.searchParams.set('resume', from);
      target.hash = from;
    }
    backLink.href = target;
  }

  document.querySelectorAll('[data-essay]').forEach(function (link) {
    if (hubView) link.href = carryHubView(new URL(link.href));
    link.addEventListener('click', function (e) {
      if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) remember(link);
    });
  });

  const resume = params.get('resume');
  let saved = null;
  if (exhibit && allowedStops.has(resume)) {
    try {
      const stored = JSON.parse(sessionStorage.getItem(sessionKey));
      if (stored && stored.from === resume) saved = stored;
    } catch (_) {
      // The embedded anchor is also a usable return position.
    }
  }

  if (opening && exhibit && timeline && stations.size) {
    const links = Array.from(timeline.querySelectorAll('[data-stop]'));
    let cancelMotion = null;

    function showScene(station) {
      if (cancelMotion) cancelMotion();
      current = station || null;
      opening.hidden = Boolean(current);
      exhibit.hidden = !current;
      page.classList.toggle('scene-open', Boolean(current));
      stations.forEach(function (scene) { scene.hidden = scene !== current; });
      if (!current) return;

      links.forEach(function (link) {
        if (link.hash === '#' + current.id) {
          link.setAttribute('aria-current', 'location');
          const outer = timeline.getBoundingClientRect();
          const inner = link.getBoundingClientRect();
          if (inner.right > outer.right || inner.left < outer.left) {
            timeline.scrollLeft += inner.left - outer.left - 12;
          }
        } else {
          link.removeAttribute('aria-current');
        }
      });
      const nextLink = current.querySelector('.frame-far');
      const next = nextLink && stations.get(nextLink.hash.slice(1));
      const incomingPhoto = next && next.querySelector('.frame-main img');
      if (incomingPhoto) incomingPhoto.loading = 'eager';
    }

    function animateScreen(source, destination) {
      const frame = destination.querySelector('.frame-main');
      const face = frame.querySelector('img') || frame;
      if (reduced.matches || typeof face.animate !== 'function') return;
      const end = face.getBoundingClientRect();
      if (!source || !end.width || !end.height) {
        const fade = frame.animate([{ opacity: .28 }, { opacity: 1 }], { duration: 280, easing: 'ease-out' });
        cancelMotion = function () { fade.cancel(); cancelMotion = null; };
        return;
      }

      const layer = document.createElement('div');
      layer.className = 'screen-flight';
      layer.setAttribute('aria-hidden', 'true');
      Object.assign(layer.style, {
        left: source.rect.left + 'px', top: source.rect.top + 'px',
        width: source.rect.width + 'px', height: source.rect.height + 'px'
      });
      layer.appendChild(source.face);
      page.appendChild(layer);
      const translation = 'translate(' + (end.left - source.rect.left) + 'px, ' + (end.top - source.rect.top) + 'px)';
      const scale = 'scale(' + (end.width / source.rect.width) + ', ' + (end.height / source.rect.height) + ')';
      const timing = { duration: 510, easing: 'cubic-bezier(.23,.67,.31,1)' };
      const flight = layer.animate([
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { opacity: 1, offset: .65 },
        { transform: translation + ' ' + scale, opacity: 0 }
      ], timing);
      const arrival = frame.animate([{ opacity: 0 }, { opacity: 0, offset: .63 }, { opacity: 1 }], timing);
      cancelMotion = function () {
        flight.cancel();
        arrival.cancel();
        layer.remove();
        cancelMotion = null;
      };
      flight.onfinish = cancelMotion;
    }

    function projectionFrom(link, id) {
      const screen = link.matches('.frame-far, .opening-light') ? link
        : (!current && id === 'seaside' ? opening.querySelector('.opening-light') : null);
      const face = screen && screen.querySelector('img, .frame-far-title');
      if (!face || (face.tagName === 'IMG' && !face.naturalWidth)) return null;
      const rect = face.getBoundingClientRect();
      return rect.width && rect.height ? { rect: rect, face: face.cloneNode(true) } : null;
    }

    function locationScene() {
      const id = window.location.hash.slice(1);
      return stations.get(id.replace(/^album-/, '')) || null;
    }

    page.classList.add('scene-ready');
    showScene(saved && saved.scene ? stations.get(saved.scene) : locationScene());

    window.addEventListener('pageshow', function () {
      if (saved) {
        const target = carryHubView(new URL('./', window.location.href));
        target.hash = current ? current.id : 'opening';
        history.replaceState(null, '', target);
      }
      if (current && !window.location.hash.startsWith('#album-')) window.scrollTo(0, 0);
    }, { once: true });

    document.addEventListener('click', function (e) {
      const link = e.target.closest('[data-scene-link]');
      if (!link || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const id = link.hash.slice(1);
      const next = stations.get(id);
      if (!next && id !== 'opening') return;
      e.preventDefault();
      if (next === current) { window.scrollTo(0, 0); return; }

      const source = next && !reduced.matches ? projectionFrom(link, id) : null;
      showScene(next);
      history.pushState(null, '', link.hash);
      window.scrollTo(0, 0);
      const heading = next ? next.querySelector('h2') : opening.querySelector('h1');
      heading.focus({ preventScroll: true });
      if (next) animateScreen(source, next);
    });

    window.addEventListener('hashchange', function () {
      const station = locationScene();
      const hash = window.location.hash;
      if (!station && hash && hash !== '#opening') return;
      if (station !== current) showScene(station);
      if (!hash.startsWith('#album-')) window.scrollTo(0, 0);
    });
  }

  const viewer = document.querySelector('.viewer');
  // Older browsers can still follow the links to an inline album or source image.
  if (viewer && typeof viewer.showModal === 'function') {
    page.classList.add('gallery-ready');
    const photo = viewer.querySelector('figure img');
    const title = viewer.querySelector('[data-viewer-title]');
    const caption = viewer.querySelector('figcaption');
    const prev = viewer.querySelector('[data-prev]');
    const next = viewer.querySelector('[data-next]');
    const thumbs = viewer.querySelector('[data-thumbnails]');
    let photos = [];
    let index = 0;
    let trigger = null;
    let touchStart = null;
    let photoRevision = 0;

    function showPhoto(n) {
      if (n < 0 || n >= photos.length) return;
      index = n;
      const item = photos[index];
      const name = item.dataset.caption;
      const revision = ++photoRevision;
      photo.classList.add('photo-loading');
      photo.src = item.href;
      photo.alt = name;
      caption.textContent = name;
      photo.decode().then(function () {
        if (revision === photoRevision) photo.classList.remove('photo-loading');
      }, function () {
        if (revision === photoRevision) caption.textContent = '图片暂时无法打开。';
      });
      prev.disabled = index === 0;
      next.disabled = index === photos.length - 1;
      const oldThumb = thumbs.querySelector('[aria-current]');
      const activeThumb = thumbs.children[index];
      if (oldThumb && oldThumb !== activeThumb) {
        oldThumb.removeAttribute('aria-current');
        oldThumb.tabIndex = -1;
      }
      activeThumb.setAttribute('aria-current', 'true');
      activeThumb.tabIndex = 0;
      if (oldThumb && thumbs.contains(document.activeElement)) activeThumb.focus({ preventScroll: true });
      const strip = thumbs.getBoundingClientRect();
      const button = activeThumb.getBoundingClientRect();
      if (button.left < strip.left || button.right > strip.right) {
        thumbs.scrollLeft += button.left - strip.left - (strip.width - button.width) / 2;
      }
    }

    function openGallery(link) {
      const station = link.closest('.station');
      if (!station) return false;
      photos = Array.from(station.querySelectorAll('.photo-grid a[data-photo]'));
      const selected = photos.findIndex(function (item) { return item.dataset.photo === link.dataset.photo; });
      if (!photos.length) return false;
      trigger = link;
      const stats = station.querySelector('.ageing-stats');
      title.textContent = station.querySelector('h2').textContent + (stats ? ' · ' + stats.textContent : '');
      thumbs.replaceChildren(...photos.map(function (item, i) {
        const button = document.createElement('button');
        const thumbnail = document.createElement('img');
        button.type = 'button';
        button.value = String(i);
        button.tabIndex = -1;
        button.setAttribute('aria-label', item.dataset.caption);
        thumbnail.src = item.querySelector('img').src;
        thumbnail.alt = '';
        thumbnail.loading = 'lazy';
        button.appendChild(thumbnail);
        return button;
      }));
      viewer.showModal();
      page.classList.add('viewer-open');
      showPhoto(Math.max(0, selected));
      return true;
    }

    document.addEventListener('click', function (e) {
      const link = e.target.closest('a[data-photo], [data-album-jump]');
      if (!link || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (openGallery(link)) e.preventDefault();
    });

    const albumHash = window.location.hash.startsWith('#album-');
    const directGallery = albumHash && current && current.querySelector('[data-album-jump]');
    if (directGallery) openGallery(directGallery);

    thumbs.addEventListener('click', function (e) {
      const button = e.target.closest('button');
      if (button) showPhoto(Number(button.value));
    });
    prev.addEventListener('click', function () { showPhoto(index - 1); });
    next.addEventListener('click', function () { showPhoto(index + 1); });
    viewer.addEventListener('close', function () {
      photoRevision++;
      photo.removeAttribute('src');
      thumbs.replaceChildren();
      page.classList.remove('viewer-open');
      if (trigger) trigger.focus({ preventScroll: true });
    });
    viewer.addEventListener('click', function (e) {
      if (e.target !== viewer) return;
      const bounds = viewer.getBoundingClientRect();
      if (e.clientX < bounds.left || e.clientX > bounds.right || e.clientY < bounds.top || e.clientY > bounds.bottom) viewer.close();
    });
    viewer.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); showPhoto(index - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); showPhoto(index + 1); }
    });
    photo.addEventListener('touchstart', function (e) {
      touchStart = e.touches[0] || null;
    }, { passive: true });
    photo.addEventListener('touchend', function (e) {
      if (!touchStart || !e.changedTouches[0]) return;
      const end = e.changedTouches[0];
      const distance = end.clientX - touchStart.clientX;
      if (Math.abs(distance) > 48 && Math.abs(end.clientY - touchStart.clientY) < 44) showPhoto(index + (distance < 0 ? 1 : -1));
      touchStart = null;
    }, { passive: true });
  } else {
    document.querySelectorAll('[data-album-jump]').forEach(function (link) {
      link.addEventListener('click', function () {
        const album = document.getElementById(link.hash.slice(1));
        const browse = album && album.querySelector('details');
        if (browse) browse.open = true;
      });
    });
  }

  const canvas = document.getElementById('sea-grain');
  if (!canvas || reduced.matches || !('IntersectionObserver' in window)) return;
  const context = canvas.getContext('2d');
  if (!context) return;

  const points = Array.from({ length: 96 }, function (_, i) {
    return {
      x: Math.random(),
      depth: Math.random(),
      phase: Math.random() * Math.PI * 2,
      speed: .15 + Math.random() * .22,
      short: i % 4 === 0
    };
  });
  let width, height;
  let frame = 0;
  let visible = false;
  let last = 0;

  function size() {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    const density = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * density);
    canvas.height = Math.round(height * density);
    context.setTransform(density, 0, 0, density, 0, 0);
  }

  function draw(ms) {
    frame = 0;
    if (!visible || document.hidden || reduced.matches) return;
    if (ms - last >= 40) {
      last = ms;
      const seconds = ms / 1000;
      context.clearRect(0, 0, width, height);
      points.forEach(function (p) {
        const ray = p.x > .53 && p.x < .78;
        const y = height * (.57 + p.depth * .34) + Math.sin(seconds * p.speed + p.phase) * (1 + 4 * p.depth);
        const x = width * p.x + Math.sin(seconds * .12 + p.phase) * 8;
        const opacity = (.045 + .15 * (1 + Math.sin(seconds * p.speed + p.phase)) / 2) * (ray ? 1.2 : .8);
        context.fillStyle = ray ? 'rgba(254, 219, 169, ' + opacity + ')' : 'rgba(197, 221, 249, ' + opacity + ')';
        context.fillRect(x, y, p.short ? 1 : 2 + p.depth * 3, p.short ? 1.1 : .7);
      });
    }
    frame = window.requestAnimationFrame(draw);
  }

  function sync() {
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    if (visible && !document.hidden && !reduced.matches) frame = window.requestAnimationFrame(draw);
  }

  new IntersectionObserver(function (records) {
    visible = records[0].isIntersecting;
    sync();
  }).observe(canvas);
  window.addEventListener('resize', size);
  document.addEventListener('visibilitychange', sync);
  if (reduced.addEventListener) reduced.addEventListener('change', sync);
  size();
}());
