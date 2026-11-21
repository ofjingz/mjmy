(function () {
  'use strict';

  var DATA_URL = './data.json?v=collection-word-20261121';

  var lightboxItems = [];
  var lightboxIndex = 0;
  var lastFocusedEl = null;

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

  function renderChapter(block) {
    var heading = document.createElement('h2');
    heading.className = 'essay-chapter-anchor';
    heading.id = block.id;
    heading.textContent = block.title;
    return heading;
  }

  function renderEssayFigure(photo, photos) {
    var item = {
      src: './' + photo.src.replace(/^\.\//, ''),
      caption: photo.caption || '',
      alt: photo.alt || '收藏背后正文配图',
      group: '正文配图'
    };
    var index = photos.length;
    photos.push(item);

    var figure = document.createElement('figure');
    figure.className = 'essay-figure';
    if (photo.width < photo.height) figure.classList.add('essay-figure--portrait');

    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'essay-img-btn';
    button.setAttribute('aria-label', '放大查看：' + item.alt);
    button.addEventListener('click', function () {
      openLightbox(photos, index, button);
    });

    var img = document.createElement('img');
    img.src = item.src;
    img.alt = item.alt;
    if (photo.width && photo.height) {
      img.width = photo.width;
      img.height = photo.height;
    }
    img.loading = index === 0 ? 'eager' : 'lazy';
    img.decoding = 'async';
    button.appendChild(img);
    figure.appendChild(button);

    if (item.caption) {
      var caption = document.createElement('figcaption');
      caption.className = 'essay-figure-caption';
      caption.textContent = item.caption;
      figure.appendChild(caption);
    }
    return figure;
  }

  function renderEssay(blocks) {
    var container = document.getElementById('essayBody');
    if (!container) return;
    container.textContent = '';

    var photos = [];
    blocks.forEach(function (block) {
      if (block.type === 'chapter') {
        container.appendChild(renderChapter(block));
      } else if (block.type === 'paragraph' || block.type === 'item-heading') {
        var isHeading = block.type === 'item-heading';
        var paragraph = document.createElement(isHeading ? 'h3' : 'p');
        paragraph.className = isHeading ? 'essay-item-heading' : 'essay-p';
        if (block.leadLength) {
          var lead = document.createElement('strong');
          lead.textContent = block.text.slice(0, block.leadLength);
          paragraph.appendChild(lead);
          paragraph.appendChild(document.createTextNode(block.text.slice(block.leadLength)));
        } else {
          paragraph.textContent = block.text;
        }
        container.appendChild(paragraph);
      } else if (block.type === 'image' && block.src) {
        container.appendChild(renderEssayFigure(block, photos));
      } else if (block.type === 'image-group') {
        var group = document.createElement('div');
        group.className = 'essay-figure-group';
        block.images.forEach(function (photo) {
          group.appendChild(renderEssayFigure(photo, photos));
        });
        container.appendChild(group);
      } else if (block.type === 'table') {
        container.appendChild(renderTableBlock(block));
      }
    });
  }

  function renderHeader(data) {
    var titleEl = document.getElementById('heroTitle');
    var authorEl = document.getElementById('heroAuthor');
    if (titleEl && data.title) titleEl.textContent = data.title;
    if (authorEl && data.author) authorEl.textContent = data.author;
  }

  function buildToc(chapters) {
    var list = document.getElementById('tocList');
    if (!list) return;
    list.innerHTML = '';

    chapters.forEach(function (entry) {
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

  function initProgressAndToc(chapters) {
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

    var anchorIds = chapters.map(function (chapter) { return chapter.id; });
    var ticking = false;
    function updateScroll() {
      ticking = false;
      var scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
      var docHeight = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      var pct = Math.min(100, Math.max(0, Math.round((scrollTop / docHeight) * 100)));

      if (bar) bar.style.width = pct + '%';
      if (fabPct) fabPct.textContent = pct + '%';
      if (textPct) textPct.textContent = '已读 ' + pct + '%';

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
      img.alt = item.alt;
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
        var blocks = Array.isArray(data.blocks) ? data.blocks : [];
        var chapters = blocks.filter(function (block) { return block.type === 'chapter'; });
        renderHeader(data);
        renderEssay(blocks);
        buildToc(chapters);
        var target = document.getElementById(window.location.hash.slice(1));
        if (target && target.classList.contains('essay-chapter-anchor')) target.scrollIntoView();
        initProgressAndToc(chapters);
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
