/**
 * 幕间漫游 · 跨子域名观展足迹 SDK (Domain=.ofjing.com 共享 Cookie + localStorage 同步)
 * - 记录点亮的模块 ID（1-9 / note / info / thanks）
 * - 同步影院星球的「去过 / 想去」影院 ID 与名称
 * - 记录用户自定义昵称与首次/最近漫游时间
 */
(function (root) {
  'use strict';

  var COOKIE_NAME = 'mjmy_fp_v1';
  var LS_KEY = 'mujian.footprint.v1';
  var NICKNAME_LIMIT = 40;
  var LOCAL_NOTE_KEY = 'mujian.note.demo.v1';
  var ROOT_DOMAIN = 'ofjing.com';
  var MAX_AGE_SECONDS = 60 * 60 * 24 * 180; // 180 天

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

  function emptyState() {
    var t = nowIso();
    return {
      v: 1,
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
    var base = emptyState();
    if (!raw || typeof raw !== 'object') return base;
    return {
      v: 1,
      nick: cleanNickname(raw.nick),
      noteNick: cleanNickname(raw.noteNick),
      mods: uniqStrings(raw.mods),
      cv: uniqStrings(raw.cv),
      cw: uniqStrings(raw.cw),
      first: typeof raw.first === 'string' && raw.first ? raw.first : base.first,
      last: typeof raw.last === 'string' && raw.last ? raw.last : base.last
    };
  }

  function readCookieRaw() {
    try {
      var pairs = document.cookie ? document.cookie.split(';') : [];
      for (var i = 0; i < pairs.length; i++) {
        var idx = pairs[i].indexOf('=');
        if (idx === -1) continue;
        var k = pairs[i].slice(0, idx).trim();
        if (k === COOKIE_NAME) {
          return decodeURIComponent(pairs[i].slice(idx + 1).trim());
        }
      }
    } catch (_) {}
    return null;
  }

  function writeCookieRaw(jsonStr) {
    try {
      var encoded = encodeURIComponent(jsonStr);
      var attrs = [
        COOKIE_NAME + '=' + encoded,
        'Path=/',
        'Max-Age=' + MAX_AGE_SECONDS,
        'SameSite=Lax'
      ];
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

  function getFootprint() {
    var fromCookie = null;
    var rawC = readCookieRaw();
    if (rawC) {
      try { fromCookie = JSON.parse(rawC); } catch (_) {}
    }
    var fromLS = readLS();
    var state;
    if (fromCookie && fromLS) {
      // Cookie 为跨子域权威，但合并 mods 并集
      state = sanitize(fromCookie);
      state.mods = uniqStrings(state.mods.concat(sanitize(fromLS).mods));
      // Older cookies may have no nickname fields yet. Do not revive a cleared override.
      if (!Object.prototype.hasOwnProperty.call(fromCookie, 'nick')) state.nick = cleanNickname(fromLS.nick);
      if (!state.noteNick) state.noteNick = cleanNickname(fromLS.noteNick);
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
    clean.last = nowIso();
    var serialized = JSON.stringify(clean);
    writeCookieRaw(serialized);
    writeLS(clean);
    try {
      window.dispatchEvent(new CustomEvent('mujian:footprint-change', { detail: clean }));
    } catch (_) {}
    return clean;
  }

  function recordVisit(moduleId) {
    if (!moduleId || typeof moduleId !== 'string') return getFootprint();
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

  function resetFootprint() {
    var fresh = emptyState();
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
    syncCinema: syncCinema,
    setNickname: setNickname,
    setNoteNickname: setNoteNickname,
    resetFootprint: resetFootprint
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
