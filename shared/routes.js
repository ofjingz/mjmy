/**
 * 幕间漫游 · 全站唯一路由与模块配置（Single Source of Truth）
 * - 生产环境 (*.ofjing.com): 自动解析为独立一级子域名 https://mjmy-xxx.ofjing.com
 * - 本地预览 (localhost / 127.0.0.1 / 局域网IP): 自动回退为同源子路径 /xxx/
 */
(function (root) {
  'use strict';

  var ROOT_DOMAIN = 'ofjing.com';
  var HUB_HOST = 'mjmy.ofjing.com';

  var CATEGORIES = [
    { id: 'after-screening', name: '散场之后', subtitle: '观看、成长与相遇' },
    { id: 'behind-screen',   name: '银幕背后', subtitle: '组织一场放映与策展' },
    { id: 'homeland',        name: '精神原乡', subtitle: '全球影院与地方坐标' },
    { id: 'objects-craft',   name: '物与手作', subtitle: '收藏来路、手作与影迷互助' }
  ];

  /**
   * 1-9 主展内容模块（7号大白在此 enabled: false，首版隐藏但保留结构）
   */
  var MODULES = [
    {
      num: 1,
      id: 'linli',
      subdomain: 'mjmy-linli',
      path: '/linli/',
      title: '活动手记',
      contributor: '林立',
      contributors: ['林立'],
      category: 'behind-screen',
      categoryName: '银幕背后',
      tagline: '在影像中相遇：欧洲电影策展手记',
      motif: 'boat',
      enabled: true
    },
    {
      num: 2,
      id: 'cinema',
      subdomain: 'mjmy-cinema',
      path: '/cinema/',
      title: '全球影院',
      contributor: '多人',
      contributors: ['miyra', '好好学姐', '无名客', '还是黑', '凯议（Ian-hky）', 'Joey'],
      category: 'homeland',
      categoryName: '精神原乡',
      tagline: '16 座城市电影空间与 56 张胶片记忆',
      motif: 'moon',
      enabled: true
    },
    {
      num: 3,
      id: 'letter',
      subdomain: 'mjmy-letter',
      path: '/letter/',
      title: '影 诗',
      contributor: '多人',
      contributors: ['凯议（Ian-hky）', '陆陆', '小文（诩诤朗斡）', '梓鸽', 'Joey'],
      category: 'after-screening',
      categoryName: '散场之后',
      tagline: '迷影书信文章与 11 支影迷短视频',
      motif: 'typewriter',
      enabled: true
    },
    {
      num: 4,
      id: '101',
      subdomain: 'mjmy-101',
      path: '/101/',
      title: '电影101工作室',
      contributor: '101',
      contributors: ['101'],
      category: 'behind-screen',
      categoryName: '银幕背后',
      tagline: '等一部电影：1996—2026 民间放映三十年',
      motif: 'disc',
      enabled: true
    },
    {
      num: 5,
      id: 'vibecoding',
      subdomain: 'mjmy-vibecoding',
      path: '/vibecoding/',
      title: 'vibecoding 合集',
      contributor: '多人',
      contributors: ['文文', '李锐鸿', 'Yang'],
      category: 'objects-craft',
      categoryName: '物与手作',
      tagline: '影迷自己写给影迷的排片与观影小工具',
      motif: 'glasses',
      enabled: true
    },
    {
      num: 6,
      id: 'collection',
      subdomain: 'mjmy-collection',
      path: '/collection/',
      title: '收藏背后',
      contributor: '还是黑',
      contributors: ['还是黑'],
      category: 'objects-craft',
      categoryName: '物与手作',
      tagline: '书、碟、剧照、帆布袋与远方朋友的赠礼',
      motif: 'umbrella',
      enabled: true
    },
    {
      num: 7,
      id: 'dabai',
      subdomain: 'mjmy-dabai',
      path: '/dabai/',
      title: '大白在此',
      contributor: 'M',
      contributors: ['M'],
      category: 'objects-craft',
      categoryName: '物与手作',
      tagline: '筹备中',
      motif: 'can',
      enabled: false
    },
    {
      num: 8,
      id: 'next',
      subdomain: 'mjmy-next',
      path: '/next/',
      title: '下场看什么',
      contributor: 'Felix',
      contributors: ['Felix'],
      category: 'behind-screen',
      categoryName: '银幕背后',
      tagline: '从第一场《椒麻堂会》到千人共看的放映史',
      motif: 'tree',
      enabled: true
    },
    {
      num: 9,
      id: 'same',
      subdomain: 'mjmy-same',
      path: '/same/',
      title: 'same',
      contributor: 'kai',
      contributors: ['kai'],
      category: 'behind-screen',
      categoryName: '银幕背后',
      tagline: 'SAME 文明观影宣传片与胶片放映档案',
      motif: 'eyes',
      enabled: true
    }
  ];

  var SPECIALS = {
    hub:    { id: 'hub',    subdomain: 'mjmy',        path: '/hub/',    title: '幕间漫游' },
    note:   { id: 'note',   subdomain: 'mjmy-note',   path: '/note/',   title: '留言板' },
    info:   { id: 'info',   subdomain: 'mjmy-info',   path: '/info/',   title: '线下展览信息' },
    thanks: { id: 'thanks', subdomain: 'mjmy-thanks', path: '/thanks/', title: '共创者与特别鸣谢' }
  };

  function isProdHost(hostname) {
    var h = (hostname || (typeof location !== 'undefined' ? location.hostname : '')).toLowerCase();
    return h === ROOT_DOMAIN || h.endsWith('.' + ROOT_DOMAIN);
  }

  function parseRoamSeed(value) {
    var seed = Number(value);
    return Number.isInteger(seed) && seed > 0 && seed < 2147483647 ? seed : 0;
  }

  function resolveUrl(id, hash) {
    var suffix = hash ? (hash.charAt(0) === '#' ? hash : '#' + hash) : '';
    var item = SPECIALS[id] || MODULES.find(function (m) { return m.id === id; }) || SPECIALS.hub;
    var path = isProdHost() ? 'https://' + item.subdomain + '.' + ROOT_DOMAIN + '/' : item.path;
    if (id === 'hub' && typeof location !== 'undefined') {
      var params = new URLSearchParams(location.search);
      var via = params.get('via');
      var seed = parseRoamSeed(params.get('roam'));
      if (seed && (via === 'hall' || via === 'catalog')) path += '?roam=' + seed;
    }
    return path + suffix;
  }

  function getEnabledModules() {
    return MODULES.filter(function (m) { return m.enabled; });
  }

  function getModuleById(id) {
    return MODULES.find(function (m) { return m.id === id; }) || SPECIALS[id] || null;
  }

  root.MujianRoutes = {
    ROOT_DOMAIN: ROOT_DOMAIN,
    HUB_HOST: HUB_HOST,
    CATEGORIES: CATEGORIES,
    MODULES: MODULES,
    SPECIALS: SPECIALS,
    isProdHost: isProdHost,
    resolveUrl: resolveUrl,
    parseRoamSeed: parseRoamSeed,
    getEnabledModules: getEnabledModules,
    getModuleById: getModuleById
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
