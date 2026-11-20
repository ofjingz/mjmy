(function () {
  'use strict';

  var DATA_URL = './data.json';

  var allSections = [];
  var allPhotos = [];
  var activeFilterId = 'all';
  var visiblePhotos = [];
  var lightboxIndex = 0;
  var lastFocusedEl = null;

  function isChineseChapterHeading(text) {
    return /^[一二三四五六七八九十]+、/.test(text.trim());
  }

  function isNumberedMoment(text) {
    return /^\d+、/.test(text.trim());
  }

  function isRawCodeCaption(caption) {
    var c = String(caption || '').trim();
    if (!c) return true;
    return /^(?:\d+|IMG_[\d_]+|DSC\d+|微信图片_[\d_]+|[0-9a-f]{24,})$/i.test(c);
  }

  /* 瞬间内嵌媒体（图/视频），数据来自 data.json 的 momentMedia */
  function renderMomentMedia(card, media) {
    if (!Array.isArray(media) || !media.length) return;
    var wrap = document.createElement('div');
    wrap.className = 'moment-media';

    media.forEach(function (m) {
      var fig = document.createElement('figure');
      var cap = typeof m.caption === 'string' ? m.caption.trim() : '';

      if (m.type === 'video') {
        fig.className = 'moment-video';
        var v = document.createElement('video');
        v.controls = true;
        v.preload = 'metadata';
        v.playsInline = true;
        v.setAttribute('playsinline', '');
        v.src = './' + String(m.src || '').replace(/^\.\//, '');
        if (m.poster) v.poster = './' + String(m.poster).replace(/^\.\//, '');
        v.width = 960;
        v.height = 540;
        fig.appendChild(v);
      } else {
        fig.className = 'moment-figure';
        var img = document.createElement('img');
        img.loading = 'lazy';
        img.decoding = 'async';
        img.src = './' + String(m.src || '').replace(/^\.\//, '');
        img.alt = cap;
        if (m.w && m.h) { img.width = m.w; img.height = m.h; }
        fig.appendChild(img);
      }

      if (cap) {
        var c = document.createElement('figcaption');
        c.textContent = cap;
        fig.appendChild(c);
      }
      wrap.appendChild(fig);
    });

    card.appendChild(wrap);
  }

  function renderNotes(blocks, momentMedia) {
    var mm = momentMedia || {};
    var container = document.getElementById('notesBody');
    if (!container) return;
    container.innerHTML = '';

    var list = Array.isArray(blocks) ? blocks : [];
    var momentsWrap = null;
    var lastMomentCard = null;
    var activeLetterBox = null;

    list.forEach(function (block) {
      if (block.type !== 'paragraph') return;
      var text = typeof block.text === 'string' ? block.text : '';
      var trimmed = text.trim();

      if (isChineseChapterHeading(trimmed)) {
        momentsWrap = null;
        lastMomentCard = null;
        activeLetterBox = null;
        var h2 = document.createElement('h3');
        h2.className = 'note-chapter';
        h2.textContent = text;
        container.appendChild(h2);
        return;
      }

      if (isNumberedMoment(trimmed)) {
        activeLetterBox = null;
        if (!momentsWrap) {
          momentsWrap = document.createElement('div');
          momentsWrap.className = 'moments-list';
          container.appendChild(momentsWrap);
        }
        var card = document.createElement('article');
        card.className = 'moment-card';

        var p = document.createElement('p');
        p.className = 'moment-text';
        p.textContent = text;
        card.appendChild(p);

        var mediaList = mm[String(parseInt(trimmed, 10))];
        if (mediaList) renderMomentMedia(card, mediaList);

        momentsWrap.appendChild(card);
        lastMomentCard = card;
        return;
      }

      // 紧随 numbered moment 的来信引文段落（例如第 8 条 Topshe 的三段回信）
      if (lastMomentCard && momentsWrap) {
        if (!activeLetterBox) {
          activeLetterBox = document.createElement('blockquote');
          activeLetterBox.className = 'moment-letter';
          lastMomentCard.appendChild(activeLetterBox);
        }
        var lp = document.createElement('p');
        lp.textContent = text;
        activeLetterBox.appendChild(lp);
        return;
      }

      var para = document.createElement('p');
      para.className = 'note-p';
      para.textContent = text;
      container.appendChild(para);
    });
  }

  function flattenPhotos(sections) {
    var out = [];
    sections.forEach(function (sec) {
      var photos = Array.isArray(sec.photos) ? sec.photos : [];
      photos.forEach(function (ph) {
        out.push({
          sectionId: sec.id,
          sectionTitle: sec.title,
          src: './' + String(ph.src || '').replace(/^\.\//, ''),
          event: String(ph.event || '').replace(/^\d+、\s*/, ''),
          caption: ph.caption || ''
        });
      });
    });
    return out;
  }

  function renderFilterBar() {
    var bar = document.getElementById('filterBar');
    if (!bar) return;
    bar.innerHTML = '';

    var tabs = [{ id: 'all', title: '全部现场' }].concat(
      allSections.map(function (sec) {
        return {
          id: sec.id,
          title: sec.title
        };
      })
    );

    tabs.forEach(function (tab) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'filter-pill' + (tab.id === activeFilterId ? ' is-active' : '');
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', tab.id === activeFilterId ? 'true' : 'false');
      btn.setAttribute('data-filter-id', tab.id);

      btn.textContent = tab.title;
      btn.addEventListener('click', function () {
        if (activeFilterId === tab.id) return;
        activeFilterId = tab.id;
        updateFilterState();
        renderArchiveGrid();
      });

      bar.appendChild(btn);
    });
  }

  function updateFilterState() {
    var pills = document.querySelectorAll('.filter-pill');
    for (var i = 0; i < pills.length; i++) {
      var isAct = pills[i].getAttribute('data-filter-id') === activeFilterId;
      pills[i].classList.toggle('is-active', isAct);
      pills[i].setAttribute('aria-selected', isAct ? 'true' : 'false');
    }
  }

  function renderArchiveGrid() {
    var grid = document.getElementById('archiveGrid');
    if (!grid) return;

    if (activeFilterId === 'all') {
      visiblePhotos = allPhotos.slice();
    } else {
      visiblePhotos = allPhotos.filter(function (p) { return p.sectionId === activeFilterId; });
    }

    grid.innerHTML = '';

    visiblePhotos.forEach(function (photo, idx) {
      var card = document.createElement('figure');
      card.className = 'photo-card';

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'photo-card-btn';
      btn.setAttribute('aria-label', '放大查看 ' + (photo.event || photo.sectionTitle));
      btn.addEventListener('click', function () {
        openLightbox(idx, btn);
      });

      var img = document.createElement('img');
      img.src = photo.src;
      img.alt = photo.event ? (photo.event + ' — ' + photo.sectionTitle) : photo.sectionTitle;
      img.loading = 'lazy';
      img.decoding = 'async';
      btn.appendChild(img);

      var meta = document.createElement('figcaption');
      meta.className = 'photo-card-meta';

      var topRow = document.createElement('div');
      topRow.className = 'photo-card-top';

      var tag = document.createElement('span');
      tag.className = 'photo-sec-tag';
      tag.textContent = photo.sectionTitle;


      topRow.appendChild(tag);
      meta.appendChild(topRow);

      if (photo.event) {
        var ev = document.createElement('p');
        ev.className = 'photo-event';
        ev.textContent = photo.event;
        meta.appendChild(ev);
      }

      if (photo.caption && !isRawCodeCaption(photo.caption)) {
        var cap = document.createElement('p');
        cap.className = 'photo-caption-note';
        cap.textContent = photo.caption;
        meta.appendChild(cap);
      }

      card.appendChild(btn);
      card.appendChild(meta);
      grid.appendChild(card);
    });
  }

  function initSectionTabsScrollSpy() {
    var tabs = document.querySelectorAll('[data-sec-tab]');
    var archiveSec = document.getElementById('archive-section');
    if (!tabs.length || !archiveSec) return;

    var ticking = false;
    function syncActiveTab() {
      ticking = false;
      var inArchive = archiveSec.getBoundingClientRect().top <= 160;
      var targetId = inArchive ? 'archive-section' : 'notes-section';
      for (var i = 0; i < tabs.length; i++) {
        tabs[i].classList.toggle('is-active', tabs[i].getAttribute('data-sec-tab') === targetId);
      }
    }

    window.addEventListener('scroll', function () {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(syncActiveTab);
      }
    }, { passive: true });
    syncActiveTab();
  }

  /* ===== Lightbox ===== */
  function openLightbox(idx, triggerEl) {
    lightboxIndex = idx;
    lastFocusedEl = triggerEl || document.activeElement;
    var lb = document.getElementById('lightbox');
    if (!lb) return;
    lb.hidden = false;
    document.body.style.overflow = 'hidden';
    renderLightboxFrame();
    var closeBtn = document.getElementById('lbClose');
    if (closeBtn) closeBtn.focus();
  }

  function closeLightbox() {
    var lb = document.getElementById('lightbox');
    if (!lb || lb.hidden) return;
    lb.hidden = true;
    document.body.style.overflow = '';
    if (lastFocusedEl && typeof lastFocusedEl.focus === 'function') {
      lastFocusedEl.focus();
    }
  }

  function stepLightbox(delta) {
    if (!visiblePhotos.length) return;
    lightboxIndex = (lightboxIndex + delta + visiblePhotos.length) % visiblePhotos.length;
    renderLightboxFrame();
  }

  function renderLightboxFrame() {
    var photo = visiblePhotos[lightboxIndex];
    if (!photo) return;
    var img = document.getElementById('lbImg');
    var secTag = document.getElementById('lbSectionTag');
    var evEl = document.getElementById('lbEvent');
    var detEl = document.getElementById('lbDetail');

    if (img) {
      img.src = photo.src;
      img.alt = photo.event || photo.sectionTitle;
    }
    if (secTag) secTag.textContent = photo.sectionTitle;
    if (evEl) evEl.textContent = photo.event || photo.sectionTitle;
    if (detEl) {
      detEl.textContent = photo.caption && !isRawCodeCaption(photo.caption) ? photo.caption : '';
      detEl.hidden = !detEl.textContent;
    }
  }

  function initLightbox() {
    var lb = document.getElementById('lightbox');
    if (!lb) return;
    var closeBtn = document.getElementById('lbClose');
    var prevBtn = document.getElementById('lbPrev');
    var nextBtn = document.getElementById('lbNext');
    var viewport = document.getElementById('lbViewport');

    if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
    if (prevBtn) prevBtn.addEventListener('click', function () { stepLightbox(-1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { stepLightbox(1); });
    lb.querySelectorAll('[data-lb-close]').forEach(function (el) {
      el.addEventListener('click', closeLightbox);
    });

    document.addEventListener('keydown', function (e) {
      if (lb.hidden) return;
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowLeft') stepLightbox(-1);
      else if (e.key === 'ArrowRight') stepLightbox(1);
    });

    var sx = 0;
    var sy = 0;
    if (viewport) {
      viewport.addEventListener('touchstart', function (e) {
        if (e.touches.length !== 1) return;
        sx = e.touches[0].clientX;
        sy = e.touches[0].clientY;
      }, { passive: true });
      viewport.addEventListener('touchend', function (e) {
        if (e.changedTouches.length !== 1) return;
        var dx = e.changedTouches[0].clientX - sx;
        var dy = e.changedTouches[0].clientY - sy;
        if (Math.abs(dx) > 46 && Math.abs(dx) > Math.abs(dy) * 1.2) {
          stepLightbox(dx < 0 ? 1 : -1);
        }
      }, { passive: true });
    }
  }

  function init() {
    initLightbox();
    initSectionTabsScrollSpy();

    fetch(DATA_URL)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        var titleEl = document.getElementById('heroTitle');
        var authorEl = document.getElementById('heroAuthor');
        if (titleEl && data.title) titleEl.textContent = data.title;
        if (authorEl && data.author) authorEl.textContent = data.author;

        renderNotes(data.blocks, data.momentMedia);

        allSections = Array.isArray(data.sections) ? data.sections : [];
        allPhotos = flattenPhotos(allSections);

        renderFilterBar();
        renderArchiveGrid();
      })
      .catch(function (err) {
        var notes = document.getElementById('notesBody');
        if (notes) {
          notes.innerHTML = '<div class="loading-state">档案加载失败，请刷新页面重试。（' + String(err.message || err) + '）</div>';
        }
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
