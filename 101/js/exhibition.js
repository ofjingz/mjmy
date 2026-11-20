/* =========================================================
   电影101工作室 · 三十周年线上展（幕间漫游 · 模块 04）
   exhibition.js  —  零依赖交互脚本（PC + 移动端 + 微信 WebView）
   ========================================================= */
(function () {
  'use strict';

  var sections = Array.prototype.slice.call(document.querySelectorAll('main section'));
  var menuLinks = Array.prototype.slice.call(document.querySelectorAll('#menuInner a'));
  var frames = Array.prototype.slice.call(document.querySelectorAll('.frame'));
  var progress = document.getElementById('progressBar');
  var holesL = document.getElementById('holesL');
  var holesR = document.getElementById('holesR');
  var tbChapter = document.getElementById('tbChapter');
  var menu = document.getElementById('menu');
  var menuBtn = document.getElementById('tbMenu');

  var lb = document.getElementById('lb');
  var lbstage = document.getElementById('lbstage');
  var lbimg = document.getElementById('lbimg');
  var lbttl = document.getElementById('lbttl');
  var lbyr = document.getElementById('lbyr');
  var lbmeta = document.getElementById('lbmeta');
  var lbclose = document.getElementById('lbclose');
  var lbprev = document.getElementById('lbprev');
  var lbnext = document.getElementById('lbnext');

  var motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var reduceMotion = motionQuery ? motionQuery.matches : false;
  if (motionQuery && typeof motionQuery.addEventListener === 'function') {
    motionQuery.addEventListener('change', function (e) {
      reduceMotion = e.matches;
      if (reduceMotion) revealAllImmediately();
    });
  }

  function revealAllImmediately() {
    document.querySelectorAll('.reveal, .frame').forEach(function (el) {
      el.classList.add('in');
    });
  }

  /* ---------- 1. 滚动：进度 / 齿孔 / 当前章节 ---------- */
  var ticking = false;
  function formatChapterLabel(raw) {
    if (!raw) return '';
    if (window.innerWidth <= 760) {
      var parts = raw.split('/');
      return parts.length > 1 ? parts[parts.length - 1].trim() : raw;
    }
    return raw;
  }

  function onScroll() {
    var y = window.scrollY || document.documentElement.scrollTop || 0;
    var h = document.documentElement.scrollHeight - window.innerHeight;
    if (progress) {
      var pct = h > 0 ? Math.max(0, Math.min(100, (y / h) * 100)) : 0;
      progress.style.width = pct + '%';
    }

    if (!reduceMotion && window.innerWidth > 760 && holesL && holesR) {
      var shift = -(y % 36);
      holesL.style.transform = 'translateX(-50%) translateY(' + shift + 'px)';
      holesR.style.transform = 'translateX(-50%) translateY(' + shift + 'px)';
    }

    var active = sections[0];
    var threshold = window.innerHeight * 0.42;
    for (var i = 0; i < sections.length; i++) {
      if (sections[i].getBoundingClientRect().top <= threshold) {
        active = sections[i];
      }
    }
    if (active && tbChapter) {
      tbChapter.textContent = formatChapterLabel(active.getAttribute('data-ch') || '');
    }
    menuLinks.forEach(function (a) {
      var isActive = active && a.getAttribute('href') === '#' + active.id;
      a.classList.toggle('active', Boolean(isActive));
      if (isActive) a.setAttribute('aria-current', 'location');
      else a.removeAttribute('aria-current');
    });
    ticking = false;
  }

  window.addEventListener('scroll', function () {
    if (!ticking) {
      window.requestAnimationFrame(onScroll);
      ticking = true;
    }
  }, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  onScroll();

  /* ---------- 2. 滚动进入视口时渐显 ---------- */
  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.04, rootMargin: '60px 0px -4px 0px' });
    document.querySelectorAll('.reveal, .frame').forEach(function (el) {
      io.observe(el);
    });
  } else {
    revealAllImmediately();
  }

  /* ---------- 3. 目录菜单（键盘焦点闭环 + 触控友好） ---------- */
  function isMenuOpen() {
    return Boolean(menu && menu.classList.contains('show'));
  }

  function setMenu(open, restoreFocus) {
    if (!menu || !menuBtn) return;
    menu.classList.toggle('show', open);
    menu.setAttribute('aria-hidden', open ? 'false' : 'true');
    menuBtn.classList.toggle('open', open);
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    menuBtn.setAttribute('aria-label', open ? '关闭目录' : '打开目录');
    document.body.classList.toggle('menu-open', open);

    if (open) {
      var focusTarget = menu.querySelector('a.active') || menuLinks[0];
      if (focusTarget) {
        window.requestAnimationFrame(function () { focusTarget.focus(); });
      }
    } else if (restoreFocus) {
      menuBtn.focus();
    }
  }

  if (menuBtn) {
    menuBtn.addEventListener('click', function () {
      var willOpen = !isMenuOpen();
      setMenu(willOpen, !willOpen);
    });
  }

  menuLinks.forEach(function (a) {
    a.addEventListener('click', function () {
      setMenu(false, false);
    });
  });

  if (menu) {
    menu.addEventListener('click', function (e) {
      if (e.target === menu) setMenu(false, true);
    });
  }

  /* ---------- 4. 展品大图灯箱（原比例 + 完整展签 + 键盘/滑动切换） ---------- */
  var currentIndex = -1;
  var lastTriggerEl = null;

  var galleryItems = frames.map(function (frameEl, idx) {
    var img = frameEl.querySelector('img');
    var figure = frameEl.closest('figure');
    var ttlEl = figure ? figure.querySelector('.tag .ttl') : null;
    var yrEl = figure ? figure.querySelector('.tag .yr') : null;
    var metaEl = figure ? figure.querySelector('.tag .meta') : null;
    var titleText = ttlEl ? ttlEl.textContent.trim() : (img ? (img.alt || '') : '');

    frameEl.setAttribute('tabindex', '0');
    frameEl.setAttribute('role', 'button');
    frameEl.setAttribute('aria-label', titleText ? '放大查看：' + titleText : '放大查看展品');

    frameEl.addEventListener('click', function () {
      openLB(idx, frameEl);
    });
    frameEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openLB(idx, frameEl);
      }
    });

    return {
      el: frameEl,
      src: img ? img.getAttribute('src') : '',
      alt: img ? (img.alt || '') : '',
      title: titleText,
      year: yrEl ? yrEl.textContent.trim() : '',
      meta: metaEl ? metaEl.textContent.trim() : ''
    };
  });

  function isLBOpen() {
    return Boolean(lb && lb.classList.contains('show'));
  }

  function preloadNeighbor(idx) {
    if (!galleryItems.length) return;
    var nextIdx = (idx + 1) % galleryItems.length;
    var prevIdx = (idx - 1 + galleryItems.length) % galleryItems.length;
    [nextIdx, prevIdx].forEach(function (i) {
      var item = galleryItems[i];
      if (item && item.src) {
        var pre = new Image();
        pre.src = item.src;
      }
    });
  }

  function renderLB(idx) {
    if (!galleryItems.length || !lbimg) return;
    currentIndex = (idx + galleryItems.length) % galleryItems.length;
    var item = galleryItems[currentIndex];
    lbimg.src = item.src;
    lbimg.alt = item.alt || item.title;
    if (lbttl) lbttl.textContent = item.title;
    if (lbyr) lbyr.textContent = item.year;
    if (lbmeta) lbmeta.textContent = item.meta;
    preloadNeighbor(currentIndex);
  }

  function openLB(idx, triggerEl) {
    if (!lb || !galleryItems.length) return;
    if (isMenuOpen()) setMenu(false, false);
    lastTriggerEl = triggerEl || document.activeElement;
    renderLB(idx);
    lb.classList.add('show');
    lb.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lb-open');
    if (lbclose) {
      window.requestAnimationFrame(function () { lbclose.focus(); });
    }
  }

  function closeLB() {
    if (!lb || !isLBOpen()) return;
    lb.classList.remove('show');
    lb.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lb-open');
    if (lbimg) lbimg.removeAttribute('src');
    var returnTarget = (currentIndex >= 0 && galleryItems[currentIndex] && galleryItems[currentIndex].el) || lastTriggerEl;
    if (returnTarget && typeof returnTarget.focus === 'function') {
      returnTarget.focus({ preventScroll: true });
    }
    currentIndex = -1;
  }

  function stepLB(delta) {
    if (!isLBOpen()) return;
    renderLB(currentIndex + delta);
  }

  if (lbclose) lbclose.addEventListener('click', closeLB);
  if (lbprev) lbprev.addEventListener('click', function (e) { e.stopPropagation(); stepLB(-1); });
  if (lbnext) lbnext.addEventListener('click', function (e) { e.stopPropagation(); stepLB(1); });

  if (lb) {
    lb.addEventListener('click', function (e) {
      if (e.target === lb || e.target === lbstage) {
        closeLB();
      }
    });
  }

  /* ---------- 5. 灯箱触控左右滑动 ---------- */
  var touchStartX = 0;
  var touchStartY = 0;
  var touchTracking = false;

  if (lbstage) {
    lbstage.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) {
        touchTracking = false;
        return;
      }
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchTracking = true;
    }, { passive: true });

    lbstage.addEventListener('touchend', function (e) {
      if (!touchTracking || !e.changedTouches.length) return;
      touchTracking = false;
      var dx = e.changedTouches[0].clientX - touchStartX;
      var dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        stepLB(dx < 0 ? 1 : -1);
      }
    }, { passive: true });
  }

  /* ---------- 6. 全局键盘导航与焦点陷阱 ---------- */
  function trapFocus(e, focusables) {
    if (!focusables.length) return;
    var first = focusables[0];
    var last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  document.addEventListener('keydown', function (e) {
    if (isLBOpen()) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeLB();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        stepLB(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        stepLB(1);
      } else if (e.key === 'Tab') {
        trapFocus(e, [lbclose, lbprev, lbnext].filter(Boolean));
      }
      return;
    }

    if (isMenuOpen()) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setMenu(false, true);
      } else if (e.key === 'Tab') {
        trapFocus(e, [menuBtn].concat(menuLinks).filter(Boolean));
      }
    }
  });
})();
