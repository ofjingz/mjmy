/* Local, dependency-free enhancement. Essential information is in the HTML. */
(() => {
  'use strict';

  // Resolve in-site navigation links dynamically via MujianRoutes when available.
  if (window.MujianRoutes && typeof window.MujianRoutes.resolveUrl === 'function') {
    document.querySelectorAll('[data-site-route]').forEach(link => {
      const routeId = link.dataset.siteRoute;
      if (!routeId) return;
      const hash = link.dataset.siteHash || '';
      link.href = window.MujianRoutes.resolveUrl(routeId, hash);
    });
  }

  // Lightbox modal for posters, portraits, route maps, and invitation.
  const dialog = document.getElementById('image-dialog');
  const image = document.getElementById('lightbox-image');
  const caption = document.getElementById('image-caption');
  const original = document.getElementById('image-original');
  let opener = null;
  if (dialog && typeof dialog.showModal === 'function') {
    document.querySelectorAll('[data-lightbox]').forEach(link => {
      link.addEventListener('click', event => {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        opener = link;
        image.src = link.href;
        image.alt = link.dataset.caption || '图片原图';
        caption.textContent = image.alt;
        original.href = link.href;
        dialog.showModal();
        dialog.querySelector('.lightbox-scroll').scrollTop = 0;
      });
    });
    const closeBtn = document.getElementById('image-close');
    if (closeBtn) closeBtn.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) {
        dialog.close();
      }
    });
    dialog.addEventListener('close', () => {
      if (opener) opener.focus({ preventScroll: true });
    });
  }

  // Dual-tab venue route switcher (Bookstore vs Theatre).
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  function selectTab(tab) {
    tabs.forEach(item => {
      const active = item === tab;
      item.setAttribute('aria-selected', String(active));
      item.tabIndex = active ? 0 : -1;
      const panel = document.getElementById(item.getAttribute('aria-controls'));
      if (panel) panel.hidden = !active;
    });
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') next = tabs[(index + 1) % tabs.length];
      if (event.key === 'Home') next = tabs[0];
      if (event.key === 'End') next = tabs[tabs.length - 1];
      if (next) {
        event.preventDefault();
        selectTab(next);
        next.focus();
      }
    });
  });
  if (tabs.length) selectTab(tabs[0]);

  // Copy venue address to clipboard.
  const copy = document.getElementById('copy-address');
  const status = document.getElementById('copy-status');
  const address = '北京市西城区新街口外大街34号金尚城溪2层';
  if (copy && status) {
    copy.addEventListener('click', async () => {
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(address);
        } else {
          const field = document.createElement('textarea');
          field.value = address;
          field.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px';
          document.body.append(field);
          field.select();
          field.setSelectionRange(0, field.value.length);
          const success = document.execCommand('copy');
          field.remove();
          copy.focus({ preventScroll: true });
          if (!success) throw new Error('Copy unavailable');
        }
        status.textContent = '地址已复制';
      } catch (_) {
        status.textContent = '可长按或选中上方地址复制';
      }
    });
  }

  // Active section spy for sticky header navigation.
  const headerEl = document.querySelector('.site-header');
  const navLinks = [...document.querySelectorAll('.site-header nav a')];
  let scrollPending = false;
  function updateNav() {
    if (!headerEl || !navLinks.length) {
      scrollPending = false;
      return;
    }
    const line = headerEl.getBoundingClientRect().bottom + 120;
    let current = null;
    navLinks.forEach(link => {
      const section = link.hash ? document.querySelector(link.hash) : null;
      if (section && section.getBoundingClientRect().top <= line) current = link;
    });
    navLinks.forEach(link => {
      if (link === current) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    scrollPending = false;
  }
  window.addEventListener('scroll', () => {
    if (!scrollPending) {
      scrollPending = true;
      requestAnimationFrame(updateNav);
    }
  }, { passive: true });
  window.addEventListener('resize', updateNav);
  updateNav();
})();
