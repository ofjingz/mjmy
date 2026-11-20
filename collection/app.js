(function () {
  'use strict';

  var DATA_URL = './data.json';

  var CHAPTER_ANCHORS = [
    { blockIndex: 0,   id: 'sec-007-items', title: '007 收藏起点与周边' },
    { blockIndex: 20,  id: 'sec-007-books', title: '007 系列书籍' },
    { blockIndex: 41,  id: 'sec-march', title: '古典好莱坞 · 弗雷德里克·马奇' },
    { blockIndex: 66,  id: 'sec-bologna', title: '博洛尼亚修复电影节周边' },
    { blockIndex: 82,  id: 'sec-la', title: '洛杉矶“捡垃圾”与原始底片' },
    { blockIndex: 100, id: 'sec-cabinet', title: '展示柜与环球怪物' },
    { blockIndex: 103, id: 'sec-australia', title: '澳洲影展与各地场刊' }
  ];

  var lightboxItems = [];
  var lightboxIndex = 0;
  var lastFocusedEl = null;

  function isFigureIndexText(text) {
    return /^\d{4,}$/.test(text.trim());
  }

  function isItemHeading(text) {
    var t = text.trim();
    if (!/^\d+(?:-\d+)?\s*[.．：:]/.test(t)) return false;
    if (t.length > 48) return false;
    if (t.indexOf('，') !== -1 || t.endsWith('。')) return false;
    return true;
  }

  function isCatalogEntry(text) {
    var t = text.trim();
    return /^\d+(?:-\d+)?\s*[.．：:]/.test(t) && !isItemHeading(t);
  }

  function renderTableBlock(block) {
    var wrap = document.createElement('div');
    wrap.className = 'table-scroll-wrap';
    if (block.html) {
      wrap.innerHTML = block.html;
      return wrap;
    }
    var table = document.createElement('table');
    var rows = Array.isArray(block.rows) ? block.rows : [];
    rows.forEach(function (row, rIdx) {
      var tr = document.createElement('tr');
      var cells = Array.isArray(row) ? row : [];
      cells.forEach(function (cell) {
        var td = document.createElement(rIdx === 0 ? 'th' : 'td');
        td.textContent = String(cell == null ? '' : cell);
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });
    wrap.appendChild(table);
    return wrap;
  }

  function renderEssay(data) {
    var container = document.getElementById('essayBody');
    if (!container) return;
    container.innerHTML = '';

    var anchorByBlock = Object.create(null);
    CHAPTER_ANCHORS.forEach(function (ch) {
      anchorByBlock[ch.blockIndex] = ch;
    });

    var embedList = [];
    var blocks = Array.isArray(data.blocks) ? data.blocks : [];

    blocks.forEach(function (block, idx) {
      if (anchorByBlock[idx]) {
        var ch = anchorByBlock[idx];
        var marker = document.createElement('div');
        marker.className = 'essay-chapter-anchor';
        marker.id = ch.id;
        marker.setAttribute('data-chapter-anchor', ch.id);

        var pill = document.createElement('span');
        pill.className = 'chapter-pill';
        pill.textContent = ch.title;

        var rule = document.createElement('span');
        rule.className = 'chapter-rule';
        rule.setAttribute('aria-hidden', 'true');

        marker.appendChild(pill);
        marker.appendChild(rule);
        container.appendChild(marker);
      }

      if (block.type === 'paragraph') {
        var text = typeof block.text === 'string' ? block.text : '';
        if (isFigureIndexText(text)) {
          var keyEl = document.createElement('div');
          keyEl.className = 'essay-fig-key';
          keyEl.textContent = text;
          container.appendChild(keyEl);
        } else if (isItemHeading(text)) {
          var h3 = document.createElement('h3');
          h3.className = 'essay-item-heading';
          h3.textContent = text;
          container.appendChild(h3);
        } else {
          var p = document.createElement('p');
          p.className = 'essay-p' + (isCatalogEntry(text) ? ' is-catalog-entry' : '');
          p.textContent = text;
          container.appendChild(p);
        }
      } else if (block.type === 'image' && block.src) {
        var itemObj = {
          src: './' + block.src.replace(/^\.\//, ''),
          caption: '',
          group: '正文配图'
        };
        var itemIdx = embedList.length;
        embedList.push(itemObj);

        var figure = document.createElement('figure');
        figure.className = 'essay-figure';

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'essay-img-btn';
        btn.setAttribute('aria-label', '放大查看正文配图');
        btn.addEventListener('click', (function (list, i, trigger) {
          return function () {
            openLightbox(list, i, trigger);
          };
        })(embedList, itemIdx, btn));

        var img = document.createElement('img');
        img.src = itemObj.src;
        img.alt = '收藏背后正文配图';
        img.loading = itemIdx === 0 ? 'eager' : 'lazy';
        img.decoding = 'async';
        btn.appendChild(img);

        figure.appendChild(btn);
        container.appendChild(figure);
      } else if (block.type === 'table') {
        container.appendChild(renderTableBlock(block));
      }
    });
  }

  function renderGallery(data) {
    var grid = document.getElementById('galleryGrid');
    if (!grid) return;
    grid.innerHTML = '';

    var gallery = Array.isArray(data.gallery) ? data.gallery : [];
    var items = gallery.map(function (g) {
      return {
        src: './' + g.src.replace(/^\.\//, ''),
        caption: /^收藏实拍\s*\d+$/.test(g.caption || '') ? '' : (g.caption || ''),
        group: '实物实拍'
      };
    });

    items.forEach(function (item, idx) {
      var card = document.createElement('figure');
      card.className = 'gallery-card';

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'gallery-card-btn';
      btn.setAttribute('aria-label', '放大查看 ' + (item.caption || item.group));
      btn.addEventListener('click', function () {
        openLightbox(items, idx, btn);
      });

      var img = document.createElement('img');
      img.src = item.src;
      img.alt = item.caption || item.group;
      img.loading = 'lazy';
      img.decoding = 'async';
      btn.appendChild(img);

      card.appendChild(btn);
      if (item.caption) {
        var meta = document.createElement('figcaption');
        meta.className = 'gallery-card-meta';
        meta.textContent = item.caption;
        card.appendChild(meta);
      }
      grid.appendChild(card);
    });
  }

  function renderHeader(data) {
    var titleEl = document.getElementById('heroTitle');
    var authorEl = document.getElementById('heroAuthor');
    if (titleEl && data.title) titleEl.textContent = data.title;
    if (authorEl && data.author) authorEl.textContent = data.author;
  }

  function buildToc() {
    var list = document.getElementById('tocList');
    if (!list) return;
    list.innerHTML = '';

    var entries = CHAPTER_ANCHORS.concat([
      { id: 'gallery-section', title: '实物收藏实拍' }
    ]);

    entries.forEach(function (entry) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.className = 'toc-link';
      a.href = '#' + entry.id;
      a.setAttribute('data-toc-target', entry.id);

      a.textContent = entry.title;
      a.addEventListener('click', function () {
        setDrawerOpen(false);
      });

      li.appendChild(a);
      list.appendChild(li);
    });
  }

  function setDrawerOpen(open) {
    var drawer = document.getElementById('tocDrawer');
    var toggle = document.getElementById('tocToggleBtn');
    if (!drawer || !toggle) return;
    drawer.hidden = !open;
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function initProgressAndToc() {
    var bar = document.getElementById('readProgressBar');
    var fabPct = document.getElementById('tocFabPct');
    var textPct = document.getElementById('tocProgressText');
    var toggle = document.getElementById('tocToggleBtn');
    var closeBtn = document.getElementById('tocCloseBtn');
    var topBtn = document.getElementById('tocTopBtn');
    var drawer = document.getElementById('tocDrawer');

    if (toggle) {
      toggle.addEventListener('click', function () {
        setDrawerOpen(drawer.hidden);
      });
    }
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        setDrawerOpen(false);
      });
    }
    if (topBtn) {
      topBtn.addEventListener('click', function () {
        setDrawerOpen(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    document.addEventListener('click', function (e) {
      var widget = document.getElementById('tocWidget');
      if (drawer && !drawer.hidden && widget && !widget.contains(e.target)) {
        setDrawerOpen(false);
      }
    });

    var ticking = false;
    function updateScroll() {
      ticking = false;
      var scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
      var docHeight = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      var pct = Math.min(100, Math.max(0, Math.round((scrollTop / docHeight) * 100)));

      if (bar) bar.style.width = pct + '%';
      if (fabPct) fabPct.textContent = pct + '%';
      if (textPct) textPct.textContent = '已读 ' + pct + '%';

      var anchorIds = CHAPTER_ANCHORS.map(function (c) { return c.id; }).concat(['gallery-section']);
      var activeId = anchorIds[0];
      var offset = 160;
      for (var i = 0; i < anchorIds.length; i++) {
        var el = document.getElementById(anchorIds[i]);
        if (el && el.getBoundingClientRect().top <= offset) {
          activeId = anchorIds[i];
        }
      }
      var links = document.querySelectorAll('[data-toc-target]');
      for (var j = 0; j < links.length; j++) {
        links[j].classList.toggle('is-active', links[j].getAttribute('data-toc-target') === activeId);
      }
    }

    window.addEventListener('scroll', function () {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(updateScroll);
      }
    }, { passive: true });
    updateScroll();
  }

  /* ===== Lightbox ===== */
  function openLightbox(items, idx, triggerEl) {
    lightboxItems = items;
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
    if (!lightboxItems.length) return;
    lightboxIndex = (lightboxIndex + delta + lightboxItems.length) % lightboxItems.length;
    renderLightboxFrame();
  }

  function renderLightboxFrame() {
    var item = lightboxItems[lightboxIndex];
    if (!item) return;
    var img = document.getElementById('lbImg');
    var cap = document.getElementById('lbCaption');
    var group = document.getElementById('lbGroup');
    if (img) {
      img.src = item.src;
      img.alt = item.caption || item.group;
    }
    if (cap) {
      cap.textContent = item.caption;
      cap.hidden = !item.caption;
    }
    if (group) group.textContent = item.group || '';
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
      if (lb.hidden) {
        if (e.key === 'Escape') setDrawerOpen(false);
        return;
      }
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowLeft') stepLightbox(-1);
      else if (e.key === 'ArrowRight') stepLightbox(1);
    });

    var touchStartX = 0;
    var touchStartY = 0;
    if (viewport) {
      viewport.addEventListener('touchstart', function (e) {
        if (e.touches.length !== 1) return;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }, { passive: true });

      viewport.addEventListener('touchend', function (e) {
        if (e.changedTouches.length !== 1) return;
        var dx = e.changedTouches[0].clientX - touchStartX;
        var dy = e.changedTouches[0].clientY - touchStartY;
        if (Math.abs(dx) > 46 && Math.abs(dx) > Math.abs(dy) * 1.2) {
          stepLightbox(dx < 0 ? 1 : -1);
        }
      }, { passive: true });
    }
  }

  function init() {
    initLightbox();
    fetch(DATA_URL)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        renderHeader(data);
        renderEssay(data);
        renderGallery(data);
        buildToc();
        initProgressAndToc();
      })
      .catch(function (err) {
        var body = document.getElementById('essayBody');
        if (body) {
          body.innerHTML = '<div class="loading-state">档案加载失败，请刷新页面重试。（' + String(err.message || err) + '）</div>';
        }
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
