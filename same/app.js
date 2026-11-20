/**
 * 幕间漫游 · 9 号模块「same」（SAME 展区）
 * - 从 ./data.json 渲染：展区页眉、宣传片 Hero、30 张胶片放映档案画廊
 * - 宣传片《如果你不想》：小红书短链 → 「观看短片」（新窗口）+ 本地 SVG 二维码 + 复制链接
 * - 一键复制三级兜底：navigator.clipboard → textarea+execCommand → 手动长按复制弹窗
 * - 画廊 lightbox：点开大图、左右翻看、Esc 关闭、焦点返回；二维码点击放大
 */
(function () {
  'use strict';

  var state = {
    photos: [],
    lightboxItems: [],
    lightboxIndex: 0,
    lastFocused: null
  };

  var els = {
    title: document.getElementById('exhibit-title'),
    author: document.getElementById('exhibit-author'),
    promo: document.getElementById('promo-inner'),
    gallery: document.getElementById('gallery-grid'),
    lightbox: document.getElementById('lightbox'),
    lbMedia: document.getElementById('lb-media'),
    lbCaption: document.getElementById('lb-caption'),
    lbPrev: document.getElementById('lb-prev'),
    lbNext: document.getElementById('lb-next'),
    toast: document.getElementById('toast'),
    copyDialog: document.getElementById('copy-dialog'),
    copyInput: document.getElementById('copy-dialog-input')
  };

  var toastTimer = null;

  // 图片固有尺寸表：仅用于给 <img> 输出 width/height 属性防布局跳动（CLS）。
  // 内容（caption / src / 链接）仍以 data.json 为唯一来源；素材更换时同步此处。
  var IMAGE_SIZES = {
    'same-01.jpg': [1400, 1050],
    'same-02.jpg': [1400, 1050],
    'same-03.jpg': [1400, 1050],
    'same-04.jpg': [1400, 1400],
    'same-05.jpg': [1400, 1400],
    'same-06.jpg': [1400, 1050],
    'same-07.jpg': [1400, 1050],
    'same-08.jpg': [787, 1400],
    'same-09.jpg': [787, 1400],
    'same-10.jpg': [787, 1400],
    'same-11.jpg': [787, 1400],
    'same-12.jpg': [1400, 1050],
    'same-13.jpg': [1400, 1050],
    'same-14.jpg': [1400, 1050],
    'same-15.jpg': [1400, 1050],
    'same-16.jpg': [1400, 1050],
    'same-17.jpg': [1049, 1400],
    'same-18.jpg': [939, 1400],
    'same-19.jpg': [1400, 1050],
    'same-20.jpg': [1050, 1400],
    'same-21.jpg': [1400, 1368],
    'same-22.jpg': [1400, 1050],
    'same-23.jpg': [1400, 933],
    'same-24.jpg': [1400, 1050],
    'same-25.jpg': [1400, 1050],
    'same-26.jpg': [1400, 1050],
    'same-27.jpg': [1400, 1050],
    'same-28.jpg': [1400, 1050],
    'same-29.jpg': [1400, 1050],
    'same-30.jpg': [1050, 1400]
  };

  // 二维码渲染分辨率（显示尺寸由 style.css 的 clamp() 控制）
  var QR_RENDER_SIZE = 256;

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function imgDims(src) {
    var base = String(src || '').split('/').pop();
    var d = IMAGE_SIZES[base];
    return (d && d.length === 2) ? ' width="' + d[0] + '" height="' + d[1] + '"' : '';
  }

  // 从 :root 读 CSS 变量；二维码前景/底色不写死在 JS 里
  function cssVar(name) {
    try {
      return (getComputedStyle(document.documentElement).getPropertyValue(name) || '').trim();
    } catch (_) {
      return '';
    }
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

  function showManualCopy(text) {
    if (!els.copyDialog || !els.copyInput) return;
    els.copyInput.value = String(text || '');
    els.copyDialog.hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(function () {
      els.copyInput.focus();
      els.copyInput.select();
      try { els.copyInput.setSelectionRange(0, els.copyInput.value.length); } catch (_) {}
    }, 30);
  }

  function closeManualCopy() {
    if (!els.copyDialog || els.copyDialog.hidden) return;
    els.copyDialog.hidden = true;
    document.body.style.overflow = '';
  }

  function copyText(text, successMsg) {
    var str = String(text || '');
    if (!str) return;

    function execFallback() {
      var ta = document.createElement('textarea');
      ta.value = str;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-9999px';
      ta.style.left = '-9999px';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try {
        ta.setSelectionRange(0, str.length);
      } catch (_) {}
      var ok = false;
      try {
        ok = document.execCommand('copy');
      } catch (_) {
        ok = false;
      }
      document.body.removeChild(ta);
      return ok;
    }

    function done() {
      showToast(successMsg || '已复制到剪贴板');
    }

    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(str).then(
        done,
        function () {
          if (execFallback()) done();
          else showManualCopy(str);
        }
      );
    } else if (execFallback()) {
      done();
    } else {
      showManualCopy(str);
    }
  }

  function qrSVG(url) {
    if (window.MujianQR && typeof window.MujianQR.toSVG === 'function') {
      return window.MujianQR.toSVG(url, {
        size: QR_RENDER_SIZE,
        fg: cssVar('--qr-fg'),
        bg: cssVar('--qr-bg')
      });
    }
    return '';
  }

  /* =========================================================
     页眉渲染（title / author 来自 data.json）
     ========================================================= */
  function renderHeader(data) {
    if (els.title && data.title != null) els.title.textContent = String(data.title);
    if (els.author && data.author != null) els.author.textContent = String(data.author);
  }

  /* =========================================================
     宣传片 Hero
     ========================================================= */
  function renderPromo(video) {
    if (!els.promo) return;
    if (!video || !video.url) {
      els.promo.innerHTML = '<p class="error-state">宣传片信息缺失。</p>';
      return;
    }

    var title = video.title || '宣传片';
    var platform = video.platform || '';
    var qr = qrSVG(video.url);

    var qrHtml = qr
      ? '<button type="button" class="c-qr" data-qr aria-label="放大查看宣传片二维码">' +
        qr +
        '</button><p class="c-qr-hint">扫码打开</p>'
      : '';

    els.promo.innerHTML =
      '<div class="promo-copy">' +
      '<p class="promo-platform">' + esc(platform) + '</p>' +
      '<h2 class="promo-title" id="promo-title">' + esc(title) + '</h2>' +
      '<div class="promo-actions">' +
      '<a class="c-btn c-btn--primary" href="' + esc(video.url) + '" target="_blank" rel="noopener noreferrer">观看短片 ↗</a>' +
      '<button type="button" class="c-btn c-btn--secondary" data-copy>复制链接</button>' +
      '</div>' +
      '</div>' +
      '<div class="promo-qr">' + qrHtml + '</div>';
  }

  /* =========================================================
     画廊渲染
     ========================================================= */
  function photoCaption(photo) {
    var caption = String(photo.caption || '').trim();
    return /^(?:IMG[_-])?\d+\.(?:jpg|jpeg|png)$|^IMG[_-]\d+$/i.test(caption) ? '' : caption;
  }

  function renderGallery(photos) {
    if (!els.gallery) return;
    if (!photos.length) {
      els.gallery.innerHTML = '<div class="error-state">档案照片缺失。</div>';
      return;
    }


    els.gallery.innerHTML = photos
      .map(function (p, i) {
        var caption = photoCaption(p);
        return (
          '<figure class="g-card">' +
          '<button type="button" class="g-shot" data-photo="' + i + '" aria-label="放大查看 ' + esc(caption || '胶片档案照片') + '">' +
          '<img class="g-shot-img" src="' + esc(p.src) + '" alt="' + esc(caption || '胶片档案照片') + '"' +
          ' loading="' + (i < 3 ? 'eager' : 'lazy') + '" decoding="async"' + imgDims(p.src) + '>' +
          '</button>' +
          (caption ? '<figcaption class="g-caption">' + esc(caption) + '</figcaption>' : '') +
          '</figure>'
        );
      })
      .join('');
  }

  /* =========================================================
     LIGHTBOX（图片 + 二维码，支持左右翻看）
     ========================================================= */
  function renderLightboxCurrent() {
    var item = state.lightboxItems[state.lightboxIndex];
    if (!item || !els.lbMedia || !els.lbCaption) return;

    if (item.type === 'qr') {
      els.lbMedia.innerHTML = '<div class="lb-qr-box">' + item.svg + '</div>';
    } else {
      els.lbMedia.innerHTML =
        '<img src="' + esc(item.src) + '" alt="' + esc(item.caption || '胶片档案照片') + '" decoding="async">';
    }

    var total = state.lightboxItems.length;
    els.lbCaption.textContent = item.caption || '';
    els.lbCaption.hidden = !item.caption;

    if (els.lbPrev) els.lbPrev.hidden = total <= 1;
    if (els.lbNext) els.lbNext.hidden = total <= 1;
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
    var total = state.lightboxItems.length;
    if (!els.lightbox || els.lightbox.hidden || total <= 1) return;
    state.lightboxIndex = (state.lightboxIndex + delta + total) % total;
    renderLightboxCurrent();
  }

  /* =========================================================
     事件绑定
     ========================================================= */
  function bindEvents() {
    // Hero / 画廊交互委托：复制链接、放大二维码、点开照片
    document.addEventListener('click', function (e) {
      var copyBtn = e.target.closest('[data-copy]');
      if (copyBtn && state.promoUrl) {
        copyText(state.promoUrl, '已复制宣传片链接');
        return;
      }

      var qrBtn = e.target.closest('[data-qr]');
      if (qrBtn && state.promoUrl && window.MujianQR && typeof window.MujianQR.toSVG === 'function') {
        openLightbox(
          [{ type: 'qr', svg: qrSVG(state.promoUrl), caption: '宣传片二维码（扫码打开）' }],
          0
        );
        return;
      }

      var shot = e.target.closest('[data-photo]');
      if (shot) {
        var idx = parseInt(shot.getAttribute('data-photo'), 10) || 0;
        openLightbox(
          state.photos.map(function (p) {
            return { type: 'image', src: p.src, caption: photoCaption(p) };
          }),
          idx
        );
        return;
      }
    });

    // Lightbox：遮罩 / 关闭按钮 / 左右翻看
    if (els.lightbox) {
      els.lightbox.addEventListener('click', function (e) {
        if (e.target.hasAttribute('data-lb-close')) closeLightbox();
        else if (e.target.closest('#lb-prev')) stepLightbox(-1);
        else if (e.target.closest('#lb-next')) stepLightbox(1);
      });
    }

    // 手动复制弹窗关闭
    if (els.copyDialog) {
      els.copyDialog.addEventListener('click', function (e) {
        if (e.target.hasAttribute('data-cd-close')) closeManualCopy();
      });
    }

    // 键盘：Esc 关闭、左右方向键翻看
    document.addEventListener('keydown', function (e) {
      if (els.lightbox && !els.lightbox.hidden) {
        if (e.key === 'Escape') {
          closeLightbox();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          stepLightbox(-1);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          stepLightbox(1);
        }
        return;
      }
      if (els.copyDialog && !els.copyDialog.hidden && e.key === 'Escape') {
        closeManualCopy();
      }
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
        renderHeader(data);
        state.promoUrl = data.promoVideo && data.promoVideo.url ? String(data.promoVideo.url) : '';
        renderPromo(data.promoVideo);
        state.photos = Array.isArray(data.photos) ? data.photos : [];
        renderGallery(state.photos);
      })
      .catch(function () {
        if (els.gallery) {
          els.gallery.innerHTML = '<div class="error-state">档案数据加载失败，请刷新页面重试。</div>';
        }
        if (els.promo) {
          els.promo.innerHTML = '<div class="error-state">宣传片数据加载失败。</div>';
        }
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
