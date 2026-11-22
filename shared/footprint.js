/**
 * 幕间漫游 · 跨子域名观展足迹 SDK (Domain=.ofjing.com 共享 Cookie + localStorage 同步)
 * - 记录点亮的模块 ID（1-9 / note / info / thanks）
 * - 同步影院星球的「去过 / 想去」影院 ID 与名称
 * - 记录用户自定义昵称与首次/最近漫游时间
 */
(function (root) {
  'use strict';

  var COOKIE_NAME = 'mjmy_fp_v1';
  var ROAM_RETURN_KEY = 'mujian.roam.return.v1';
  var ROAM_VISIT_PREFIX = 'mjmy_roam_visit_';
  var RECENT_ROAM_LIMIT = 16;
  var LS_KEY = 'mujian.footprint.v1';
  var NICKNAME_LIMIT = 40;
  var LOCAL_NOTE_KEY = 'mujian.note.demo.v1';
  var ROOT_DOMAIN = 'ofjing.com';
  var KNOWN_MODULES = ['101', 'cinema', 'collection', 'letter', 'linli', 'next', 'same', 'vibecoding', 'note', 'info', 'thanks'];

  function makeSessionId() {
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function isProdHost() {
    try {
      var h = location.hostname.toLowerCase();
      return h === ROOT_DOMAIN || h.endsWith('.' + ROOT_DOMAIN);
    } catch (_) {
      return false;
    }
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function emptyState(sid) {
    var t = nowIso();
    return {
      v: 1,
      sid: sid || makeSessionId(),
      nick: '',       // 手动设置的票根昵称
      noteNick: '',   // 本人最近一次提交留言时使用的昵称
      mods: [],      // 已点亮的模块 id 列表（去重保序）
      cv: [],        // 影院星球：去过的影院 id
      cw: [],        // 影院星球：想去的影院 id
      first: t,
      last: t
    };
  }

  function uniqStrings(arr) {
    if (!Array.isArray(arr)) return [];
    var seen = Object.create(null);
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var s = typeof arr[i] === 'string' ? arr[i].trim() : '';
      if (s && !seen[s]) {
        seen[s] = true;
        out.push(s);
      }
    }
    return out;
  }

  function cleanNickname(value) {
    return typeof value === 'string' ? value.trim().slice(0, NICKNAME_LIMIT) : '';
  }

  function localNoteNickname() {
    try {
      var notes = JSON.parse(localStorage.getItem(LOCAL_NOTE_KEY) || '[]');
      return Array.isArray(notes) && notes[0] ? cleanNickname(notes[0].nickname) : '';
    } catch (_) {
      return '';
    }
  }

  function sanitize(raw) {
    var base = emptyState('');
    if (!raw || typeof raw !== 'object') return base;
    return {
      v: 1,
      sid: typeof raw.sid === 'string' ? raw.sid.slice(0, 32) : '',
      nick: cleanNickname(raw.nick),
      noteNick: cleanNickname(raw.noteNick),
      mods: uniqStrings(raw.mods),
      cv: uniqStrings(raw.cv),
      cw: uniqStrings(raw.cw),
      first: typeof raw.first === 'string' && raw.first ? raw.first : base.first,
      last: typeof raw.last === 'string' && raw.last ? raw.last : base.last
    };
  }

  function readCookieRaw(name) {
    try {
      var pairs = document.cookie ? document.cookie.split(';') : [];
      for (var i = 0; i < pairs.length; i++) {
        var idx = pairs[i].indexOf('=');
        if (idx === -1) continue;
        var k = pairs[i].slice(0, idx).trim();
        if (k === name) {
          return decodeURIComponent(pairs[i].slice(idx + 1).trim());
        }
      }
    } catch (_) {}
    return null;
  }

  function writeCookieRaw(name, value, maxAge) {
    try {
      var encoded = encodeURIComponent(value);
      var attrs = [
        name + '=' + encoded,
        'Path=/',
        'SameSite=Lax'
      ];
      if (maxAge) attrs.push('Max-Age=' + maxAge);
      if (isProdHost()) {
        attrs.push('Domain=.' + ROOT_DOMAIN);
      }
      if (location.protocol === 'https:') {
        attrs.push('Secure');
      }
      document.cookie = attrs.join('; ');
    } catch (_) {}
  }

  function readLS() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function writeLS(state) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch (_) {}
  }

  function mergeStates(a, b) {
    var sa = sanitize(a);
    var sb = sanitize(b);
    return {
      v: 1,
      nick: sb.nick || sa.nick,
      noteNick: sb.noteNick || sa.noteNick,
      mods: uniqStrings(sa.mods.concat(sb.mods)),
      cv: sb.cv.length || !sa.cv.length ? sb.cv : sa.cv,
      cw: sb.cw.length || !sa.cw.length ? sb.cw : sa.cw,
      first: sa.first < sb.first ? sa.first : sb.first,
      last: sa.last > sb.last ? sa.last : sb.last
    };
  }

  function clearCookieRaw(name) {
    try {
      var attrs = [name + '=', 'Path=/', 'Max-Age=0', 'SameSite=Lax'];
      if (isProdHost()) attrs.push('Domain=.' + ROOT_DOMAIN);
      if (location.protocol === 'https:') attrs.push('Secure');
      document.cookie = attrs.join('; ');
    } catch (_) {}
  }

  function getFootprint() {
    var fromCookie = null;
    var rawC = readCookieRaw(COOKIE_NAME);
    if (rawC) {
      try { fromCookie = JSON.parse(rawC); } catch (_) {}
    }
    var fromLS = readLS();
    var state;
    if (fromCookie && fromLS) {
      // Cookie 为跨子域权威；仅当 session ID 一致时才合并 localStorage 的 mods，防止旧会话复活
      state = sanitize(fromCookie);
      var lsState = sanitize(fromLS);
      if (state.sid && lsState.sid && state.sid === lsState.sid) {
        state.mods = uniqStrings(state.mods.concat(lsState.mods));
      } else {
        writeLS(state);
      }
      if (!Object.prototype.hasOwnProperty.call(fromCookie, 'nick')) state.nick = lsState.nick;
      if (!state.noteNick) state.noteNick = lsState.noteNick;
    } else if (fromCookie) {
      state = sanitize(fromCookie);
    } else if (fromLS) {
      state = sanitize(fromLS);
    } else {
      state = emptyState();
    }

    if (!state.noteNick) state.noteNick = localNoteNickname();

    // 如果当前页面恰好能读到影院星球本地记录，顺手兜底同步
    try {
      var cinemaRaw = localStorage.getItem('mujian.cinema-visit.v1');
      if (cinemaRaw) {
        var parsed = JSON.parse(cinemaRaw);
        if (parsed && parsed.choices && typeof parsed.choices === 'object') {
          var cv = [];
          var cw = [];
          Object.keys(parsed.choices).forEach(function (cid) {
            if (parsed.choices[cid] && parsed.choices[cid].visited) cv.push(cid);
            if (parsed.choices[cid] && parsed.choices[cid].wishlist) cw.push(cid);
          });
          if (cv.length || cw.length) {
            state.cv = uniqStrings(cv);
            state.cw = uniqStrings(cw);
          }
        }
      }
    } catch (_) {}

    return state;
  }

  function save(state) {
    var clean = sanitize(state);
    if (!clean.sid) clean.sid = makeSessionId();
    clean.last = nowIso();
    var serialized = JSON.stringify(clean);
    // Session cookie (no Max-Age): shared across *.ofjing.com during the visit, cleared on browser exit.
    writeCookieRaw(COOKIE_NAME, serialized);
    writeLS(clean);
    try {
      window.dispatchEvent(new CustomEvent('mujian:footprint-change', { detail: clean }));
    } catch (_) {}
    return clean;
  }

  function roamSeeds(moduleId) {
    var key = ROAM_VISIT_PREFIX + moduleId;
    var cookie = readCookieRaw(key) || '';
    var session = '';
    try { session = sessionStorage.getItem(key) || ''; } catch (_) {}
    return uniqStrings(cookie.split(',').concat(session.split(',')));
  }

  function hasRoamVisit(moduleId, seed) {
    return Boolean(seed) && roamSeeds(moduleId).includes(String(seed));
  }

  function rememberRoamVisit(moduleId, roamSeed) {
    if (!Number.isInteger(roamSeed) || roamSeed <= 0 || !/^[a-z0-9-]+$/.test(moduleId)) return;
    var seed = String(roamSeed);
    var recent = roamSeeds(moduleId).filter(function (previous) { return previous !== seed; });
    recent.push(seed);
    var key = ROAM_VISIT_PREFIX + moduleId;
    var value = recent.slice(-RECENT_ROAM_LIMIT).join(',');
    writeCookieRaw(key, value);
    try { sessionStorage.setItem(key, value); } catch (_) {}
  }

  function takeRoamReturn() {
    try {
      var seed = sessionStorage.getItem(ROAM_RETURN_KEY);
      sessionStorage.removeItem(ROAM_RETURN_KEY);
      return seed;
    } catch (_) { return null; }
  }

  function recordVisit(moduleId, roamSeed) {
    if (!moduleId || typeof moduleId !== 'string') return getFootprint();
    if (roamSeed) {
      rememberRoamVisit(moduleId, roamSeed);
      try { sessionStorage.setItem(ROAM_RETURN_KEY, String(roamSeed)); } catch (_) {}
    }
    var state = getFootprint();
    if (state.mods.indexOf(moduleId) === -1) {
      state.mods.push(moduleId);
    }
    return save(state);
  }

  function syncCinema(visitedIds, wishlistIds) {
    var state = getFootprint();
    state.cv = uniqStrings(visitedIds);
    state.cw = uniqStrings(wishlistIds);
    if (state.mods.indexOf('cinema') === -1) {
      state.mods.push('cinema');
    }
    return save(state);
  }

  function setNickname(name) {
    var state = getFootprint();
    state.nick = cleanNickname(name);
    return save(state);
  }

  function setNoteNickname(name) {
    var state = getFootprint();
    state.noteNick = cleanNickname(name);
    return save(state);
  }

  function clearRoamVisits() {
    for (var i = 0; i < KNOWN_MODULES.length; i++) {
      var key = ROAM_VISIT_PREFIX + KNOWN_MODULES[i];
      clearCookieRaw(key);
      try { sessionStorage.removeItem(key); } catch (_) {}
    }
    try { sessionStorage.removeItem(ROAM_RETURN_KEY); } catch (_) {}
  }

  function startFreshSession() {
    var prev = getFootprint();
    clearRoamVisits();
    var fresh = emptyState(makeSessionId());
    fresh.nick = prev.nick;
    fresh.noteNick = prev.noteNick;
    return save(fresh);
  }

  function resetFootprint() {
    clearRoamVisits();
    var fresh = emptyState(makeSessionId());
    return save(fresh);
  }

  // 自动监听影院星球派发的事件（零侵入兼容）
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('mujian:cinema-record-change', function () {
      try {
        var raw = localStorage.getItem('mujian.cinema-visit.v1');
        if (!raw) return;
        var data = JSON.parse(raw);
        var cv = [];
        var cw = [];
        Object.keys(data.choices || {}).forEach(function (id) {
          if (data.choices[id] && data.choices[id].visited) cv.push(id);
          if (data.choices[id] && data.choices[id].wishlist) cw.push(id);
        });
        syncCinema(cv, cw);
      } catch (_) {}
    });
  }

  root.MujianFootprint = {
    COOKIE_NAME: COOKIE_NAME,
    getFootprint: getFootprint,
    recordVisit: recordVisit,
    hasRoamVisit: hasRoamVisit,
    rememberRoamVisit: rememberRoamVisit,
    takeRoamReturn: takeRoamReturn,
    syncCinema: syncCinema,
    setNickname: setNickname,
    setNoteNickname: setNoteNickname,
    startFreshSession: startFreshSession,
    resetFootprint: resetFootprint
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
