/**
 * 幕间漫游 · 主展厅入口中枢 (mjmy.ofjing.com / /hub/)
 * - 首页自动播放显影开场，展厅、目录和票根有各自的直达地址
 * - 随机漫游模式（非重叠力导向排布 + 暗房暖光显影 + 点亮足迹状态）
 * - 传统条目模式（按 4 大展区分类编目）
 * - 极简边缘导览 + 漫游票根弹窗联动
 */
(function () {
  'use strict';

  var MOTIF_BASE = '/shared/motifs/';

  // 29 个开屏暗房元素（与 mujian-opening 保持一致，素材统一复用 /shared/motifs/）
  var OPENING_ORDER = [
    'rock', 'canoe', 'bone', 'can', 'canopy', 'poster', 'reach', 'glasses',
    'shoe', 'top', 'star', 'eyes', 'sword', 'record', 'axe',
    'pills', 'hand', 'umbrella', 'chess', 'moon', 'fish', 'boat',
    'typewriter', 'disc', 'portrait', 'drum', 'ornament', 'car', 'tree'
  ];

  // Follow the shapes around the title. A slightly longer beat every seven
  // cues gives the preceding highlights room to fade.
  var OPENING_CUES = [
    'rock', 'canoe', 'shoe', 'top', 'bone', 'can', 'star',
    'canopy', 'eyes', 'poster', 'reach', 'glasses', 'sword', 'tree',
    'axe', 'moon', 'drum', 'ornament', 'fish', 'portrait', 'chess',
    'boat', 'umbrella', 'disc', 'car', 'hand', 'typewriter', 'pills', 'record'
  ];
  var OPENING_BEATS = [165, 180, 200, 165, 180, 200, 335];
  var OPENING_PULSE = 150;
  var OPENING_END_HOLD = 740;
  var OPENING_INKS = ['#8aace0', '#7197df', '#a9b9d2', '#d47c8e', '#86b0dd', '#8b91d8'];
  var CURTAIN_CLOSE = 380;
  var CURTAIN_REVEAL = 350;
  var CURTAIN_SWAP = CURTAIN_CLOSE + 40;

  var OPENING_META = {
    top: { w: 656, h: 740, name: '陀螺形' },
    fish: { w: 740, h: 350, name: '鱼形' },
    glasses: { w: 740, h: 540, name: '圆框眼镜' },
    moon: { w: 740, h: 677, name: '圆面与突出圆筒' },
    hand: { w: 740, h: 622, name: '托起的手' },
    umbrella: { w: 582, h: 740, name: '倒锥形' },
    shoe: { w: 670, h: 740, name: '鞋形' },
    boat: { w: 740, h: 259, name: '长弧形' },
    star: { w: 740, h: 669, name: '放射星形' },
    typewriter: { w: 740, h: 605, name: '打字机' },
    pills: { w: 737, h: 740, name: '双胶囊形' },
    eyes: { w: 740, h: 736, name: '双孔圆片' },
    rock: { w: 717, h: 740, name: '圆石' },
    canoe: { w: 421, h: 740, name: '竖舟形' },
    bone: { w: 740, h: 471, name: '骨形' },
    can: { w: 634, h: 740, name: '罐形' },
    canopy: { w: 724, h: 740, name: '伞面' },
    poster: { w: 740, h: 534, name: '矩形画面' },
    reach: { w: 740, h: 511, name: '伸出的手' },
    sword: { w: 740, h: 437, name: '剑形' },
    record: { w: 740, h: 517, name: '唱机形' },
    axe: { w: 599, h: 740, name: '斧形' },
    chess: { w: 740, h: 376, name: '棋盘形' },
    disc: { w: 740, h: 740, name: '圆形影像' },
    portrait: { w: 696, h: 740, name: '人物剪影' },
    drum: { w: 740, h: 604, name: '鼓形' },
    ornament: { w: 740, h: 336, name: '枝叶形' },
    car: { w: 740, h: 299, name: '汽车' },
    tree: { w: 605, h: 740, name: '树形' }
  };

  var OPENING_DESKTOP = [
    [7, 17, 0.9], [21, 10, 1.1], [37, 21, 1.15], [49, 9, 0.65], [64, 17, 0.85], [80, 9, 0.8], [92, 23, 1.1], [76, 34, 0.8],
    [14, 32, 0.8], [29, 30, 1.1], [53, 26, 0.8], [69, 7, 0.5], [90, 42, 0.9], [8, 51, 0.85], [95, 64, 0.85],
    [7, 73, 0.6], [22, 61, 1.15], [37, 71, 0.85], [52, 65, 0.9], [77, 65, 1.35], [65, 79, 1.1], [44, 87, 1.2],
    [14, 88, 0.9], [31, 91, 0.55], [56, 88, 0.8], [89, 84, 0.7], [71, 92, 1], [27, 79, 0.8], [84, 51, 1.05]
  ];

  var OPENING_MOBILE = [
    [12, 8, 0.8], [35, 12, 1], [62, 7, 0.95], [85, 15, 0.7], [15, 22, 0.85], [52, 23, 1], [82, 30, 1], [35, 34, 0.75],
    [12, 36, 0.75], [69, 36, 0.8], [82, 7, 0.65], [33, 22, 0.5], [14, 57, 0.85], [37, 59, 0.8], [90, 52, 0.8],
    [12, 69, 0.6], [66, 59, 1], [88, 68, 0.7], [36, 73, 0.9], [62, 74, 1], [16, 84, 0.8], [57, 88, 0.95],
    [36, 89, 0.75], [12, 94, 0.55], [84, 88, 0.8], [62, 94, 0.65], [37, 95, 0.8], [85, 95, 0.8], [88, 41, 0.65]
  ];

  function shuffleArray(list, random) {
    var arr = list.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(random() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function roamObjectPath(moduleId) {
    return './preview-assets/obj-' + moduleId + '.png?v=pastel-v2';
  }

  function initHub() {
    var Routes = window.MujianRoutes;
    var Footprint = window.MujianFootprint;
    if (!Routes) return;

    var enabledModules = Routes.getEnabledModules();
    var categories = Routes.CATEGORIES || [];

    // DOM refs
    var rootEl = document.getElementById('hub-root');
    var canvasEl = document.getElementById('atmosphere');
    var openingSec = document.getElementById('opening');
    var openingObjects = document.getElementById('opening-objects');
    var enterBtn = document.getElementById('enter');
    var skipBtn = document.getElementById('skip');
    var hallSec = document.getElementById('hall');
    var roamView = document.getElementById('roam-view');
    var roamStage = document.getElementById('roam-stage');
    var catalogView = document.getElementById('catalog-view');
    var catalogGroups = document.getElementById('catalog-groups');
    var modeRoamBtn = document.getElementById('mode-roam-btn');
    var modeCatalogBtn = document.getElementById('mode-catalog-btn');
    var ticketOpenBtn = document.getElementById('ticket-open-btn');
    var brandHomeBtn = document.getElementById('brand-home-btn');
    var menuToggle = document.getElementById('hall-menu-toggle');
    var hallNavigation = document.getElementById('hall-navigation');
    var announcement = document.getElementById('announcement');

    var navInfo = document.getElementById('nav-info');
    var navThanks = document.getElementById('nav-thanks');
    var topNoteLink = document.getElementById('top-note-link');
    var reducedMedia = window.matchMedia('(prefers-reduced-motion: reduce)');
    var mobileMedia = window.matchMedia('(max-width: 767px), (pointer: coarse)');

    // State
    var phase = 'boot'; // 'opening' | 'transitioning' | 'hall'
    var viewMode = 'roam'; // 'roam' | 'catalog'
    var openingArtifacts = new Map();
    var tasks = new Set();
    var activeTimers = new Map();
    var discovered = new Set();
    var suspended = document.hidden;
    var pointerFrame = 0;
    var lastPoint = null;
    var illuminationTick = 0;
    var roamNodes = [];
    var roamCellOrder = [];
    var lastStageWidth = 0;
    var hubUrl = new URL(location.href);
    var navigation = performance.getEntriesByType('navigation')[0];
    var reloading = navigation && navigation.type === 'reload';
    var historySeed = !reloading && history.state && history.state.mujianEnteredHall
      ? Routes.parseRoamSeed(history.state.mujianRoamSeed) : 0;
    // Some containers reopen the hall URL instead of restoring the history entry.
    var lastArrival = Footprint && Footprint.takeRoamReturn && Footprint.takeRoamReturn();
    var arrivalSeed = !reloading ? Routes.parseRoamSeed(lastArrival) : 0;
    var returnedSeed = Routes.parseRoamSeed(hubUrl.searchParams.get('roam'));
    var restoredHall = Boolean(returnedSeed || historySeed || arrivalSeed);
    var layoutSeed = returnedSeed || historySeed || arrivalSeed || Math.floor(Math.random() * 2147483646) + 1;
    var arrived = hubUrl.searchParams.get('arrived');
    if (returnedSeed && enabledModules.some(function (module) { return module.id === arrived; })
        && Footprint && Footprint.rememberRoamVisit) {
      Footprint.rememberRoamVisit(arrived, returnedSeed);
    }
    // Keep Back stable without making a copied or reloaded hall URL carry a visit.
    hubUrl.searchParams.delete('roam');
    hubUrl.searchParams.delete('arrived');
    try {
      history.replaceState(Object.assign({}, history.state, { mujianRoamSeed: layoutSeed, mujianEnteredHall: false }), '', hubUrl);
    } catch (_) {}
    updateSpecialLinks('hall');

    var ticketCtrl = window.MujianTicket ? window.MujianTicket.createController(roamObjectPath) : null;
    rootEl.style.setProperty('--curtain-close', CURTAIN_CLOSE + 'ms');
    rootEl.style.setProperty('--curtain-reveal', CURTAIN_REVEAL + 'ms');

    var atmosphere = window.MujianAtmosphere
      ? window.MujianAtmosphere.create(canvasEl, {
          reducedMotion: reducedMedia.matches,
          onLight: illuminate
        })
      : {
          setPointer: function () {},
          burst: function () {},
          setMode: function () {},
          setReducedMotion: function () {},
          destroy: function () {}
        };

    // --- Task scheduling for opening sequence ---
    function schedule(callback, delay) {
      var task = { callback: callback, remaining: delay, started: performance.now(), handle: 0 };
      task.run = function () {
        tasks.delete(task);
        callback();
      };
      tasks.add(task);
      if (!suspended) task.handle = setTimeout(task.run, delay);
      return task;
    }

    function cancelTask(task) {
      if (task) {
        clearTimeout(task.handle);
        tasks.delete(task);
      }
    }

    function clearTasks() {
      tasks.forEach(function (t) { clearTimeout(t.handle); });
      tasks.clear();
      activeTimers.clear();
    }

    function pauseTasks(shouldPause) {
      var now = performance.now();
      tasks.forEach(function (t) {
        if (shouldPause) {
          clearTimeout(t.handle);
          t.remaining = Math.max(0, t.remaining - (now - t.started));
        } else {
          t.started = now;
          t.handle = setTimeout(t.run, t.remaining);
        }
      });
    }

    // --- Illumination from atmosphere canvas ---
    function illuminate(x, y, radius, amount) {
      if (mobileMedia.matches || performance.now() - illuminationTick < 70) return;
      illuminationTick = performance.now();

      if (phase === 'opening' && openingObjects) {
        var oChildren = openingObjects.children;
        for (var i = 0; i < oChildren.length; i++) {
          var oEl = oChildren[i];
          var or = oEl.getBoundingClientRect();
          var od = Math.hypot(x - or.x - or.width / 2, y - or.y - or.height / 2);
          var oe = Math.min(1, Math.max(0, 1 - od / radius) * amount);
          oEl.style.setProperty('--exposure', oe.toFixed(3));
        }
      }
    }

    // --- Opening screen builder & choreography ---
    function buildOpeningArtifacts() {
      if (openingArtifacts.size) return;
      for (var i = 0; i < OPENING_ORDER.length; i++) {
        (function (index, id) {
          var meta = OPENING_META[id];
          if (!meta) return;
          var d = OPENING_DESKTOP[index];
          var m = OPENING_MOBILE[index];
          var ratio = meta.w / meta.h;
          var size = Math.min(150, 108 * ratio) * d[2];
          var ms = Math.min(70, 66 * ratio) * m[2];
          var opacity = 0.48 + (index % 4) * 0.09;
          var drift = 9 + (index % 9);

          var el = document.createElement('div');
          el.className = 'artifact';
          el.dataset.id = id;
          el.style.cssText =
            '--x:' + d[0] + '%;--y:' + d[1] + '%;--size:' + size.toFixed(1) + 'px;' +
            '--mx:' + m[0] + '%;--my:' + m[1] + '%;--ms:' + ms.toFixed(1) + 'px;' +
            '--ratio:' + ratio.toFixed(4) + ';--opacity:' + opacity.toFixed(2) + ';' +
            '--ink:' + OPENING_INKS[index % OPENING_INKS.length] + ';--drift:' + drift + 's;' +
            '--phase:' + (-(index + 1) * 1.7).toFixed(1) + 's;';

          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'artifact-button';
          btn.setAttribute('aria-label', '让' + meta.name + '显影');

          var gesture = document.createElement('span');
          gesture.className = 'gesture';
          gesture.setAttribute('aria-hidden', 'true');

          ['outline', 'grain'].forEach(function (layer) {
            var motif = document.createElement('span');
            motif.className = layer;
            motif.style.setProperty('--motif-mask', 'url("' + MOTIF_BASE + id + '-' + layer + '.png")');
            gesture.appendChild(motif);
          });

          btn.appendChild(gesture);
          el.appendChild(btn);
          openingObjects.appendChild(el);
          openingArtifacts.set(id, el);

          btn.addEventListener('click', function () { activateArtifact(id); });
          btn.addEventListener('focus', function () { activateArtifact(id); });
          btn.addEventListener('pointerenter', function (ev) {
            if (!mobileMedia.matches && ev.pointerType === 'mouse' && rootEl.classList.contains('is-title-visible')) {
              activateArtifact(id);
            }
          });
        })(i, OPENING_ORDER[i]);
      }
    }

    function activateArtifact(id) {
      if (phase !== 'opening') return;
      var el = openingArtifacts.get(id);
      if (!el) return;
      cancelTask(activeTimers.get(id));
      el.classList.remove('is-active');
      requestAnimationFrame(function () {
        if (phase === 'opening') el.classList.add('is-active');
      });
      var rect = el.getBoundingClientRect();
      atmosphere.burst(rect.x + rect.width / 2, rect.y + rect.height / 2);
      activeTimers.set(
        id,
        schedule(function () {
          el.classList.remove('is-active');
          activeTimers.delete(id);
        }, reducedMedia.matches ? 1800 : 3100)
      );
      if (!discovered.has(id)) {
        discovered.add(id);
        if (announcement) {
          announcement.textContent = '已显影 ' + discovered.size + ' 个形状，可点击幕间漫游进入展厅。';
        }
      }
    }

    function playOpeningSequence() {
      var at = 460;
      OPENING_CUES.forEach(function (id, index) {
        schedule(function () {
          var el = openingArtifacts.get(id);
          if (!el) return;
          el.classList.add('is-revealed', 'is-cue-lit');
          schedule(function () { el.classList.remove('is-cue-lit'); }, OPENING_PULSE);
        }, at);
        if (index < OPENING_CUES.length - 1) at += OPENING_BEATS[index % OPENING_BEATS.length];
      });
      var curtainAt = at + OPENING_END_HOLD;
      // Allow 800 ms for the fade and 300 ms for the stagger, then hold the full title for 3 s.
      schedule(function () { rootEl.classList.add('is-title-visible'); }, curtainAt - 4100);
      schedule(function () { rootEl.classList.add('is-opening-finale'); }, at + 160);
      schedule(enterHall, curtainAt);
    }

    function startOpening(opts) {
      opts = opts || {};
      clearTasks();
      if (ticketCtrl && ticketCtrl.isOpen()) ticketCtrl.close();

      discovered.clear();
      buildOpeningArtifacts();
      openingArtifacts.forEach(function (el) {
        el.classList.remove('is-active', 'is-cue-lit', 'is-revealed');
        el.style.removeProperty('--exposure');
      });
      phase = 'opening';
      syncExploreAxis();

      rootEl.classList.remove('is-entered', 'is-transitioning', 'is-title-visible', 'is-catalog-mode', 'is-opening-finale');
      rootEl.classList.add('is-opening-phase', 'is-ready');
      if (openingSec) {
        openingSec.hidden = false;
        openingSec.removeAttribute('aria-hidden');
        if ('inert' in openingSec) openingSec.inert = false;
      }
      if (hallSec) {
        hallSec.hidden = true;
        hallSec.setAttribute('aria-hidden', 'true');
        if ('inert' in hallSec) hallSec.inert = true;
      }
      if (enterBtn) enterBtn.disabled = false;
      atmosphere.setMode('opening');
      atmosphere.setPointer(0, 0, false);
      if (reducedMedia.matches) rootEl.classList.add('is-title-visible');
      else playOpeningSequence();
      if (!opts.initial && enterBtn) {
        enterBtn.focus({ preventScroll: true });
        if (announcement) announcement.textContent = '暗房开场已重新放映。';
      }
    }

    function enterHall(opts) {
      opts = opts || {};
      var immediate = !!opts.immediate;
      var targetView = opts.view === 'catalog' ? 'catalog' : 'roam';
      var openTicketAfter = !!opts.openTicket;

      if (!immediate && phase !== 'opening') return;

      clearTasks();

      function showHall() {
        phase = 'hall';
        try {
          history.replaceState(Object.assign({}, history.state, { mujianEnteredHall: true }), '');
        } catch (_) {}
        rootEl.classList.remove('is-opening-phase', 'is-opening-finale', 'is-transitioning');
        rootEl.classList.add('is-entered', 'is-ready');
        if (openingSec) {
          openingSec.hidden = true;
          openingSec.setAttribute('aria-hidden', 'true');
          if ('inert' in openingSec) openingSec.inert = true;
        }
        if (hallSec) {
          hallSec.hidden = false;
          hallSec.removeAttribute('aria-hidden');
          if (!immediate && !reducedMedia.matches) hallSec.classList.add('screen-up');
          if ('inert' in hallSec) hallSec.inert = false;
        }
        setViewMode(targetView, { updateHash: !immediate && targetView === 'catalog' });
        refreshFootprintUI();
        layoutRoamNodes();
      }

      function finishEntry() {
        if (!immediate) {
          if (brandHomeBtn) brandHomeBtn.focus({ preventScroll: true });
          if (announcement) announcement.textContent = '已进入幕间漫游线上展厅。';
          rootEl.dispatchEvent(new CustomEvent('mujian:entered', { bubbles: true }));
        }
        if (openTicketAfter && ticketCtrl) {
          ticketCtrl.open();
        }
      }

      if (immediate || reducedMedia.matches) {
        showHall();
        finishEntry();
        return;
      }

      // Switch scenes under the closed curtain, then reveal the hall.
      phase = 'transitioning';
      if (enterBtn) enterBtn.disabled = true;
      if (openingSec && 'inert' in openingSec) openingSec.inert = true;
      rootEl.classList.add('is-transitioning');
      atmosphere.setMode('quiet');

      schedule(function () {
        showHall();
        schedule(finishEntry, CURTAIN_REVEAL);
      }, CURTAIN_SWAP);
    }

    function moduleUrl(id, view) {
      return Routes.resolveUrl(id) + '?via=' + view + '&roam=' + layoutSeed;
    }

    function updateSpecialLinks(view) {
      if (navInfo) navInfo.href = moduleUrl('info', view);
      if (navThanks) navThanks.href = moduleUrl('thanks', view);
      if (topNoteLink) topNoteLink.href = moduleUrl('note', view);
    }

    // Selected scheme 3: existing transparent objects + real submitted photographs.
    // Titles, contributors and destinations continue to come from the shared routes.
    var PORTAL_ART = {
      linli: { photo: '/linli/media/thumbs/thumb-01.jpg', glow: '98,168,245' },
      cinema: { photo: '/cinema/assets/photos/academy-museum/01.webp', glow: '110,190,196' },
      letter: { photo: '/letter/media/kaiyi-australia/photo-01.jpg', glow: '245,206,134' },
      '101': { photo: '/101/assets/07-tarkovsky-1999.jpg', glow: '228,166,84' },
      vibecoding: { photo: '/vibecoding/media/yang-gomovie.jpg', glow: '242,184,96' },
      collection: { photo: '/collection/media/gallery/col-01.jpg', glow: '196,78,128' },
      next: { photo: '/next/media/art-alliance-01.jpg', glow: '218,72,82' },
      same: { photo: '/same/media/same-01.jpg', glow: '116,158,240' }
    };

    function buildHallMotifs() {
      var layer = document.getElementById('hall-motifs');
      if (!layer) return;
      OPENING_ORDER.forEach(function (id, i) {
        var spot = OPENING_DESKTOP[i];
        var img = document.createElement('img');
        img.src = MOTIF_BASE + id + '-outline.png';
        img.alt = '';
        img.draggable = false;
        img.decoding = 'async';
        img.style.left = spot[0] + '%';
        img.style.top = spot[1] + '%';
        img.style.setProperty('--motif-size', (34 + (i * 17 % 54)) + 'px');
        img.style.setProperty('--motif-angle', ((i * 31 % 48) - 24) + 'deg');
        img.style.setProperty('--motif-time', (28 + i % 7 * 3) + 's');
        img.style.setProperty('--motif-delay', (-i * 2.3) + 's');
        layer.appendChild(img);
      });
    }

    function buildRoamNodes() {
      if (!roamStage) return;
      roamStage.innerHTML = '';
      roamNodes = [];
      enabledModules.forEach(function (mod, idx) {
        var art = PORTAL_ART[mod.id];
        var a = document.createElement('a');
        a.className = 'roam-node';
        a.href = moduleUrl(mod.id, 'hall');
        a.dataset.moduleId = mod.id;
        a.dataset.motif = mod.motif;
        a.dataset.depth = String(idx % 3);
        var names = (mod.contributors && mod.contributors.length ? mod.contributors : [mod.contributor]).filter(Boolean);
        a.setAttribute('aria-label', mod.title + ' · ' + names.join('、'));
        var driftDuration = (9 + idx % 4 * 1.6) / 1.5;
        a.style.setProperty('--drift-dur', driftDuration + 's');
        a.style.setProperty('--drift-phase', (-2 * driftDuration * (idx * 0.618 % 1)) + 's');
        a.style.setProperty('--object-scale', (0.87 + idx * 7 % 14 / 100).toFixed(2));
        a.style.setProperty('--wake-angle', (-32 + idx * 13 % 55) + 'deg');
        a.style.setProperty('--node-rgb', art.glow);
        a.innerHTML =
          '<span class="roam-art" aria-hidden="true">' +
            '<svg class="roam-wake" viewBox="0 0 240 160"><path d="M8 136 C24 26 110 4 219 54"/><path d="M23 144 C42 51 119 25 228 66"/></svg>' +
            '<span class="roam-aura"></span>' +
            '<img class="roam-object" src="' + roamObjectPath(mod.id) + '" width="512" height="512" alt="" draggable="false" decoding="async">' +
          '</span>' +
          '<span class="roam-caption"><span class="roam-title-row">' +
            '<span class="roam-title">' + titleMarkup(mod.title) + '</span></span>' +
            '<span class="roam-contrib">' + escapeHtml(names.join(' · ')) + '</span></span>' +
          '<span class="roam-projection"><span class="projection-perfs"></span>' +
            '<img src="' + art.photo + '" width="480" height="320" alt="" loading="lazy">' +
            '<span class="roam-description">' + escapeHtml(mod.tagline) + '</span>' +
          '</span>';
        a.querySelector('.roam-object').addEventListener('error', function () {
          this.src = MOTIF_BASE + mod.motif + '-outline.png';
        }, { once: true });
        a.querySelector('.roam-projection img').addEventListener('error', function () {
          a.querySelector('.roam-projection').hidden = true;
        }, { once: true });
        a.addEventListener('pointerenter', updateProjectionPositions);
        a.addEventListener('focus', updateProjectionPositions);
        a.addEventListener('pointermove', function (ev) {
          if (ev.pointerType === 'touch' || reducedMedia.matches) return;
          var rect = a.getBoundingClientRect();
          a.style.setProperty('--tilt-y', ((ev.clientX - rect.left) / rect.width * 16 - 8).toFixed(1) + 'deg');
          a.style.setProperty('--tilt-x', (8 - (ev.clientY - rect.top) / rect.height * 16).toFixed(1) + 'deg');
        });
        a.addEventListener('pointerleave', function () {
          a.style.setProperty('--tilt-x', '0deg');
          a.style.setProperty('--tilt-y', '0deg');
        });
        roamStage.appendChild(a);
        roamNodes.push(a);
      });
    }

    function syncExploreAxis() {
      var roaming = phase === 'hall' && viewMode === 'roam';
      var horizontal = roaming && !mobileMedia.matches;
      document.documentElement.classList.toggle('is-roam-scene', roaming);
      rootEl.classList.toggle('is-horizontal-roam', horizontal);
      document.documentElement.classList.toggle('is-horizontal-roam', horizontal);
      if (horizontal) {
        roamView.setAttribute('tabindex', '0');
      } else {
        roamView.removeAttribute('tabindex');
      }
      return horizontal;
    }

    function updateProjectionPositions() {
      if (!rootEl.classList.contains('is-horizontal-roam')) {
        roamNodes.forEach(function (node) { node.style.removeProperty('--parallax'); });
        return;
      }
      var view = roamView.getBoundingClientRect();
      roamNodes.forEach(function (el) {
        var rect = el.getBoundingClientRect();
        if (!reducedMedia.matches) {
          var depth = Number(el.dataset.depth) - 1;
          var distance = rect.left + rect.width / 2 - view.left - view.width / 2;
          el.style.setProperty('--parallax', Math.max(-27, Math.min(27, distance * depth * .075)) + 'px');
        } else {
          el.style.removeProperty('--parallax');
        }
        el.classList.toggle('projects-left', rect.left + rect.width / 2 > view.left + view.width / 2);
        var card = el.querySelector('.roam-projection');
        var top = Math.max(12 - (rect.top - view.top), Math.min(20, view.bottom - rect.top - card.offsetHeight - 14));
        el.style.setProperty('--projection-top', top.toFixed(1) + 'px');
      });
    }

    // Continuous-space random packing. Measure the real text and reserve space for
    // drift. A fixed session seed keeps resizing, font loading and Back stable.
    function layoutRoamNodes() {
      var horizontal = syncExploreAxis();
      if (!roamStage || !roamNodes.length || roamView.hidden) return;
      var seed = layoutSeed;
      function random() { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; }
      if (!roamCellOrder.length) {
        roamCellOrder = shuffleArray(roamNodes.map(function (_, i) { return i; }), random);
        seed = layoutSeed;
      }
      var stageW = roamView.clientWidth || window.innerWidth;
      var desktopHeight = horizontal ? roamView.clientHeight : 0;
      roamStage.style.width = '100%';
      roamStage.style.height = horizontal ? '100%' : '';
      roamStage.style.minHeight = horizontal ? '0' : '';
      lastStageWidth = stageW;
      var mobile = !horizontal;
      var single = stageW < 300;
      var side = mobile ? 16 : Math.max(18, stageW * 0.022);
      var desktopWidth = Math.floor(stageW * 1.82);
      var desktopSlot = (desktopWidth - side * 2) / roamNodes.length;
      var gap = mobile ? 14 : 30;
      var top = mobile ? 30 : 50;
      var bottom = mobile ? 64 : 88;
      var sizes = roamNodes.map(function (el) {
        var width = single ? Math.min(210, stageW - 80) : mobile ? Math.min(174, (stageW - side * 2 - gap) / 2 - 8) : Math.min(216, desktopSlot - 24, Math.max(110, desktopHeight - 178));
        el.style.width = width.toFixed(1) + 'px';
        return { w: width + (mobile ? 4 : 14), h: el.offsetHeight + 28 };
      });
      if (horizontal) {
        // Each entry gets horizontal room to drift. Vary the heights and
        // offsets inside those bounds so the objects still feel scattered.
        var heights = [0.26, 0.67, 0.38, 0.57, 0.32, 0.74, 0.46, 0.26];
        roamStage.style.width = desktopWidth + 'px';
        roamCellOrder.forEach(function (idx, order) {
          var box = sizes[idx];
          var xJitter = Math.min(28, Math.max(0, (desktopSlot - box.w - 10) / 2));
          var x = side + desktopSlot * (order + 0.5) + (random() * 2 - 1) * xJitter;
          var heightFraction = heights[order % heights.length] + (random() - 0.5) * 0.18;
          var y = 14 + box.h / 2 + Math.max(0, desktopHeight - box.h - 28) * heightFraction;
          roamNodes[idx].style.left = x.toFixed(1) + 'px';
          roamNodes[idx].style.top = y.toFixed(1) + 'px';
        });
        updateProjectionPositions();
        return;
      }
      // Narrow screens use two staggered lanes with independent vertical rhythm.
      // This avoids making eight objects into an unnecessarily long single file.
      if (mobile && !single) {
        var laneW = (stageW - side * 2 - gap) / 2;
        var laneBottom = [top + random() * 24, top + 75 + random() * 40];
        roamCellOrder.forEach(function (idx, order) {
          var lane = laneBottom[0] <= laneBottom[1] ? 0 : 1;
          var box = sizes[idx];
          var el = roamNodes[idx];
          var x = side + lane * (laneW + gap) + laneW / 2;
          var y = laneBottom[lane] + box.h / 2;
          el.style.left = x.toFixed(1) + 'px';
          el.style.top = y.toFixed(1) + 'px';
          el.classList.toggle('projects-left', lane === 1);
          laneBottom[lane] += box.h + 30 + random() * 36;
        });
        roamStage.style.minHeight = Math.ceil(Math.max.apply(null, laneBottom) + bottom) + 'px';
        return;
      }
      var area = sizes.reduce(function (sum, box) { return sum + box.w * box.h; }, 0);
      var stageH = Math.max(window.innerHeight - 80, area / ((stageW - side * 2) * (mobile ? 0.62 : 0.49)) + top + bottom);
      var placed = [];
      // Grow the scrollable stage if packing needs breathing room; never accept
      // an overlapping fallback on small screens or with larger text settings.
      for (var attempt = 0; attempt < 30; attempt++) {
        placed = [];
        for (var i = 0; i < roamCellOrder.length; i++) {
          var idx = roamCellOrder[i];
          var size = sizes[idx];
          var best = null;
          var bestScore = -Infinity;
          for (var candidate = 0; candidate < 160; candidate++) {
            var x = side + size.w / 2 + random() * Math.max(0, stageW - side * 2 - size.w);
            var y = top + size.h / 2 + random() * Math.max(0, stageH - top - bottom - size.h);
            var score = Infinity;
            var valid = true;
            for (var j = 0; j < placed.length; j++) {
              var other = placed[j];
              var dx = Math.abs(x - other.x) - (size.w + other.w) / 2;
              var dy = Math.abs(y - other.y) - (size.h + other.h) / 2;
              if (dx < gap && dy < gap) { valid = false; break; }
              score = Math.min(score, Math.hypot(x - other.x, (y - other.y) * 0.82));
            }
            if (valid && score > bestScore) {
              best = { index: idx, x: x, y: y, w: size.w, h: size.h };
              bestScore = score;
            }
          }
          if (!best) break;
          placed.push(best);
        }
        if (placed.length === roamNodes.length) break;
        stageH *= 1.07;
      }
      // Guaranteed non-overlapping fallback for extreme zoom / large system fonts.
      if (placed.length !== roamNodes.length) {
        var cursorY = top;
        placed = roamCellOrder.map(function (idx) {
          var box = sizes[idx];
          var x = side + box.w / 2 + random() * Math.max(0, stageW - side * 2 - box.w);
          cursorY += box.h / 2;
          var item = { index: idx, x: x, y: cursorY, w: box.w, h: box.h };
          cursorY += box.h / 2 + gap;
          return item;
        });
        stageH = cursorY + bottom;
      }
      roamStage.style.minHeight = Math.ceil(stageH) + 'px';
      placed.forEach(function (item) {
        var el = roamNodes[item.index];
        el.style.left = item.x.toFixed(1) + 'px';
        el.style.top = item.y.toFixed(1) + 'px';
        el.classList.toggle('projects-left', item.x > stageW / 2);
      });
    }

    // --- Traditional Catalog Mode (4 Categories) ---
    function buildCatalog() {
      if (!catalogGroups) return;
      catalogGroups.innerHTML = '';

      var list = document.createElement('div');
      list.className = 'catalog-list';

      enabledModules.forEach(function (mod) {
        var card = document.createElement('a');
        card.className = 'catalog-card';
        card.href = moduleUrl(mod.id, 'catalog');
        card.dataset.moduleId = mod.id;
        var names = (mod.contributors && mod.contributors.length ? mod.contributors : [mod.contributor]).filter(Boolean);

        card.innerHTML =
          '<span class="catalog-thumb" aria-hidden="true">' +
            '<img class="thumb-outline" src="./preview-assets/catalog/' + mod.motif + '.png" alt="" width="256" height="256" loading="lazy">' +
            '<img class="thumb-object" src="' + roamObjectPath(mod.id) + '" alt="" width="512" height="512" loading="lazy">' +
          '</span>' +
          '<span class="catalog-body">' +
            '<span class="catalog-top-row">' +
              '<span class="catalog-title">' + titleMarkup(mod.title) + '</span>' +
              '<span class="catalog-contrib">' + escapeHtml(names.join(' · ')) + '</span>' +
            '</span>' +
          '</span>' +
          '<span class="catalog-arrow" aria-hidden="true">→</span>';

        list.appendChild(card);
      });

      catalogGroups.appendChild(list);
    }

    // Roaming light, catalog badges, and ticket stub share the exact same saved footprint (WYSIWYG).
    function refreshFootprintUI() {
      var fp = Footprint && typeof Footprint.getFootprint === 'function'
        ? Footprint.getFootprint()
        : { mods: [] };
      var litSet = Object.create(null);
      (fp.mods || []).forEach(function (id) { litSet[id] = true; });

      // 点亮统计只在票根中呈现；大厅不显示计数
      // Update roaming nodes
      for (var r = 0; r < roamNodes.length; r++) {
        var rNode = roamNodes[r];
        var rLit = !!litSet[rNode.dataset.moduleId];
        rNode.classList.toggle('is-lit', rLit);
      }

      // Update catalog cards
      if (catalogGroups) {
        var cards = catalogGroups.querySelectorAll('.catalog-card');
        for (var c = 0; c < cards.length; c++) {
          var card = cards[c];
          var cLit = !!litSet[card.dataset.moduleId];
          card.classList.toggle('is-lit', cLit);
        }
      }
    }

    // --- View mode toggle (Roam vs Catalog) ---
    function setViewMode(mode, opts) {
      opts = opts || {};
      var previous = viewMode;
      viewMode = mode === 'catalog' ? 'catalog' : 'roam';
      var isCatalog = viewMode === 'catalog';
      updateSpecialLinks(isCatalog ? 'catalog' : 'hall');

      if (menuToggle.getAttribute('aria-expanded') === 'true') setHallMenu(false, hallNavigation.contains(document.activeElement));
      rootEl.classList.toggle('is-catalog-mode', isCatalog);
      syncExploreAxis();
      if (roamView) {
        roamView.hidden = isCatalog;
        roamView.setAttribute('aria-hidden', isCatalog ? 'true' : 'false');
      }
      if (catalogView) {
        catalogView.hidden = !isCatalog;
        catalogView.setAttribute('aria-hidden', isCatalog ? 'false' : 'true');
      }
      var activeMode = isCatalog ? modeCatalogBtn : modeRoamBtn;
      var inactiveMode = isCatalog ? modeRoamBtn : modeCatalogBtn;
      activeMode.setAttribute('aria-current', 'page');
      inactiveMode.removeAttribute('aria-current');

      if (phase === 'hall') {
        var destination = isCatalog ? catalogView : roamView;
        if (previous !== viewMode && !reducedMedia.matches && destination && destination.animate) {
          destination.animate([{ opacity: .3, filter: 'brightness(.72)' }, { opacity: 1, filter: 'brightness(1)' }], { duration: 380, easing: 'ease-out' });
        }
        atmosphere.setMode('quiet');
      }

      if (!isCatalog) {
        requestAnimationFrame(function () {
          layoutRoamNodes();
        });
      } else {
        window.scrollTo({ top: 0, behavior: reducedMedia.matches ? 'auto' : 'smooth' });
      }

      if (opts.updateHash) {
        var desired = isCatalog ? '#catalog' : '#hall';
        if (location.hash !== desired) {
          try { history.replaceState(history.state, '', desired); } catch (_) {}
        }
      }
    }

    function titleMarkup(title) {
      return title.split(/([a-z]+)/i).map(function (part, index) {
        return index % 2 ? '<span class="typewriter-title">' + part + '</span>' : escapeHtml(part);
      }).join('');
    }

    function escapeHtml(str) {
      return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    // --- Pointer & parallax interaction ---
    function onPointerMove(ev) {
      if (mobileMedia.matches || ev.pointerType === 'touch') return;
      if (phase !== 'opening') return;
      lastPoint = { x: ev.clientX, y: ev.clientY };
      atmosphere.setPointer(ev.clientX, ev.clientY, true);
      if (!pointerFrame && !reducedMedia.matches) {
        pointerFrame = requestAnimationFrame(function () {
          if (phase === 'opening' && rootEl) {
            var rect = rootEl.getBoundingClientRect();
            rootEl.style.setProperty('--parallax-x', (((lastPoint.x - rect.x) / rect.width - 0.5) * -12).toFixed(2) + 'px');
            rootEl.style.setProperty('--parallax-y', (((lastPoint.y - rect.y) / rect.height - 0.5) * -8).toFixed(2) + 'px');
          }
          pointerFrame = 0;
        });
      }
    }

    function onPointerLeave() {
      if (mobileMedia.matches) return;
      atmosphere.setPointer(0, 0, false);
      rootEl.style.setProperty('--parallax-x', '0px');
      rootEl.style.setProperty('--parallax-y', '0px');
    }

    function applyMotionPreference() {
      rootEl.classList.toggle('is-reduced', reducedMedia.matches);
      atmosphere.setReducedMotion(reducedMedia.matches);
      if (reducedMedia.matches) {
        rootEl.style.setProperty('--parallax-x', '0px');
        rootEl.style.setProperty('--parallax-y', '0px');
        rootEl.classList.add('is-title-visible');
      }
      if (phase === 'opening') startOpening({ initial: true });
    }

    function handleHashRoute(initialBoot) {
      var hash = (location.hash || '').toLowerCase();
      if (initialBoot && !hash && restoredHall) hash = '#hall';
      var hasSkipHash = hash === '#hall' || hash === '#catalog' || hash === '#ticket';
      // The homepage and the explicit replay link both start with the opening.
      if (hash === '#opening' || !hash) {
        startOpening({ initial: !!initialBoot });
        return;
      }

      if (initialBoot) {
        if (hasSkipHash) {
          enterHall({
            immediate: true,
            view: hash === '#catalog' ? 'catalog' : 'roam',
            openTicket: hash === '#ticket'
          });
        } else {
          startOpening({ initial: true });
        }
        return;
      }

      if (hash === '#ticket') {
        if (phase !== 'hall') enterHall({ immediate: true, view: 'roam', openTicket: true });
        else if (ticketCtrl) ticketCtrl.open();
      } else if (hash === '#catalog') {
        if (ticketCtrl && ticketCtrl.isOpen()) ticketCtrl.close();
        if (phase !== 'hall') enterHall({ immediate: true, view: 'catalog' });
        else setViewMode('catalog', { updateHash: false });
      } else if (hash === '#hall') {
        if (ticketCtrl && ticketCtrl.isOpen()) ticketCtrl.close();
        if (phase !== 'hall') enterHall({ immediate: true, view: 'roam' });
        else setViewMode('roam', { updateHash: false });
      }
    }

    function scrollRoamBy(amount) {
      roamView.scrollBy({ left: amount, behavior: reducedMedia.matches ? 'auto' : 'smooth' });
    }

    var roamDrag = null;
    var suppressRoamClick = false;
    roamView.addEventListener('wheel', function (ev) {
      if (!rootEl.classList.contains('is-horizontal-roam') || ev.ctrlKey || (ticketCtrl && ticketCtrl.isOpen())) return;
      var amount = Math.abs(ev.deltaX) > Math.abs(ev.deltaY) ? ev.deltaX : ev.deltaY;
      if (ev.deltaMode === 1) amount *= 20;
      if (ev.deltaMode === 2) amount *= roamView.clientWidth;
      if (roamView.scrollWidth > roamView.clientWidth) {
        ev.preventDefault();
        roamView.scrollLeft += amount;
      }
    }, { passive: false });
    roamView.addEventListener('keydown', function (ev) {
      if (!rootEl.classList.contains('is-horizontal-roam') || ev.altKey || ev.ctrlKey || ev.metaKey) return;
      if (ev.target.closest('button,input,textarea,select')) return;
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
        ev.preventDefault();
        scrollRoamBy((ev.key === 'ArrowRight' ? 1 : -1) * Math.max(240, roamView.clientWidth * 0.55));
      } else if ((ev.key === 'Home' || ev.key === 'End') && ev.target === roamView) {
        ev.preventDefault();
        roamView.scrollTo({ left: ev.key === 'Home' ? 0 : roamView.scrollWidth, behavior: reducedMedia.matches ? 'auto' : 'smooth' });
      }
    });
    roamView.addEventListener('pointerdown', function (ev) {
      if (!rootEl.classList.contains('is-horizontal-roam') || ev.pointerType === 'touch' || ev.button !== 0) return;
      if (ev.target.closest('button,input,textarea,select')) return;
      suppressRoamClick = false;
      roamDrag = { id: ev.pointerId, x: ev.clientX, scroll: roamView.scrollLeft, moved: false };
    });
    roamView.addEventListener('pointermove', function (ev) {
      if (!roamDrag || ev.pointerId !== roamDrag.id) return;
      var dx = ev.clientX - roamDrag.x;
      if (!roamDrag.moved && Math.abs(dx) < 7) return;
      if (!roamDrag.moved) {
        roamDrag.moved = true;
        roamView.setPointerCapture(ev.pointerId);
        roamView.classList.add('is-dragging');
      }
      roamView.scrollLeft = roamDrag.scroll - dx;
    });
    function endRoamDrag(ev) {
      if (!roamDrag || ev.pointerId !== roamDrag.id) return;
      suppressRoamClick = roamDrag.moved;
      roamDrag = null;
      roamView.classList.remove('is-dragging');
      if (roamView.hasPointerCapture(ev.pointerId)) roamView.releasePointerCapture(ev.pointerId);
      setTimeout(function () { suppressRoamClick = false; }, 0);
    }
    window.addEventListener('pointerup', endRoamDrag);
    window.addEventListener('pointercancel', endRoamDrag);
    roamView.addEventListener('click', function (ev) {
      if (!suppressRoamClick) return;
      ev.preventDefault();
      ev.stopPropagation();
      suppressRoamClick = false;
    }, true);
    roamView.addEventListener('dragstart', function (ev) {
      if (rootEl.classList.contains('is-horizontal-roam')) ev.preventDefault();
    });
    roamView.addEventListener('scroll', updateProjectionPositions, { passive: true });

    function setHallMenu(open, restoreFocus) {
      menuToggle.setAttribute('aria-expanded', String(open));
      if (restoreFocus) menuToggle.focus({ preventScroll: true });
    }

    menuToggle.addEventListener('click', function () {
      setHallMenu(menuToggle.getAttribute('aria-expanded') !== 'true');
    });
    topNoteLink.addEventListener('click', function () { setHallMenu(false); });
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape' || menuToggle.getAttribute('aria-expanded') !== 'true') return;
      ev.preventDefault();
      setHallMenu(false, true);
    });
    document.addEventListener('pointerdown', function (ev) {
      if (menuToggle.contains(ev.target) || hallNavigation.contains(ev.target)) return;
      if (menuToggle.getAttribute('aria-expanded') === 'true') setHallMenu(false);
    });

    // --- Wire events ---
    if (enterBtn) enterBtn.addEventListener('click', function () { enterHall({ immediate: false }); });
    if (skipBtn) skipBtn.addEventListener('click', function () { enterHall({ immediate: false }); });

    if (modeRoamBtn) {
      modeRoamBtn.addEventListener('click', function () {
        setViewMode('roam', { updateHash: true });
      });
    }
    if (modeCatalogBtn) {
      modeCatalogBtn.addEventListener('click', function () {
        setViewMode('catalog', { updateHash: true });
      });
    }
    if (brandHomeBtn) {
      brandHomeBtn.addEventListener('click', function (e) {
        e.preventDefault();
        if (ticketCtrl && ticketCtrl.isOpen()) ticketCtrl.close();
        setViewMode('roam', { updateHash: true });
        window.scrollTo({ top: 0, behavior: reducedMedia.matches ? 'auto' : 'smooth' });
        if (rootEl.classList.contains('is-horizontal-roam')) roamView.scrollTo({ left: 0, behavior: reducedMedia.matches ? 'auto' : 'smooth' });
      });
    }
    if (ticketCtrl && ticketOpenBtn) {
      ticketOpenBtn.addEventListener('click', function () {
        setHallMenu(false);
        ticketCtrl.open(mobileMedia.matches ? menuToggle : ticketOpenBtn);
      });
    }
    rootEl.addEventListener('pointermove', onPointerMove, { passive: true });
    rootEl.addEventListener('pointerleave', onPointerLeave);

    if (reducedMedia.addEventListener) reducedMedia.addEventListener('change', applyMotionPreference);
    if (mobileMedia.addEventListener) {
      mobileMedia.addEventListener('change', function () {
        setHallMenu(false);
        if (phase === 'hall' && viewMode === 'roam') layoutRoamNodes();
      });
    }

    var resizeTimer = 0;
    window.addEventListener('resize', function () {
      if (phase !== 'hall' || viewMode !== 'roam') return;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        var nextW = roamView ? roamView.clientWidth : window.innerWidth;
        if (Math.abs(nextW - lastStageWidth) > 0.5 || window.innerWidth >= 768) {
          layoutRoamNodes();
        }
      }, 120);
    }, { passive: true });

    window.addEventListener('hashchange', function () { handleHashRoute(false); });
    window.addEventListener('mujian:footprint-change', refreshFootprintUI);
    window.addEventListener('storage', refreshFootprintUI);
    window.addEventListener('focus', refreshFootprintUI);
    window.addEventListener('pageshow', function () {
      if (Footprint && Footprint.takeRoamReturn) Footprint.takeRoamReturn();
      refreshFootprintUI();
      if (phase === 'hall' && viewMode === 'roam') {
        layoutRoamNodes();
      }
    });

    document.addEventListener('visibilitychange', function () {
      var prev = suspended;
      suspended = document.hidden;
      rootEl.classList.toggle('is-background', suspended);
      if (prev !== suspended) pauseTasks(suspended);
    });

    window.addEventListener('pagehide', function (ev) {
      if (ev.persisted) return;
      clearTasks();
      cancelAnimationFrame(pointerFrame);
      atmosphere.destroy();
    });

    // --- Boot ---
    applyMotionPreference();
    buildHallMotifs();
    buildRoamNodes();
    buildCatalog();
    refreshFootprintUI();
    handleHashRoute(true);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        if (phase === 'hall' && viewMode === 'roam') layoutRoamNodes();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHub);
  } else {
    initHub();
  }
})();
