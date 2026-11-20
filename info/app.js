(function () {
  'use strict';

  var toastTimer = 0;

  function showToast(message) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove('is-visible');
    }, 2400);
  }

  function copyText(text) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      return navigator.clipboard.writeText(text).then(function () {
        return true;
      }).catch(function () {
        return fallbackCopy(text);
      });
    }
    return Promise.resolve(fallbackCopy(text));
  }

  function fallbackCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return Boolean(ok);
    } catch (_) {
      return false;
    }
  }

  function createEl(tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined && text !== null) el.textContent = String(text);
    return el;
  }

  function isNonEmptyString(val) {
    return typeof val === 'string' && val.trim().length > 0;
  }

  function renderInfo(data) {
    var root = document.getElementById('info-app');
    if (!root) return;
    root.textContent = '';

    // 1. Hero Archival Placard
    var placard = createEl('section', 'placard');
    placard.setAttribute('aria-label', '线下展览基本信息');


    var mainTitle = isNonEmptyString(data.mainTitle) ? data.mainTitle.trim() : (data.title || '');
    var subtitle = isNonEmptyString(data.subtitle) ? data.subtitle.trim() : '';
    placard.appendChild(createEl('h1', 'placard-title', mainTitle));
    if (subtitle) {
      placard.appendChild(createEl('p', 'placard-subtitle', subtitle));
    }

    var facts = [];
    if (isNonEmptyString(data.exhibitionDates)) {
      facts.push({ label: '展览时间', value: data.exhibitionDates.trim() });
    }
    if (isNonEmptyString(data.venue)) {
      facts.push({ label: '展览地点', value: data.venue.trim() });
    }
    if (isNonEmptyString(data.openingEvent)) {
      facts.push({ label: '相关活动', value: data.openingEvent.trim() });
    }

    if (facts.length) {
      var grid = createEl('dl', 'placard-facts');
      facts.forEach(function (item) {
        var box = createEl('div', 'fact-item');
        box.appendChild(createEl('dt', 'fact-label', item.label));
        box.appendChild(createEl('dd', 'fact-value', item.value));
        grid.appendChild(box);
      });
      placard.appendChild(grid);
    }

    if (isNonEmptyString(data.registrationNote)) {
      placard.appendChild(createEl('div', 'reg-note', data.registrationNote.trim()));
    }

    root.appendChild(placard);

    // 2. Optional Highlights (rendered only when non-empty)
    if (Array.isArray(data.highlights) && data.highlights.length > 0) {
      var validHighlights = data.highlights.filter(isNonEmptyString);
      if (validHighlights.length > 0) {
        var hlSection = createEl('section', 'dynamic-block');
        var hlHead = createEl('div', 'section-heading');
        hlHead.appendChild(createEl('h2', '', '展览看点'));
        hlSection.appendChild(hlHead);

        var list = createEl('ul', 'highlights-list');
        validHighlights.forEach(function (item) {
          list.appendChild(createEl('li', '', item.trim()));
        });
        hlSection.appendChild(list);
        root.appendChild(hlSection);
      }
    }

    // 3. Optional Structured Editorial Sections (rendered only when non-empty)
    if (Array.isArray(data.sections) && data.sections.length > 0) {
      var validSections = data.sections.filter(function (s) {
        return s && (isNonEmptyString(s.heading) || isNonEmptyString(s.body) || (Array.isArray(s.paragraphs) && s.paragraphs.some(isNonEmptyString)));
      });
      if (validSections.length > 0) {
        var secWrap = createEl('section', 'dynamic-block');
        var secHead = createEl('div', 'section-heading');
        secHead.appendChild(createEl('h2', '', '展览详情'));
        secWrap.appendChild(secHead);

        var cards = createEl('div', 'editorial-sections');
        validSections.forEach(function (sec) {
          var card = createEl('article', 'editorial-card');
          if (isNonEmptyString(sec.heading)) {
            card.appendChild(createEl('h3', '', sec.heading.trim()));
          }
          if (Array.isArray(sec.paragraphs)) {
            sec.paragraphs.filter(isNonEmptyString).forEach(function (para) {
              card.appendChild(createEl('p', '', para.trim()));
            });
          } else if (isNonEmptyString(sec.body)) {
            sec.body.split(/\n+/).filter(isNonEmptyString).forEach(function (para) {
              card.appendChild(createEl('p', '', para.trim()));
            });
          }
          cards.appendChild(card);
        });
        secWrap.appendChild(cards);
        root.appendChild(secWrap);
      }
    }

    // 4. Official WeChat Articles with offline SVG QR codes
    var articles = Array.isArray(data.articles) ? data.articles.filter(function (a) {
      return a && isNonEmptyString(a.url);
    }) : [];

    if (articles.length > 0) {
      var artSection = createEl('section', 'articles-section');
      artSection.setAttribute('aria-labelledby', 'articles-heading');

      var artHead = createEl('div', 'section-heading');
      var h2 = createEl('h2', '', '官方推文与二维码');
      h2.id = 'articles-heading';
      artHead.appendChild(h2);
      artSection.appendChild(artHead);

      var artGrid = createEl('div', 'articles-grid');

      articles.forEach(function (article) {
        var url = article.url.trim();
        var card = createEl('article', 'article-card');

        var top = createEl('div', 'article-card-top');
        var meta = createEl('div', 'article-meta');
        meta.appendChild(createEl('h3', 'article-title', isNonEmptyString(article.title) ? article.title.trim() : '线下展览推文'));
        top.appendChild(meta);

        // Offline SVG QR code via MujianQR
        var qrFrame = createEl('div', 'qr-frame');
        var qrBox = createEl('div', 'qr-box');
        if (window.MujianQR && typeof window.MujianQR.toSVG === 'function') {
          qrBox.innerHTML = window.MujianQR.toSVG(url, {
            size: 124,
            fg: '#161618',
            bg: '#ffffff',
            margin: 2
          });
        }
        qrFrame.appendChild(qrBox);
        qrFrame.appendChild(createEl('span', 'qr-caption', '微信扫码阅读'));
        top.appendChild(qrFrame);

        card.appendChild(top);

        var actions = createEl('div', 'article-actions');
        var openLink = createEl('a', 'btn btn-primary', '打开推文 ↗');
        openLink.href = url;
        openLink.target = '_blank';
        openLink.rel = 'noopener noreferrer';

        var copyBtn = createEl('button', 'btn btn-secondary', '复制链接');
        copyBtn.type = 'button';
        copyBtn.addEventListener('click', function () {
          copyText(url).then(function (ok) {
            if (ok) {
              showToast('推文链接已复制');
            } else {
              showToast('当前环境不支持自动复制，请长按链接复制');
            }
          });
        });

        actions.appendChild(openLink);
        actions.appendChild(copyBtn);
        card.appendChild(actions);

        artGrid.appendChild(card);
      });

      artSection.appendChild(artGrid);
      root.appendChild(artSection);
    }
  }

  function wireFooterLinks() {
    if (!window.MujianRoutes) return;
    var noteLink = document.getElementById('footer-note-link');
    var thanksLink = document.getElementById('footer-thanks-link');
    if (noteLink) noteLink.href = window.MujianRoutes.resolveUrl('note');
    if (thanksLink) thanksLink.href = window.MujianRoutes.resolveUrl('thanks');
  }

  function init() {
    wireFooterLinks();
    fetch('./data.json', { cache: 'no-cache' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(renderInfo)
      .catch(function () {
        var root = document.getElementById('info-app');
        if (root) {
          root.textContent = '';
          root.appendChild(createEl('p', 'error-state', '展览信息加载失败，请刷新重试。'));
        }
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
