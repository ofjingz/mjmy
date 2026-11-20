/**
 * 幕间漫游 · 3 号模块「影 诗」
 * - 文章 · 影迷书写（5 篇全文与配图，每篇专属手绘水印 + 独立分享哈希 #article=<id>）
 * - 短视频 · 影像共创（12 支作品，离线 SVG 二维码 / 视频号原图二维码 + 一键复制链接与口令）
 */
(function () {
  'use strict';

  var MOTIF_MAP = {
    moon: '/shared/motifs/moon-outline.png',
    sprig: '/shared/motifs/sprig.svg',
    umbrella: '/shared/motifs/umbrella-outline.png',
    typewriter: '/shared/motifs/typewriter-outline.png',
    record: '/shared/motifs/record-outline.png'
  };

  var state = {
    articles: [],
    videos: [],
    activeTab: 'articles',
    activeArticleId: '',
    activePlatform: '全部',
    lightboxItems: [],
    lightboxIndex: 0,
    lastFocused: null
  };

  var els = {
    tabButtons: Array.prototype.slice.call(document.querySelectorAll('.tab-btn')),
    panelArticles: document.getElementById('panel-articles'),
    panelVideos: document.getElementById('panel-videos'),
    articleList: document.getElementById('article-list'),
    letterSheet: document.getElementById('letter-sheet'),
    platformFilters: document.getElementById('platform-filters'),
    videoGrid: document.getElementById('video-grid'),
    lightbox: document.getElementById('lightbox'),
    lbMedia: document.getElementById('lb-media'),
    lbCaption: document.getElementById('lb-caption'),
    lbPrev: document.getElementById('lb-prev'),
    lbNext: document.getElementById('lb-next'),
    toast: document.getElementById('toast')
  };

  var toastTimer = null;

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getMotifSrc(motifName) {
    if (!motifName) return MOTIF_MAP.typewriter;
    if (MOTIF_MAP[motifName]) return MOTIF_MAP[motifName];
    return '/shared/motifs/' + encodeURIComponent(motifName) + '-outline.png';
  }

  function isHashCaption(caption) {
    return /^[0-9a-f]{32}$/i.test(String(caption || '').trim());
  }

  function showToast(message) {
    if (!els.toast) return;
    els.toast.textContent = message;
    els.toast.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      els.toast.hidden = true;
    }, 2600);
  }

  function copyToClipboard(text, successMsg) {
    var str = String(text || '');
    if (!str) return;

    function fallbackCopy() {
      var ta = document.createElement('textarea');
      ta.value = str;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-9999px';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try {
        document.execCommand('copy');
        showToast(successMsg || '已复制到剪贴板');
      } catch (_) {
        showToast('复制失败，请手动长按复制');
      }
      document.body.removeChild(ta);
    }

    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(str).then(
        function () {
          showToast(successMsg || '已复制到剪贴板');
        },
        function () {
          fallbackCopy();
        }
      );
    } else {
      fallbackCopy();
    }
  }

  /* =========================================================
     HASH ROUTING (#articles / #videos / #article=<id>)
     ========================================================= */
  function parseHash() {
    var raw = (window.location.hash || '').replace(/^#/, '');
    if (!raw || raw === 'articles') {
      return { tab: 'articles', articleId: state.articles[0] ? state.articles[0].id : '' };
    }
    if (raw === 'videos') {
      return { tab: 'videos', articleId: state.activeArticleId || (state.articles[0] ? state.articles[0].id : '') };
    }
    if (raw.indexOf('article=') === 0) {
      var targetId = decodeURIComponent(raw.slice('article='.length));
      var found = state.articles.some(function (a) { return a.id === targetId; });
      return {
        tab: 'articles',
        articleId: found ? targetId : (state.articles[0] ? state.articles[0].id : '')
      };
    }
    return { tab: 'articles', articleId: state.articles[0] ? state.articles[0].id : '' };
  }

  function updateHash(hashStr) {
    var normalized = hashStr.charAt(0) === '#' ? hashStr : '#' + hashStr;
    if (window.location.hash === normalized) return;
    if (window.history && typeof window.history.replaceState === 'function') {
      window.history.replaceState(null, '', normalized);
    } else {
      window.location.hash = normalized;
    }
  }

  function setTab(tabName, opts) {
    opts = opts || {};
    state.activeTab = tabName === 'videos' ? 'videos' : 'articles';

    els.tabButtons.forEach(function (btn) {
      var active = btn.getAttribute('data-tab') === state.activeTab;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    els.panelArticles.hidden = state.activeTab !== 'articles';
    els.panelVideos.hidden = state.activeTab !== 'videos';

    if (!opts.skipHash) {
      if (state.activeTab === 'videos') {
        updateHash('#videos');
      } else if (state.activeArticleId) {
        updateHash('#article=' + encodeURIComponent(state.activeArticleId));
      } else {
        updateHash('#articles');
      }
    }
  }

  /* =========================================================
     ARTICLES RENDERING
     ========================================================= */
  function renderArticleList() {
    if (!els.articleList) return;
    var html = state.articles
      .map(function (article) {
        var active = article.id === state.activeArticleId;

        return (
          '<button type="button" class="article-item' +
          (active ? ' is-active' : '') +
          '" data-article-id="' +
          escapeHtml(article.id) +
          '" aria-current="' +
          (active ? 'true' : 'false') +
          '">' +
          '<div class="article-item-main">' +
          '<div class="article-item-meta">' +
          '<span class="article-item-author">' +
          escapeHtml(article.author) +
          '</span>' +
          '</div>' +
          '<div class="article-item-title">' +
          escapeHtml(article.title) +
          '</div>' +
          '</div>' +
          '<img class="article-item-motif" src="' +
          escapeHtml(getMotifSrc(article.motif)) +
          '" alt="" aria-hidden="true">' +
          '</button>'
        );
      })
      .join('');

    els.articleList.innerHTML = html;
  }

  function renderArticleBlocks(article, photos) {
    var blocks = Array.isArray(article.blocks) ? article.blocks : [];
    if (!blocks.length) return { headingText: article.title, bodyHtml: '' };

    var headingText = '';
    var startIndex = 0;

    // If block 0 is the exact title (with or without 《》), use it as the sheet H1 so zero text is lost and nothing duplicates awkwardly
    var first = blocks[0];
    if (first && first.type === 'paragraph') {
      var trimmed = String(first.text || '').trim();
      if (trimmed === article.title || trimmed === '《' + article.title + '》') {
        headingText = trimmed;
        startIndex = 1;
      }
    }

    var isPoetic = article.id === 'xiaowen-hk' || article.id === 'zige-margueritte';
    var photoList = Array.isArray(photos) ? photos : [];
    var photoQueue = photoList.map(function (p, idx) {
      return { photo: p, idx: idx, used: false };
    });
    var items = [];

    function figureHtml(entry) {
      var photo = entry.photo;
      var cleanCap = isHashCaption(photo.caption) ? '' : String(photo.caption || '').trim();
      var altText = cleanCap || article.title + ' · 配图';
      return (
        '<figure class="sheet-inline-figure">' +
        '<button type="button" class="inline-photo-trigger" data-photo-idx="' +
        entry.idx +
        '" aria-label="查看大图：' +
        escapeHtml(altText) +
        '">' +
        '<img src="' +
        escapeHtml(photo.src) +
        '" alt="' +
        escapeHtml(altText) +
        '" loading="lazy" decoding="async">' +
        '</button>' +
        (cleanCap ? '<figcaption>' + escapeHtml(cleanCap) + '</figcaption>' : '') +
        '</figure>'
      );
    }

    function captionKeywords(caption) {
      var c = String(caption || '').trim();
      if (!c) return [];
      return c.split(/[^\u4e00-\u9fffA-Za-z0-9]+/).filter(function (t) { return t.length >= 2; });
    }

    for (var i = startIndex; i < blocks.length; i++) {
      var b = blocks[i];
      if (!b) continue;

      if (b.type === 'table' && Array.isArray(b.rows)) {
        var rowsHtml = b.rows
          .map(function (row, rIdx) {
            var tag = rIdx === 0 && b.hasHeader !== false ? 'th' : 'td';
            var cells = (Array.isArray(row) ? row : [])
              .map(function (cell) {
                return '<' + tag + '>' + escapeHtml(cell) + '</' + tag + '>';
              })
              .join('');
            return '<tr>' + cells + '</tr>';
          })
          .join('');
        items.push({ html: '<div class="sheet-table-wrap"><table class="sheet-table">' + rowsHtml + '</table></div>', text: '' });
        continue;
      }

      if (b.type === 'image' && b.src) {
        items.push({
          html:
            '<figure class="sheet-inline-figure">' +
            '<img src="' + escapeHtml(b.src) + '" alt="' + escapeHtml(b.caption || article.title) + '" loading="lazy" data-inline-img="' + escapeHtml(b.src) + '" data-inline-caption="' + escapeHtml(b.caption || '') + '">' +
            (b.caption ? '<figcaption>' + escapeHtml(b.caption) + '</figcaption>' : '') +
            '</figure>',
          text: ''
        });
        continue;
      }

      var text = String(b.text == null ? '' : b.text);
      var style = String(b.style || '');
      var classes = [];

      if (style === 'Subtitle') {
        classes.push('is-subtitle');
      } else if (text.indexOf('\n') !== -1 && text.indexOf('——') !== -1) {
        classes.push('is-epigraph');
      } else if (/^[一二三四五六七八九十]+、/.test(text.trim())) {
        classes.push('is-section-heading');
      } else if (
        i >= blocks.length - 2 &&
        article.id === 'lulu-closeup' &&
        (text.trim() === article.author || /^\d{4}年\d{1,2}月\d{1,2}日$/.test(text.trim()))
      ) {
        classes.push('is-signature');
      }

      items.push({
        html: '<p' + (classes.length ? ' class="' + classes.join(' ') + '"' : '') + '>' + escapeHtml(text) + '</p>',
        text: text
      });
    }

    // ① 图片说明关键词能对上某段正文的，插到该段之后
    photoQueue.forEach(function (entry) {
      if (entry.used) return;
      var kws = captionKeywords(entry.photo.caption);
      if (!kws.length) return;
      for (var k = 0; k < items.length; k++) {
        var it = items[k];
        if (!it.text) continue;
        for (var w = 0; w < kws.length; w++) {
          if (it.text.indexOf(kws[w]) !== -1) {
            entry.used = true;
            it.figures = (it.figures || []).concat([figureHtml(entry)]);
            return;
          }
        }
      }
    });

    // ② 匹配不上的图片按比例均匀插入正文段落之间
    var leftovers = photoQueue.filter(function (e) { return !e.used; });
    var paraIdx = [];
    for (var p = 0; p < items.length; p++) if (items[p].text) paraIdx.push(p);
    leftovers.forEach(function (entry, k) {
      var pos = paraIdx.length
        ? paraIdx[Math.min(paraIdx.length - 1, Math.floor((k + 1) * paraIdx.length / (leftovers.length + 1)))]
        : Math.max(0, items.length - 1);
      items[pos].figures = (items[pos].figures || []).concat([figureHtml(entry)]);
    });

    var html = items.map(function (it) {
      return it.html + (it.figures ? it.figures.join('') : '');
    }).join('');

    return {
      headingText: headingText || article.title,
      bodyHtml: '<div class="sheet-body' + (isPoetic ? ' is-poetic' : '') + '">' + html + '</div>'
    };
  }

  function renderArticleSheet(articleId, opts) {
    opts = opts || {};
    var idx = -1;
    for (var i = 0; i < state.articles.length; i++) {
      if (state.articles[i].id === articleId) {
        idx = i;
        break;
      }
    }
    if (idx === -1) idx = 0;
    var article = state.articles[idx];
    if (!article || !els.letterSheet) return;

    state.activeArticleId = article.id;
    renderArticleList();

    var motifSrc = getMotifSrc(article.motif);
    var photos = Array.isArray(article.photos) ? article.photos : [];
    var rendered = renderArticleBlocks(article, photos);

    var prevArticle = state.articles[(idx - 1 + state.articles.length) % state.articles.length];
    var nextArticle = state.articles[(idx + 1) % state.articles.length];

    var sheetHtml =
      '<img class="paper-watermark' +
      (article.motif === 'sprig' ? ' paper-watermark--sprig' : '') +
      '" src="' +
      escapeHtml(motifSrc) +
      '" alt="" aria-hidden="true">' +
      '<img class="paper-watermark--bottom" src="' +
      escapeHtml(motifSrc) +
      '" alt="" aria-hidden="true">' +
      '<div class="sheet-inner">' +
      '<header class="sheet-header">' +
      '<h2 class="sheet-title">' +
      escapeHtml(rendered.headingText) +
      '</h2>' +
      '<div class="sheet-byline">' +
      '<span class="sheet-author">文 / ' +
      escapeHtml(article.author) +
      '</span>' +
      '</div>' +
      '</header>' +
      rendered.bodyHtml +
      '<footer class="sheet-footer">' +
      '<nav class="sheet-pager" aria-label="上一篇与下一篇文章">' +
      '<button type="button" class="pager-btn pager-btn--prev" data-jump-article="' +
      escapeHtml(prevArticle.id) +
      '">' +
      '<span class="pager-dir">← 上一篇</span>' +
      '<span class="pager-title">' +
      escapeHtml(prevArticle.author) +
      ' · ' +
      escapeHtml(prevArticle.title) +
      '</span>' +
      '</button>' +
      '<button type="button" class="pager-btn pager-btn--next" data-jump-article="' +
      escapeHtml(nextArticle.id) +
      '">' +
      '<span class="pager-dir">下一篇 →</span>' +
      '<span class="pager-title">' +
      escapeHtml(nextArticle.author) +
      ' · ' +
      escapeHtml(nextArticle.title) +
      '</span>' +
      '</button>' +
      '</nav>' +
      '</footer>' +
      '</div>';

    els.letterSheet.innerHTML = sheetHtml;
    document.title = article.title + ' · 影 诗 · 幕间漫游';

    // Bind prev/next buttons
    Array.prototype.slice.call(els.letterSheet.querySelectorAll('[data-jump-article]')).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var nextId = btn.getAttribute('data-jump-article');
        renderArticleSheet(nextId, { scrollToSheet: true });
      });
    });

    // Bind photo gallery lightbox
    Array.prototype.slice.call(els.letterSheet.querySelectorAll('[data-photo-idx]')).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var pIdx = parseInt(btn.getAttribute('data-photo-idx'), 10) || 0;
        var lbItems = photos.map(function (p) {
          var caption = isHashCaption(p.caption) ? '' : p.caption;
          return { type: 'image', src: p.src, caption: caption, alt: caption || article.title + ' · 配图' };
        });
        openLightbox(lbItems, pIdx);
      });
    });

    // Bind inline images if any
    Array.prototype.slice.call(els.letterSheet.querySelectorAll('[data-inline-img]')).forEach(function (img) {
      img.addEventListener('click', function () {
        openLightbox([{ type: 'image', src: img.getAttribute('data-inline-img'), caption: img.getAttribute('data-inline-caption') || '' }], 0);
      });
    });

    if (!opts.skipHash && state.activeTab === 'articles') {
      updateHash('#article=' + encodeURIComponent(article.id));
    }

    if (opts.scrollToSheet) {
      var stage = document.getElementById('reading-stage');
      if (stage && typeof stage.scrollIntoView === 'function') {
        stage.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  /* =========================================================
     SHORT VIDEOS RENDERING
     ========================================================= */
  function getPlatformClass(platform) {
    if (platform === '哔哩哔哩') return 'platform-badge--bili';
    if (platform === '抖音') return 'platform-badge--douyin';
    if (platform === '微信视频号') return 'platform-badge--wechat';
    return 'platform-badge--bili';
  }

  function renderPlatformFilters() {
    if (!els.platformFilters) return;
    var order = ['全部'].concat(Array.from(new Set(state.videos.map(function (video) {
      return video.platform;
    }))));

    els.platformFilters.innerHTML = order
      .map(function (plat) {
        var active = state.activePlatform === plat;
        return (
          '<button type="button" class="filter-pill' +
          (active ? ' is-active' : '') +
          '" data-platform="' +
          escapeHtml(plat) +
          '" aria-pressed="' +
          (active ? 'true' : 'false') +
          '">' +
          escapeHtml(plat) +
          '</button>'
        );
      })
      .join('');
  }

  function renderVideoGrid() {
    if (!els.videoGrid) return;
    var list = state.videos.filter(function (v) {
      return state.activePlatform === '全部' || v.platform === state.activePlatform;
    });

    var html = list
      .map(function (v) {
        var isWechat = v.platform === '微信视频号';
        var isDouyin = v.platform === '抖音';
        var qrHtml = '';

        if (v.qrImage) {
          qrHtml =
            '<button type="button" class="qr-frame qr-frame--photo" data-qr-video="' +
            escapeHtml(v.id) +
            '" aria-label="放大查看 ' +
            escapeHtml(v.author) +
            ' 的二维码">' +
            '<img src="' +
            escapeHtml(v.qrImage) +
            '" alt="' +
            escapeHtml(v.author + ' ' + v.title + ' 二维码') +
            '" loading="lazy">' +
            '</button>';
        } else if (window.MujianQR && typeof window.MujianQR.toSVG === 'function') {
          var svg = window.MujianQR.toSVG(v.url, { size: 148, fg: '#161618', bg: '#ffffff' });
          qrHtml =
            '<button type="button" class="qr-frame" data-qr-video="' +
            escapeHtml(v.id) +
            '" aria-label="放大查看 ' +
            escapeHtml(v.title) +
            ' 二维码">' +
            svg +
            '</button>';
        }

        var qrHint = isWechat
          ? '<p class="qr-hint qr-hint--wechat">微信内长按或扫码观看</p>'
          : '';

        var actionsHtml = '';
        if (isWechat) {
          actionsHtml =
            '<button type="button" class="v-btn v-btn--primary" data-copy-video="' +
            escapeHtml(v.id) +
            '">复制链接</button>';
        } else {
          var copyLabel = isDouyin ? '复制抖音口令，打开抖音观看' : '复制视频链接';
          actionsHtml =
            '<a class="v-btn v-btn--primary" href="' +
            escapeHtml(v.url) +
            '" target="_blank" rel="noopener noreferrer">前往观看 ↗</a>' +
            '<button type="button" class="v-btn v-btn--secondary" data-copy-video="' +
            escapeHtml(v.id) +
            '">' +
            copyLabel +
            '</button>';
        }

        return (
          '<article class="video-card">' +
          '<div class="video-card-top">' +
          '<span class="platform-badge ' +
          getPlatformClass(v.platform) +
          '">' +
          escapeHtml(v.platform) +
          '</span>' +
          '</div>' +
          '<div class="video-info">' +
          '<h2 class="video-title">' +
          escapeHtml(v.title) +
          '</h2>' +
          '<p class="video-author">创作者：<strong>' +
          escapeHtml(v.author) +
          '</strong></p>' +
          '</div>' +
          '<div class="video-qr-zone">' +
          qrHtml +
          qrHint +
          '</div>' +
          '<div class="video-actions">' +
          actionsHtml +
          '</div>' +
          '</article>'
        );
      })
      .join('');

    els.videoGrid.innerHTML = html;
  }

  /* =========================================================
     LIGHTBOX
     ========================================================= */
  function renderLightboxCurrent() {
    var item = state.lightboxItems[state.lightboxIndex];
    if (!item || !els.lbMedia || !els.lbCaption) return;

    if (item.type === 'qr-svg') {
      els.lbMedia.innerHTML = '<div class="lb-qr-box">' + item.svg + '</div>';
    } else if (item.type === 'qr-img') {
      els.lbMedia.innerHTML =
        '<div class="lb-qr-box"><img src="' +
        escapeHtml(item.src) +
        '" alt="' +
        escapeHtml(item.caption || '二维码') +
        '"></div>';
    } else {
      els.lbMedia.innerHTML =
        '<img src="' + escapeHtml(item.src) + '" alt="' + escapeHtml(item.alt || item.caption || '') + '">';
    }

    els.lbCaption.textContent = item.caption || '';
    els.lbCaption.hidden = !item.caption;

    var hasMulti = state.lightboxItems.length > 1;
    els.lbPrev.hidden = !hasMulti;
    els.lbNext.hidden = !hasMulti;
  }

  function openLightbox(items, startIdx) {
    if (!items || !items.length || !els.lightbox) return;
    state.lastFocused = document.activeElement;
    state.lightboxItems = items;
    state.lightboxIndex = Math.max(0, Math.min(startIdx || 0, items.length - 1));
    renderLightboxCurrent();
    els.lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
    var closeBtn = els.lightbox.querySelector('.lightbox-close');
    if (closeBtn) closeBtn.focus();
  }

  function closeLightbox() {
    if (!els.lightbox || els.lightbox.hidden) return;
    els.lightbox.hidden = true;
    document.body.style.overflow = '';
    if (state.lastFocused && typeof state.lastFocused.focus === 'function') {
      state.lastFocused.focus();
    }
  }

  function stepLightbox(delta) {
    if (state.lightboxItems.length <= 1) return;
    state.lightboxIndex = (state.lightboxIndex + delta + state.lightboxItems.length) % state.lightboxItems.length;
    renderLightboxCurrent();
  }

  /* =========================================================
     EVENT WIRING
     ========================================================= */
  function bindEvents() {
    // Top tabs + arrow key navigation
    els.tabButtons.forEach(function (btn, idx) {
      btn.addEventListener('click', function () {
        setTab(btn.getAttribute('data-tab'));
      });
      btn.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          var nextIdx = (idx + 1) % els.tabButtons.length;
          els.tabButtons[nextIdx].focus();
          setTab(els.tabButtons[nextIdx].getAttribute('data-tab'));
        }
      });
    });

    // Article switcher delegation
    if (els.articleList) {
      els.articleList.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-article-id]');
        if (!btn) return;
        var id = btn.getAttribute('data-article-id');
        if (id && id !== state.activeArticleId) {
          renderArticleSheet(id, { scrollToSheet: window.innerWidth <= 1020 });
        }
      });
    }

    // Video platform filter delegation
    if (els.platformFilters) {
      els.platformFilters.addEventListener('click', function (e) {
        var pill = e.target.closest('[data-platform]');
        if (!pill) return;
        state.activePlatform = pill.getAttribute('data-platform') || '全部';
        renderPlatformFilters();
        renderVideoGrid();
      });
    }

    // Video copy & QR zoom delegation
    if (els.videoGrid) {
      els.videoGrid.addEventListener('click', function (e) {
        var copyBtn = e.target.closest('[data-copy-video]');
        if (copyBtn) {
          var vid = copyBtn.getAttribute('data-copy-video');
          var video = state.videos.find(function (v) { return v.id === vid; });
          if (video) {
            var msg =
              video.platform === '抖音'
                ? '已复制抖音口令，打开抖音 App 即可观看'
                : video.platform === '微信视频号'
                  ? '已复制视频号链接，粘贴至微信聊天即可打开'
                  : '已复制视频链接';
            copyToClipboard(video.copyText || video.url, msg);
          }
          return;
        }

        var qrBtn = e.target.closest('[data-qr-video]');
        if (qrBtn) {
          var qvid = qrBtn.getAttribute('data-qr-video');
          var vObj = state.videos.find(function (v) { return v.id === qvid; });
          if (!vObj) return;
          if (vObj.qrImage) {
            openLightbox(
              [{ type: 'qr-img', src: vObj.qrImage, caption: vObj.author + ' · ' + vObj.title + '（微信内长按或扫码观看）' }],
              0
            );
          } else if (window.MujianQR) {
            openLightbox(
              [{
                type: 'qr-svg',
                svg: window.MujianQR.toSVG(vObj.url, { size: 260, fg: '#161618', bg: '#ffffff' }),
                caption: vObj.author + ' · ' + vObj.title + '（' + vObj.platform + '）'
              }],
              0
            );
          }
        }
      });
    }

    // Lightbox controls
    if (els.lightbox) {
      els.lightbox.addEventListener('click', function (e) {
        if (e.target.hasAttribute('data-lb-close')) {
          closeLightbox();
        }
      });
    }
    if (els.lbPrev) els.lbPrev.addEventListener('click', function () { stepLightbox(-1); });
    if (els.lbNext) els.lbNext.addEventListener('click', function () { stepLightbox(1); });

    document.addEventListener('keydown', function (e) {
      if (!els.lightbox || els.lightbox.hidden) return;
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowLeft') stepLightbox(-1);
      else if (e.key === 'ArrowRight') stepLightbox(1);
    });

    // Hash change support (browser Back/Forward or deep links)
    window.addEventListener('hashchange', function () {
      var route = parseHash();
      if (route.articleId && route.articleId !== state.activeArticleId) {
        renderArticleSheet(route.articleId, { skipHash: true });
      }
      setTab(route.tab, { skipHash: true });
    });
  }

  /* =========================================================
     INIT
     ========================================================= */
  function init() {
    bindEvents();
    fetch('./data.json')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        state.articles = Array.isArray(data.articles) ? data.articles : [];
        state.videos = Array.isArray(data.videos) ? data.videos : [];

        var route = parseHash();
        if (state.articles.length) {
          renderArticleSheet(route.articleId || state.articles[0].id, { skipHash: true });
        }
        renderPlatformFilters();
        renderVideoGrid();
        setTab(route.tab, { skipHash: true });
      })
      .catch(function () {
        if (els.letterSheet) {
          els.letterSheet.innerHTML = '<div class="error-state">展品数据加载失败，请刷新页面重试。</div>';
        }
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
