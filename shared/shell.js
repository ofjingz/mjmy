/**
 * 幕间漫游 · 子展区返回与足迹点亮
 */
(function () {
  'use strict';

  function initShell() {
    var body = document.body;
    if (!body) return;
    var moduleId = body.getAttribute('data-module');
    var returnLink = body.querySelector('[data-exhibit-return]');
    if (returnLink && window.MujianRoutes) {
      var via = new URLSearchParams(location.search).get('via');
      var view = via === 'hall' || via === 'catalog' ? '#' + via : returnLink.hash;
      returnLink.href = window.MujianRoutes.resolveUrl('hub', view);
    }

    // 自动记录当前模块点亮（hub 是入口，不计入展区）
    if (moduleId && moduleId !== 'hub' && window.MujianFootprint) {
      window.MujianFootprint.recordVisit(moduleId);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initShell);
  } else {
    initShell();
  }
})();
