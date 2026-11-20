/**
 * 幕间漫游 · 留言板前台（site/note/）
 * - 浏览为主：纸笺墙 + 片单筛选 + 点击放大细读（支持左右翻页/随机抽签）+ 「记住了」本地印章
 * - 书写弹层：原生 <dialog> 模态弹窗，不展示字数上限，超长时显式拦截并报错提示
 * - 后端契约：GET / POST /api/notes；无后端/D1 时自动落入本地演示兜底
 * - 安全底线：所有用户内容一律 textContent 渲染，绝不 innerHTML 拼接
 */
(function () {
  'use strict';

  var LS_KEY = 'mujian.note.demo.v1';
  var KEPT_KEY = 'mujian.note.kept.v1';

  /* 与后端 site/functions/api/notes.js 对齐的字符上限（前端不主动展示，仅超长时报错） */
  var LIMITS = {
    nickname: 40,
    content: 600,
    favoriteMovie: 80
  };

  var CARD_MOTIFS = [
    '/shared/motifs/moon-outline.png',
    '/shared/motifs/fish-outline.png',
    '/shared/motifs/typewriter-outline.png',
    '/shared/motifs/umbrella-outline.png',
    '/shared/motifs/boat-outline.png',
    '/shared/motifs/eyes-outline.png',
    '/shared/motifs/star-outline.png'
  ];

  var CARD_TILTS = [-1.25, 0.85, -0.55, 1.15, -0.95, 0.65, -1.1, 0.9];
  var TAPE_TILTS = [-3, 2.5, -1.5, 3, -2, 1.5];
  var CARD_TONES = ['', 'is-tone-warm', 'is-tone-sky'];

  var els = {
    composerDialog: document.getElementById('composer-dialog'),
    openComposerBtn: document.getElementById('btn-open-composer'),
    fabComposerBtn: document.getElementById('fab-open-composer'),
    closeComposerBtn: document.getElementById('composer-close-btn'),
    cancelComposerBtn: document.getElementById('composer-cancel-btn'),
    form: document.getElementById('note-form'),
    nickname: document.getElementById('nickname'),
    content: document.getElementById('content'),
    favoriteMovie: document.getElementById('favorite-movie'),
    nicknameError: document.getElementById('nickname-error'),
    contentError: document.getElementById('content-error'),
    favoriteMovieError: document.getElementById('favorite-movie-error'),
    formHint: document.getElementById('form-hint'),
    submitBtn: document.getElementById('composer-submit-btn'),
    list: document.getElementById('notes-list'),
    movieFilters: document.getElementById('movie-filters'),
    demoBanner: document.getElementById('demo-banner'),
    toast: document.getElementById('toast'),
    announcer: document.getElementById('sr-announcer'),
    template: document.getElementById('note-card-template'),
    readerDialog: document.getElementById('reader-dialog'),
    readerCloseBtn: document.getElementById('reader-close-btn'),
    readerWatermark: document.getElementById('reader-watermark'),
    readerNickname: document.getElementById('reader-nickname'),
    readerTime: document.getElementById('reader-time'),
    readerContent: document.getElementById('reader-content'),
    readerMovie: document.getElementById('reader-movie'),
    readerKeepBtn: document.getElementById('reader-keep-btn'),
    readerPrevBtn: document.getElementById('reader-prev-btn'),
    readerRandomBtn: document.getElementById('reader-random-btn'),
    readerNextBtn: document.getElementById('reader-next-btn')
  };

  var state = {
    allNotes: [],
    filteredNotes: [],
    activeMovie: '',
    readerIndex: -1,
    keptMap: Object.create(null),
    demoMode: false,
    freshKey: ''
  };

  var toastTimer = null;
  var announceTimer = null;

  /* ---------- 基础工具 ---------- */

  function showToast(message) {
    if (!els.toast) return;
    els.toast.textContent = message;
    els.toast.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      els.toast.hidden = true;
    }, 3000);
  }

  function announceSR(message) {
    if (!els.announcer) return;
    clearTimeout(announceTimer);
    els.announcer.textContent = '';
    announceTimer = setTimeout(function () {
      els.announcer.textContent = message;
    }, 150);
  }

  function formatTime(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    try {
      return d.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (_) {
      return d.toLocaleString();
    }
  }

  function normalizeMovieName(raw) {
    if (!raw) return '';
    return String(raw).trim().replace(/^[《〈「『"]+|[》〉」』"]+$/g, '').trim();
  }

  function noteKey(note) {
    if (note && note.id !== undefined && note.id !== null) {
      return 'id:' + String(note.id);
    }
    return 'k:' + String(note.nickname || '') + '|' + String(note.created_at || '');
  }

  function readLocalNotes() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (_) {
      return [];
    }
  }

  function writeLocalNotes(list) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(list));
    } catch (_) {}
  }

  function loadKeptMap() {
    var map = Object.create(null);
    try {
      var raw = localStorage.getItem(KEPT_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr)) {
        for (var i = 0; i < arr.length; i++) {
          if (typeof arr[i] === 'string') map[arr[i]] = true;
        }
      }
    } catch (_) {}
    state.keptMap = map;
  }

  function saveKeptMap() {
    try {
      localStorage.setItem(KEPT_KEY, JSON.stringify(Object.keys(state.keptMap)));
    } catch (_) {}
  }

  /* ---------- 内置演示数据（仅无后端时兜底） ---------- */

  function demoNotes() {
    var now = Date.now();
    var H = 60 * 60 * 1000;
    var D = 24 * H;
    return [
      {
        id: 'exhibit-ada-robot-dreams',
        nickname: '阿呆',
        content: '慢慢学着如何感受失去',
        favorite_movie: '机器人之梦'
      },
      {
        nickname: '阿维',
        content: '第一次来线下影展，看到《四百击》结尾奔跑的男孩，眼眶一下就热了。谢谢策展人。',
        favorite_movie: '四百击',
        created_at: new Date(now - 2 * H).toISOString()
      },
      {
        nickname: '卡米尔的笔记本',
        content: '如果电影先生快忘记了什么，我会提醒他 1995 年那场热闹的第 101 夜——只要还有人散场后在门口聊天，电影就不会老。',
        favorite_movie: '101夜',
        created_at: new Date(now - 14 * H).toISOString()
      },
      {
        nickname: '胶片信',
        content: '很喜欢「银幕背后」那个展区，原来一场放映背后有这么多人的手。',
        favorite_movie: '天堂电影院',
        created_at: new Date(now - 1 * D).toISOString()
      },
      {
        nickname: '小李',
        content: '留言板这个房间的纸面质感很舒服，像在影院的留言本上写字。',
        favorite_movie: '花样年华',
        created_at: new Date(now - 2 * D).toISOString()
      },
      {
        nickname: 'M',
        content: '散场之后才明白，影迷之间的连接比电影本身更长。期待下一场。',
        favorite_movie: '',
        created_at: new Date(now - 3 * D).toISOString()
      },
      {
        nickname: '无名',
        content: '把票根贴在手帐里了，明年还要来。',
        favorite_movie: '一一',
        created_at: new Date(now - 4 * D).toISOString()
      },
      {
        nickname: 'Cinéphile',
        content: '在「全球影院」逛了半小时，像把世界各地的放映厅走了一遍。',
        favorite_movie: '四百击',
        created_at: new Date(now - 5 * D).toISOString()
      },
      {
        nickname: '周末放映员',
        content: '喜欢「下场看什么」里那些发生在影厅里的小事，比电影本身还动人。',
        favorite_movie: '天堂电影院',
        created_at: new Date(now - 6 * D).toISOString()
      },
      {
        nickname: '阿May',
        content: '第一次用票根功能，生成的那张 3:4 卡片好看到不舍得删。',
        favorite_movie: '重庆森林',
        created_at: new Date(now - 7 * D).toISOString()
      }
    ];
  }

  /* ---------- 原生 <dialog> 辅助（含 closedby="any" 降级） ---------- */

  function enableLightDismissFallback(dialog) {
    if (!dialog || ('closedBy' in HTMLDialogElement.prototype)) return;
    var outside = function (e) {
      var r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    var pressedOutside = false;
    dialog.addEventListener('pointerdown', function (e) {
      pressedOutside = outside(e);
    });
    dialog.addEventListener('pointerup', function (e) {
      if (pressedOutside && outside(e) && dialog.open) {
        dialog.close();
      }
      pressedOutside = false;
    });
  }

  function openDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === 'function') {
      if (dialog.open) dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
  }

  /* ---------- 表单 ARIA 校验与超长报错（前端不展示上限） ---------- */

  function linkError(input, shown) {
    if (!input) return;
    var errorId = input.getAttribute('data-error');
    if (!errorId) return;
    var current = (input.getAttribute('aria-describedby') || '')
      .split(/\s+/)
      .filter(function (id) { return id && id !== errorId; });
    if (shown) current.push(errorId);
    if (current.length) {
      input.setAttribute('aria-describedby', current.join(' '));
    } else {
      input.removeAttribute('aria-describedby');
    }
  }

  function setFieldError(input, errorEl, message, shouldAnnounce) {
    if (!input || !errorEl) return;
    if (message) {
      input.setAttribute('aria-invalid', 'true');
      errorEl.textContent = message;
      errorEl.hidden = false;
      linkError(input, true);
      if (shouldAnnounce) announceSR(message);
    } else {
      input.setAttribute('aria-invalid', 'false');
      errorEl.textContent = '';
      errorEl.hidden = true;
      linkError(input, false);
    }
  }

  function clearAllFormErrors() {
    setFieldError(els.nickname, els.nicknameError, '', false);
    setFieldError(els.content, els.contentError, '', false);
    setFieldError(els.favoriteMovie, els.favoriteMovieError, '', false);
    if (els.formHint) {
      els.formHint.textContent = '';
      els.formHint.hidden = true;
    }
  }

  function checkFieldLength(input, errorEl, maxLen, fieldLabel) {
    if (!input || !errorEl) return true;
    var val = input.value.trim();
    if (val.length > maxLen) {
      var msg = fieldLabel + '超出长度限制，请精简至 ' + maxLen + ' 字以内（当前 ' + val.length + ' 字）';
      var wasInvalid = input.getAttribute('aria-invalid') === 'true';
      setFieldError(input, errorEl, msg, !wasInvalid);
      return false;
    }
    if (input.getAttribute('aria-invalid') === 'true') {
      setFieldError(input, errorEl, '', false);
    }
    return true;
  }

  function validateForm() {
    var firstInvalid = null;
    var nickname = els.nickname ? els.nickname.value.trim() : '';
    var content = els.content ? els.content.value.trim() : '';
    var fav = els.favoriteMovie ? els.favoriteMovie.value.trim() : '';

    if (!nickname) {
      setFieldError(els.nickname, els.nicknameError, '请填写你的昵称', false);
      if (!firstInvalid) firstInvalid = els.nickname;
    } else if (nickname.length > LIMITS.nickname) {
      setFieldError(
        els.nickname,
        els.nicknameError,
        '昵称超出长度限制，请精简至 ' + LIMITS.nickname + ' 字以内（当前 ' + nickname.length + ' 字）',
        false
      );
      if (!firstInvalid) firstInvalid = els.nickname;
    } else {
      setFieldError(els.nickname, els.nicknameError, '', false);
    }

    if (!content) {
      setFieldError(els.content, els.contentError, '请写下想留给后来人的话', false);
      if (!firstInvalid) firstInvalid = els.content;
    } else if (content.length > LIMITS.content) {
      setFieldError(
        els.content,
        els.contentError,
        '留言超出长度限制，请精简至 ' + LIMITS.content + ' 字以内（当前 ' + content.length + ' 字）',
        false
      );
      if (!firstInvalid) firstInvalid = els.content;
    } else {
      setFieldError(els.content, els.contentError, '', false);
    }

    if (fav.length > LIMITS.favoriteMovie) {
      setFieldError(
        els.favoriteMovie,
        els.favoriteMovieError,
        '电影名称超出长度限制，请精简至 ' + LIMITS.favoriteMovie + ' 字以内（当前 ' + fav.length + ' 字）',
        false
      );
      if (!firstInvalid) firstInvalid = els.favoriteMovie;
    } else {
      setFieldError(els.favoriteMovie, els.favoriteMovieError, '', false);
    }

    if (firstInvalid) {
      if (els.formHint) {
        els.formHint.textContent = '请先修正标出的输入框后再提交。';
        els.formHint.hidden = false;
      }
      firstInvalid.focus();
      return false;
    }

    if (els.formHint) {
      els.formHint.textContent = '';
      els.formHint.hidden = true;
    }
    return true;
  }

  /* ---------- 同频「记住了」小印章 ---------- */

  function applyKeepButtonUI(btn, kept, isReader) {
    if (!btn) return;
    btn.classList.toggle('is-kept', kept);
    btn.setAttribute('aria-pressed', kept ? 'true' : 'false');
    var label = btn.querySelector('.stamp-label');
    if (label) {
      label.textContent = kept ? '已替他记住' : (isReader ? '记住这一句' : '记住了');
    }
  }

  function toggleKeepNote(note, triggerBtn) {
    var key = noteKey(note);
    var next = !state.keptMap[key];
    if (next) {
      state.keptMap[key] = true;
    } else {
      delete state.keptMap[key];
    }
    saveKeptMap();

    if (triggerBtn) {
      triggerBtn.classList.remove('is-pop');
      void triggerBtn.offsetWidth;
      triggerBtn.classList.add('is-pop');
    }

    // 同步墙上卡片按钮
    var cardBtns = els.list ? els.list.querySelectorAll('.card-keep-btn') : [];
    for (var i = 0; i < cardBtns.length; i++) {
      if (cardBtns[i].getAttribute('data-note-key') === key) {
        applyKeepButtonUI(cardBtns[i], next, false);
      }
    }

    // 同步细读弹层按钮
    if (state.readerIndex >= 0 && state.filteredNotes[state.readerIndex]) {
      if (noteKey(state.filteredNotes[state.readerIndex]) === key) {
        applyKeepButtonUI(els.readerKeepBtn, next, true);
      }
    }

    if (next) {
      showToast('✦ 已为电影先生记下这一句');
    }
  }

  /* ---------- 片单脉络筛选 ---------- */

  function renderMovieFilters() {
    if (!els.movieFilters) return;
    els.movieFilters.textContent = '';

    var counts = Object.create(null);
    var order = [];
    for (var i = 0; i < state.allNotes.length; i++) {
      var m = normalizeMovieName(state.allNotes[i].favorite_movie);
      if (!m) continue;
      if (!counts[m]) {
        counts[m] = 0;
        order.push(m);
      }
      counts[m]++;
    }

    if (!order.length) return;

    order.sort(function (a, b) {
      return counts[b] - counts[a];
    });
    var topMovies = order.slice(0, 8);

    function makeChip(label, movieValue) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'movie-chip' + (state.activeMovie === movieValue ? ' is-active' : '');
      btn.setAttribute('aria-pressed', state.activeMovie === movieValue ? 'true' : 'false');
      btn.textContent = label;
      btn.addEventListener('click', function () {
        state.activeMovie = movieValue;
        applyFilterAndRender();
      });
      return btn;
    }

    els.movieFilters.appendChild(makeChip('全部纸笺', ''));
    for (var j = 0; j < topMovies.length; j++) {
      var name = topMovies[j];
      els.movieFilters.appendChild(makeChip('《' + name + '》', name));
    }
  }

  /* ---------- 渲染纸笺墙（严格 textContent，XSS 安全） ---------- */

  function renderNoteCard(note, index) {
    var node = els.template && els.template.content.firstElementChild
      ? els.template.content.firstElementChild.cloneNode(true)
      : document.createElement('article');

    if (!node.querySelector('.note-nickname')) {
      node.className = 'note-card';
      var head = document.createElement('header');
      head.className = 'note-head';
      var nick = document.createElement('span');
      nick.className = 'note-nickname';
      var time = document.createElement('time');
      time.className = 'note-time';
      head.appendChild(nick);
      head.appendChild(time);
      var body = document.createElement('p');
      body.className = 'note-content';
      var movie = document.createElement('p');
      movie.className = 'note-movie';
      node.appendChild(head);
      node.appendChild(body);
      node.appendChild(movie);
    }

    var key = noteKey(note);
    var tone = CARD_TONES[index % CARD_TONES.length];
    if (tone) node.classList.add(tone);
    if (state.freshKey && state.freshKey === key) {
      node.classList.add('is-fresh');
    }

    node.style.setProperty('--tilt', CARD_TILTS[index % CARD_TILTS.length] + 'deg');
    node.style.setProperty('--tape-tilt', TAPE_TILTS[index % TAPE_TILTS.length] + 'deg');
    node.style.setProperty('--motif-rot', ((index % 2 === 0 ? 1 : -1) * (4 + (index % 5))) + 'deg');

    var motifImg = node.querySelector('.card-motif');
    if (motifImg) {
      motifImg.src = CARD_MOTIFS[index % CARD_MOTIFS.length];
    }

    var cleanMovie = normalizeMovieName(note.favorite_movie);
    node.querySelector('.note-nickname').textContent = String(note.nickname || '');
    node.querySelector('.note-time').textContent = formatTime(note.created_at);
    node.querySelector('.note-content').textContent = String(note.content || '');
    node.querySelector('.note-movie').textContent = cleanMovie
      ? '🎞 留住电影 · 《' + cleanMovie + '》'
      : '';

    var openBtn = node.querySelector('.card-open-hit');
    if (openBtn) {
      openBtn.setAttribute('aria-label', '展开细读 ' + String(note.nickname || '观众') + ' 的留言');
      openBtn.addEventListener('click', function () {
        openReaderAt(index);
      });
    }

    var keepBtn = node.querySelector('.card-keep-btn');
    if (keepBtn) {
      keepBtn.setAttribute('data-note-key', key);
      applyKeepButtonUI(keepBtn, !!state.keptMap[key], false);
      keepBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        toggleKeepNote(note, keepBtn);
      });
    }

    return node;
  }

  function applyFilterAndRender() {
    if (state.activeMovie) {
      state.filteredNotes = state.allNotes.filter(function (n) {
        return normalizeMovieName(n.favorite_movie) === state.activeMovie;
      });
    } else {
      state.filteredNotes = state.allNotes.slice();
    }

    renderMovieFilters();
    renderList(state.filteredNotes);
  }

  function renderList(notes) {
    if (!els.list) return;
    els.list.textContent = '';

    if (!notes || !notes.length) {
      var empty = document.createElement('p');
      empty.className = 'loading-state';
      empty.textContent = state.activeMovie
        ? '暂时没有提到《' + state.activeMovie + '》的纸笺。'
        : '墙上还空着，点击右上角「写一条留言」贴上第一张纸笺吧。';
      els.list.appendChild(empty);
    } else {
      for (var i = 0; i < notes.length; i++) {
        els.list.appendChild(renderNoteCard(notes[i], i));
      }
    }
  }

  function setDemoBanner() {
    if (els.demoBanner) {
      els.demoBanner.hidden = !state.demoMode;
    }
  }

  /* ---------- 细读纸笺弹层（上下翻页 + 随机推门） ---------- */

  function renderReaderContent(index) {
    var list = state.filteredNotes.length ? state.filteredNotes : state.allNotes;
    if (!list.length) return;
    var safeIdx = ((index % list.length) + list.length) % list.length;
    state.readerIndex = safeIdx;
    var note = list[safeIdx];
    var cleanMovie = normalizeMovieName(note.favorite_movie);

    if (els.readerNickname) {
      els.readerNickname.textContent = String(note.nickname || '');
    }
    if (els.readerTime) {
      els.readerTime.textContent = formatTime(note.created_at);
    }
    if (els.readerContent) {
      els.readerContent.textContent = String(note.content || '');
    }
    if (els.readerMovie) {
      if (cleanMovie) {
        els.readerMovie.textContent = '🎞 替电影先生留住：《' + cleanMovie + '》';
        els.readerMovie.hidden = false;
      } else {
        els.readerMovie.textContent = '';
        els.readerMovie.hidden = true;
      }
    }
    if (els.readerWatermark) {
      els.readerWatermark.src = CARD_MOTIFS[safeIdx % CARD_MOTIFS.length];
    }
    if (els.readerKeepBtn) {
      applyKeepButtonUI(els.readerKeepBtn, !!state.keptMap[noteKey(note)], true);
    }

    var multi = list.length > 1;
    if (els.readerPrevBtn) els.readerPrevBtn.disabled = !multi;
    if (els.readerNextBtn) els.readerNextBtn.disabled = !multi;
    if (els.readerRandomBtn) els.readerRandomBtn.disabled = !multi;
  }

  function openReaderAt(index) {
    if (!state.filteredNotes.length && !state.allNotes.length) return;
    renderReaderContent(index);
    openDialog(els.readerDialog);
  }

  function openRandomNote() {
    var list = state.filteredNotes.length ? state.filteredNotes : state.allNotes;
    if (!list.length) return;
    var nextIdx = Math.floor(Math.random() * list.length);
    if (list.length > 1 && nextIdx === state.readerIndex) {
      nextIdx = (nextIdx + 1 + Math.floor(Math.random() * (list.length - 1))) % list.length;
    }
    openReaderAt(nextIdx);
  }

  /* ---------- 加载与提交 ---------- */

  function loadNotes() {
    fetch('/api/notes', { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!data || data.ok !== true) throw new Error(data && data.error ? data.error : 'NOT_OK');
        state.demoMode = false;
        state.allNotes = Array.isArray(data.notes) ? data.notes : [];
        setDemoBanner();
        applyFilterAndRender();
      })
      .catch(function () {
        state.demoMode = true;
        var local = readLocalNotes();
        state.allNotes = local.concat(demoNotes());
        setDemoBanner();
        applyFilterAndRender();
      });
  }

  function setSubmitting(busy) {
    if (!els.submitBtn) return;
    els.submitBtn.disabled = busy;
    els.submitBtn.textContent = busy ? '正在贴上……' : '贴上留言墙';
  }

  function submitNote(payload) {
    setSubmitting(true);
    fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, status: res.status, data: data };
        });
      })
      .then(function (r) {
        if (r.ok && r.data && r.data.ok === true) {
          window.MujianFootprint?.setNoteNickname?.(payload.nickname);
          if (els.form) els.form.reset();
          clearAllFormErrors();
          closeDialog(els.composerDialog);
          showToast('留言已收到，审核通过后将贴上留言墙');
        } else {
          throw new Error(r.data && r.data.error ? r.data.error : 'HTTP ' + r.status);
        }
      })
      .catch(function () {
        state.demoMode = true;
        setDemoBanner();
        var created = {
          nickname: payload.nickname,
          content: payload.content,
          favorite_movie: payload.favorite_movie || '',
          created_at: new Date().toISOString()
        };
        var local = readLocalNotes();
        local.unshift(created);
        writeLocalNotes(local);
        window.MujianFootprint?.setNoteNickname?.(payload.nickname);

        state.activeMovie = '';
        state.freshKey = noteKey(created);
        state.allNotes = local.concat(demoNotes());
        applyFilterAndRender();

        if (els.form) els.form.reset();
        clearAllFormErrors();
        closeDialog(els.composerDialog);
        showToast('演示模式：留言已本地暂存（仅本机可见）');
      })
      .finally(function () {
        setSubmitting(false);
      });
  }

  function onSubmit(e) {
    e.preventDefault();
    if (!validateForm()) return;

    var payload = {
      nickname: els.nickname.value.trim(),
      content: els.content.value.trim(),
      favorite_movie: (els.favoriteMovie ? els.favoriteMovie.value : '').trim()
    };
    submitNote(payload);
  }

  /* ---------- 背景柔和视差 + 悬浮写留言按钮 ---------- */

  function bindAmbientEffects() {
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduced && window.matchMedia && window.matchMedia('(pointer: fine)').matches) {
      var targetX = 0;
      var targetY = 0;
      var curX = 0;
      var curY = 0;
      var rafId = 0;

      var tick = function () {
        curX += (targetX - curX) * 0.08;
        curY += (targetY - curY) * 0.08;
        document.body.style.setProperty('--px', curX.toFixed(2) + 'px');
        document.body.style.setProperty('--py', curY.toFixed(2) + 'px');
        if (Math.abs(targetX - curX) > 0.1 || Math.abs(targetY - curY) > 0.1) {
          rafId = requestAnimationFrame(tick);
        } else {
          rafId = 0;
        }
      };

      window.addEventListener('pointermove', function (e) {
        var nx = (e.clientX / Math.max(window.innerWidth, 1)) - 0.5;
        var ny = (e.clientY / Math.max(window.innerHeight, 1)) - 0.5;
        targetX = nx * -26;
        targetY = ny * -18;
        if (!rafId) rafId = requestAnimationFrame(tick);
      }, { passive: true });
    }

    if (els.fabComposerBtn && els.openComposerBtn) {
      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (entries) {
          if (!entries.length) return;
          els.fabComposerBtn.classList.toggle('is-visible', !entries[0].isIntersecting);
        }, { threshold: 0.1 });
        io.observe(els.openComposerBtn);
      } else {
        window.addEventListener('scroll', function () {
          els.fabComposerBtn.classList.toggle('is-visible', window.scrollY > 220);
        }, { passive: true });
      }
    }
  }

  /* ---------- 事件绑定 ---------- */

  function bindEvents() {
    enableLightDismissFallback(els.composerDialog);
    enableLightDismissFallback(els.readerDialog);

    function openComposer() {
      clearAllFormErrors();
      openDialog(els.composerDialog);
      if (els.nickname) {
        requestAnimationFrame(function () {
          els.nickname.focus({ preventScroll: true });
        });
      }
    }

    if (els.openComposerBtn) {
      els.openComposerBtn.addEventListener('click', openComposer);
    }
    if (els.fabComposerBtn) {
      els.fabComposerBtn.addEventListener('click', openComposer);
    }
    if (els.closeComposerBtn) {
      els.closeComposerBtn.addEventListener('click', function () {
        closeDialog(els.composerDialog);
      });
    }
    if (els.cancelComposerBtn) {
      els.cancelComposerBtn.addEventListener('click', function () {
        closeDialog(els.composerDialog);
      });
    }

    if (els.readerCloseBtn) {
      els.readerCloseBtn.addEventListener('click', function () {
        closeDialog(els.readerDialog);
      });
    }
    if (els.readerPrevBtn) {
      els.readerPrevBtn.addEventListener('click', function () {
        renderReaderContent(state.readerIndex - 1);
      });
    }
    if (els.readerNextBtn) {
      els.readerNextBtn.addEventListener('click', function () {
        renderReaderContent(state.readerIndex + 1);
      });
    }
    if (els.readerRandomBtn) {
      els.readerRandomBtn.addEventListener('click', openRandomNote);
    }
    if (els.readerKeepBtn) {
      els.readerKeepBtn.addEventListener('click', function () {
        var list = state.filteredNotes.length ? state.filteredNotes : state.allNotes;
        if (state.readerIndex >= 0 && list[state.readerIndex]) {
          toggleKeepNote(list[state.readerIndex], els.readerKeepBtn);
        }
      });
    }

    if (els.readerDialog) {
      els.readerDialog.addEventListener('keydown', function (e) {
        if (!els.readerDialog.open) return;
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          renderReaderContent(state.readerIndex - 1);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          renderReaderContent(state.readerIndex + 1);
        }
      });
    }

    if (els.form) {
      els.form.addEventListener('submit', onSubmit);
    }

    // 仅在用户输入超长时报错，未超长时绝不展示字数限制
    if (els.nickname) {
      els.nickname.addEventListener('input', function () {
        checkFieldLength(els.nickname, els.nicknameError, LIMITS.nickname, '昵称');
      });
    }
    if (els.content) {
      els.content.addEventListener('input', function () {
        checkFieldLength(els.content, els.contentError, LIMITS.content, '留言');
      });
    }
    if (els.favoriteMovie) {
      els.favoriteMovie.addEventListener('input', function () {
        checkFieldLength(els.favoriteMovie, els.favoriteMovieError, LIMITS.favoriteMovie, '电影名称');
      });
    }
  }

  /* ---------- INIT ---------- */

  function init() {
    loadKeptMap();
    bindEvents();
    bindAmbientEffects();
    loadNotes();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
