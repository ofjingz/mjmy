/**
 * 幕间漫游 · 子展区返回与足迹点亮
 */
(function () {
  'use strict';

  function initShell() {
    var body = document.body;
    if (!body) return;
    var moduleId = body.getAttribute('data-module');
    var routes = window.MujianRoutes;
    var params = new URLSearchParams(location.search);
    var via = params.get('via');
    var cameFromHall = via === 'hall' || via === 'catalog';
    var module = routes && routes.getModuleById(moduleId);
    var roamSeed = cameFromHall && module && module.enabled && routes.parseRoamSeed
      ? routes.parseRoamSeed(params.get('roam')) : 0;
    var returnLink = body.querySelector('[data-exhibit-return]');
    if (returnLink && routes) {
      var view = cameFromHall ? '#' + via : returnLink.hash;
      var destination = new URL(routes.resolveUrl('hub', view), location.href);
      if (roamSeed) destination.searchParams.set('arrived', moduleId);
      returnLink.href = destination.href;
    }

    // 自动记录当前模块点亮（hub 是入口，不计入展区）
    if (moduleId && moduleId !== 'hub' && window.MujianFootprint) {
      window.MujianFootprint.recordVisit(moduleId, roamSeed);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initShell);
  } else {
    initShell();
  }
})();
