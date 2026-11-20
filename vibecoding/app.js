/**
 * 幕间漫游 · 5 号模块「vibecoding 合集」
 * - 从 ./data.json 渲染三件影迷自制的排片 / 观影 / 互助小工具
 * - 网页条目：预览图 + 本地 SVG 二维码 + 「打开 / 复制链接」
 * - 微信小程序条目：无二维码，仅「复制口令」，兼容微信内置浏览器
 * - 一键复制三级兜底：navigator.clipboard → textarea+execCommand → 手动长按复制弹窗
 */
(function () {
  'use strict';

  var state = {
    items: [],
    lightboxItems: [],
    lightboxIndex: 0,
    lastFocused: null
  };

  var els = {
    grid: document.getElementById('cards-grid'),
    lightbox: document.getElementById('lightbox'),
    lbMedia: document.getElementById('lb-media'),
    lbCaption: document.getElementById('lb-caption'),
    toast: document.getElementById('toast'),
    copyDialog: document.getElementById('copy-dialog'),
    copyInput: document.getElementById('copy-dialog-input')
  };

  var toastTimer = null;

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getTypeLabel(type) {
    return String(type || '') === '网页应用' ? '网页' : String(type || '');
  }

  // 图片固有尺寸表：仅用于给 <img> 输出 width/height 属性防布局跳动（CLS）。
  // 条目内容（名称/作者/描述/URL）仍以 data.json 为唯一来源；素材更换时同步此处。
  var IMAGE_SIZES = {
    'wenwen-01.jpg': [800, 1200],
    'wenwen-02.jpg': [1200, 1114],
    'lrh-preview.png': [917, 1200],
    'yang-gomovie.jpg': [552, 1200]
  };

  // 二维码渲染分辨率（显示尺寸由 style.css 的 clamp() 控制）
  var QR_RENDER_SIZE = 256;

  function imgDims(src) {
    var base = String(src || '').split('/').pop();
    var d = IMAGE_SIZES[base];
    return (d && d.length === 2) ? ' width="' + d[0] + '" height="' + d[1] + '"' : '';
  }

  // 从 :root 读 CSS 变量；二维码前景/底色不再写死在 JS 里
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

  /* =========================================================
     卡片渲染
     ========================================================= */
  function buildGallery(item, images, isFirst) {
    if (!images.length) {
      return '<div class="c-shot c-shot--empty" aria-hidden="true">暂无预览图</div>';
    }

    var thumbsHtml = '';
    if (images.length > 1) {
      thumbsHtml =
        '<div class="c-thumbs" role="group" aria-label="' + esc(item.name) + ' 预览图切换">' +
        images
          .map(function (src, i) {
            return (
              '<button type="button" class="c-thumb' +
              (i === 0 ? ' is-active' : '') +
              '" data-thumb="' +
              i +
              '" aria-label="查看第 ' +
              (i + 1) +
              ' 张预览图" aria-pressed="' +
              (i === 0 ? 'true' : 'false') +
              '">' +
              '<img src="' + esc(src) + '" alt="" aria-hidden="true" loading="lazy" decoding="async"' + imgDims(src) + '>' +
              '</button>'
            );
          })
          .join('') +
        '</div>';
    }

    return (
      '<figure class="c-shot-wrap">' +
      '<button type="button" class="c-shot" data-photo="0" data-item="' +
      esc(item.id) +
      '" aria-label="放大预览 ' +
      esc(item.name) +
      '">' +
      '<img class="c-shot-img" src="' +
      esc(images[0]) +
      '" alt="' +
      esc(item.author + ' ' + item.name + ' 预览图') +
      '" loading="' +
      (isFirst ? 'eager' : 'lazy') +
      '" decoding="async"' +
      imgDims(images[0]) +
      '>' +
      '</button>' +
      thumbsHtml +
      '</figure>'
    );
  }

  function renderCards() {
    if (!els.grid) return;

    var html = state.items
      .map(function (item, idx) {
        var images = Array.isArray(item.images) ? item.images.filter(Boolean) : [];
        var isWeb = !!item.url;

        var qrHtml = '';
        if (isWeb && window.MujianQR && typeof window.MujianQR.toSVG === 'function') {
          qrHtml =
            '<button type="button" class="c-qr" data-qr="' +
            esc(item.id) +
            '" aria-label="放大查看 ' +
            esc(item.name) +
            ' 的二维码">' +
            window.MujianQR.toSVG(item.url, { size: QR_RENDER_SIZE, fg: cssVar('--qr-fg'), bg: cssVar('--qr-bg') }) +
            '</button>' +
            '<p class="c-qr-hint">扫码打开</p>';
        }

        var actionsHtml;
        if (isWeb) {
          actionsHtml =
            '<a class="c-btn c-btn--primary" href="' +
            esc(item.url) +
            '" target="_blank" rel="noopener noreferrer">打开 ↗</a>' +
            '<button type="button" class="c-btn c-btn--secondary" data-copy="' +
            esc(item.id) +
            '">复制链接</button>';
        } else {
          actionsHtml =
            '<button type="button" class="c-btn c-btn--primary" data-copy="' +
            esc(item.id) +
            '">复制口令</button>' +
            '<p class="c-copy-tip">复制后粘贴至微信任意聊天窗口即可打开</p>';
        }

        return (
          '<article class="c-card">' +
          buildGallery(item, images, idx === 0) +
          '<div class="c-info">' +
          '<p class="c-type">' + esc(getTypeLabel(item.type)) + '</p>' +
          '<h3 class="c-title">' + esc(item.name) + '</h3>' +
          '<p class="c-author">' + esc(item.author) + '</p>' +
          '<p class="c-desc">' + esc(item.description) + '</p>' +
          '</div>' +
          '<div class="c-foot">' +
          qrHtml +
          '<div class="c-actions">' + actionsHtml + '</div>' +
          '</div>' +
          '</article>'
        );
      })
      .join('');

    els.grid.innerHTML = html;
  }

  function findItem(id) {
    for (var i = 0; i < state.items.length; i++) {
      if (state.items[i].id === id) return state.items[i];
    }
    return null;
  }

  /* =========================================================
     LIGHTBOX
     ========================================================= */
  function renderLightboxCurrent() {
    var item = state.lightboxItems[state.lightboxIndex];
    if (!item || !els.lbMedia || !els.lbCaption) return;

    if (item.type === 'qr') {
      els.lbMedia.innerHTML = '<div class="lb-qr-box">' + item.svg + '</div>';
    } else {
      els.lbMedia.innerHTML =
        '<img src="' + esc(item.src) + '" alt="' + esc(item.caption || '') + '" decoding="async">';
    }

    els.lbCaption.textContent = item.caption || '';
    els.lbCaption.hidden = !item.caption;
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

  /* =========================================================
     事件绑定
     ========================================================= */
  function bindEvents() {
    // 卡片交互委托：切换缩略图 / 放大预览 / 复制 / 放大二维码
    if (els.grid) {
      els.grid.addEventListener('click', function (e) {
        var thumb = e.target.closest('[data-thumb]');
        if (thumb) {
          var card = thumb.closest('.c-card');
          var shot = card ? card.querySelector('.c-shot') : null;
          var img = card ? card.querySelector('.c-shot-img') : null;
          var itemId = shot ? shot.getAttribute('data-item') : '';
          var item = findItem(itemId);
          var idx = parseInt(thumb.getAttribute('data-thumb'), 10) || 0;
          if (shot) shot.setAttribute('data-photo', String(idx));
          if (img && item) {
            img.src = item.images[idx];
            img.alt = item.author + ' ' + item.name + ' 预览图';
          }
          card.querySelectorAll('.c-thumb').forEach(function (t) {
            var active = t === thumb;
            t.classList.toggle('is-active', active);
            t.setAttribute('aria-pressed', active ? 'true' : 'false');
          });
          return;
        }

        var shot = e.target.closest('[data-photo]');
        if (shot) {
          var item = findItem(shot.getAttribute('data-item'));
          if (item) {
            var images = Array.isArray(item.images) ? item.images.filter(Boolean) : [];
            var startIdx = parseInt(shot.getAttribute('data-photo'), 10) || 0;
            openLightbox(
              images.map(function (src) {
                return {
                  type: 'image',
                  src: src,
                  caption: item.author + ' · ' + item.name
                };
              }),
              startIdx
            );
          }
          return;
        }

        var qrBtn = e.target.closest('[data-qr]');
        if (qrBtn) {
          var qitem = findItem(qrBtn.getAttribute('data-qr'));
          if (qitem && qitem.url && window.MujianQR && typeof window.MujianQR.toSVG === 'function') {
            openLightbox(
              [
                {
                  type: 'qr',
                  svg: window.MujianQR.toSVG(qitem.url, { size: QR_RENDER_SIZE, fg: cssVar('--qr-fg'), bg: cssVar('--qr-bg') }),
                  caption: qitem.author + ' · ' + qitem.name + '（扫码打开）'
                }
              ],
              0
            );
          }
          return;
        }

        var copyBtn = e.target.closest('[data-copy]');
        if (copyBtn) {
          var citem = findItem(copyBtn.getAttribute('data-copy'));
          if (citem) {
            if (citem.url) {
              copyText(citem.copyText || citem.url, '已复制《' + citem.name + '》链接');
            } else {
              copyText(citem.copyText, '已复制口令，粘贴至微信任意聊天窗口即可打开');
            }
          }
        }
      });
    }

    // Lightbox 关闭
    if (els.lightbox) {
      els.lightbox.addEventListener('click', function (e) {
        if (e.target.hasAttribute('data-lb-close')) closeLightbox();
      });
    }

    // 手动复制弹窗关闭
    if (els.copyDialog) {
      els.copyDialog.addEventListener('click', function (e) {
        if (e.target.hasAttribute('data-cd-close')) closeManualCopy();
      });
    }

    document.addEventListener('keydown', function (e) {
      if (els.lightbox && !els.lightbox.hidden) {
        if (e.key === 'Escape') closeLightbox();
        return;
      }
      if (els.copyDialog && !els.copyDialog.hidden) {
        if (e.key === 'Escape') closeManualCopy();
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
        state.items = Array.isArray(data.items) ? data.items : [];
        renderCards();
      })
      .catch(function () {
        if (els.grid) {
          els.grid.innerHTML = '<div class="error-state">展品数据加载失败，请刷新页面重试。</div>';
        }
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
