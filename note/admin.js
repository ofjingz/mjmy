/**
 * 幕间漫游 · 留言审核台（site/note/admin.html）
 * - 密码登录：Header x-admin-key，密码存 sessionStorage
 * - GET   /api/admin/notes   -> 全量列表（含 pending/rejected）
 * - PATCH /api/admin/notes   -> 批量/单条改 status
 * - DELETE /api/admin/notes?id= -> 删除单条
 * - GET   /api/admin/export  -> 下载 UTF-8 BOM CSV（fetch + blob 触发下载）
 * - POST  /api/admin/import  -> 上传 CSV 回写 status（先本地校验列）
 * - 无后端（404/网络/DB_NOT_BOUND）时进入「仅演示」模式：内存演示数据 + 横幅
 * - 安全：所有用户内容一律 textContent 渲染，绝不 innerHTML 拼接
 */
(function () {
  'use strict';

  var KEY_STORAGE = 'mujian.note.admin-key';

  var STATUS_BADGE = { pending: '待审核', approved: '已通过', rejected: '已拒绝' };
  var STATUS_BADGE_CLASS = { pending: 'is-pending', approved: 'is-approved', rejected: 'is-rejected' };
  var STATUS_EXPORT = { pending: '待审核', approved: '通过', rejected: '不通过' };

  var els = {
    loginSection: document.getElementById('admin-login'),
    loginForm: document.getElementById('login-form'),
    adminKey: document.getElementById('admin-key'),
    loginError: document.getElementById('login-error'),
    panel: document.getElementById('admin-panel'),
    demoBanner: document.getElementById('admin-demo-banner'),
    list: document.getElementById('admin-list'),
    count: document.getElementById('admin-count'),
    template: document.getElementById('admin-note-template'),
    toast: document.getElementById('toast'),
    btnExport: document.getElementById('btn-export'),
    importFile: document.getElementById('import-file'),
    btnLogout: document.getElementById('btn-logout'),
    selectAll: document.getElementById('select-all'),
    batchCount: document.getElementById('batch-count'),
    btnApproveSel: document.getElementById('btn-approve-selected'),
    btnRejectSel: document.getElementById('btn-reject-selected'),
    btnDeleteSel: document.getElementById('btn-delete-selected')
  };

  var state = {
    demoMode: false,
    key: '',
    notes: [],
    selected: []
  };

  var toastTimer = null;

  /* ---------- 工具 ---------- */

  function showToast(message) {
    if (!els.toast) return;
    els.toast.textContent = message;
    els.toast.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      els.toast.hidden = true;
    }, 2800);
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

  function readKey() {
    try {
      return sessionStorage.getItem(KEY_STORAGE) || '';
    } catch (_) {
      return '';
    }
  }

  function writeKey(key) {
    try {
      sessionStorage.setItem(KEY_STORAGE, key);
    } catch (_) {}
  }

  function clearKey() {
    try {
      sessionStorage.removeItem(KEY_STORAGE);
    } catch (_) {}
  }

  function findNote(id) {
    for (var i = 0; i < state.notes.length; i++) {
      if (state.notes[i].id === id) return state.notes[i];
    }
    return null;
  }

  /* ---------- 演示数据（仅兜底） ---------- */

  function demoAdminNotes() {
    var now = Date.now();
    var M = 60 * 1000;
    var H = 60 * M;
    var D = 24 * H;
    function iso(ms) { return new Date(now - ms).toISOString(); }
    return [
      { id: 6, nickname: '阿维', content: '第一次来线下影展，看到《四百击》结尾奔跑的男孩，眼眶一下就热了。谢谢策展人。', favorite_movie: '四百击', status: 'approved', created_at: iso(2 * H), reviewed_at: iso(1 * H) },
      { id: 5, nickname: '胶片信', content: '很喜欢「银幕背后」那个展区，原来一场放映背后有这么多人的手。', favorite_movie: '天堂电影院', status: 'approved', created_at: iso(1 * D), reviewed_at: iso(20 * H) },
      { id: 4, nickname: '待审访客', content: '请问下一场《花样年华》的票怎么预约？', favorite_movie: '', status: 'pending', created_at: iso(30 * M), reviewed_at: '' },
      { id: 3, nickname: '小李', content: '留言板这个房间的纸面质感很舒服，像在影院的留言本上写字。', favorite_movie: '花样年华', status: 'rejected', created_at: iso(2 * D), reviewed_at: iso(1 * D) },
      { id: 2, nickname: 'M', content: '散场之后才明白，影迷之间的连接比电影本身更长。期待下一场。', favorite_movie: '', status: 'approved', created_at: iso(3 * D), reviewed_at: iso(2 * D) },
      { id: 1, nickname: '无名', content: '把票根贴在手帐里了，明年还要来。', favorite_movie: '一一', status: 'pending', created_at: iso(4 * D), reviewed_at: '' }
    ];
  }

  /* ---------- 渲染（全部 textContent，XSS 安全） ---------- */

  // 模板缺失时的纯 DOM 兜底（静态结构，无 innerHTML，无用户内容拼接）
  function buildAdminCardDOM() {
    function el(tag, cls) {
      var e = document.createElement(tag);
      if (cls) e.className = cls;
      return e;
    }

    var head = el('header', 'note-head');
    var left = el('div', 'note-head-left');
    var select = el('label', 'admin-select');
    var check = el('input', 'admin-check');
    check.type = 'checkbox';
    var badge = el('span', 'status-badge');
    select.appendChild(check);
    left.appendChild(select);
    left.appendChild(badge);
    var time = el('time', 'note-time');
    head.appendChild(left);
    head.appendChild(time);

    var nick = el('p', 'note-nickname');
    var content = el('p', 'note-content');
    var movie = el('p', 'note-movie');

    var foot = el('footer', 'admin-actions');
    var labels = ['approved', 'rejected', 'delete'];
    var texts = ['通过', '拒绝', '删除'];
    for (var i = 0; i < labels.length; i++) {
      var b = el('button', 'c-btn c-btn--secondary admin-btn');
      if (labels[i] === 'delete') b.className += ' danger';
      b.type = 'button';
      b.setAttribute('data-action', labels[i]);
      b.textContent = texts[i];
      foot.appendChild(b);
    }

    var frag = document.createDocumentFragment();
    frag.appendChild(head);
    frag.appendChild(nick);
    frag.appendChild(content);
    frag.appendChild(movie);
    frag.appendChild(foot);
    return frag;
  }

  function renderAdminNote(note) {
    var node = els.template ? els.template.content.firstElementChild.cloneNode(true) : null;
    if (!node) {
      node = document.createElement('article');
      node.className = 'note-card admin-card';
      node.appendChild(buildAdminCardDOM());
    }

    node.setAttribute('data-id', String(note.id));

    var check = node.querySelector('.admin-check');
    check.checked = state.selected.indexOf(note.id) !== -1;

    var badge = node.querySelector('.status-badge');
    badge.textContent = STATUS_BADGE[note.status] || String(note.status);
    badge.className = 'status-badge ' + (STATUS_BADGE_CLASS[note.status] || '');

    node.querySelector('.note-time').textContent = formatTime(note.created_at);
    node.querySelector('.note-nickname').textContent = String(note.nickname || '');
    node.querySelector('.note-content').textContent = String(note.content || '');
    node.querySelector('.note-movie').textContent = note.favorite_movie
      ? '最爱电影：' + String(note.favorite_movie)
      : '';

    var buttons = node.querySelectorAll('.admin-btn');
    for (var i = 0; i < buttons.length; i++) {
      var action = buttons[i].getAttribute('data-action');
      if (action === 'approved' && note.status === 'approved') buttons[i].hidden = true;
      if (action === 'rejected' && note.status === 'rejected') buttons[i].hidden = true;
    }

    return node;
  }

  function render() {
    if (!els.list) return;
    els.list.textContent = '';

    if (!state.notes.length) {
      var empty = document.createElement('p');
      empty.className = 'loading-state';
      empty.textContent = '暂无留言。';
      els.list.appendChild(empty);
    } else {
      for (var i = 0; i < state.notes.length; i++) {
        els.list.appendChild(renderAdminNote(state.notes[i]));
      }
    }

    if (els.count) els.count.textContent = state.notes.length + ' 条';
    updateSelectionUI();
  }

  function updateSelectionUI() {
    if (els.batchCount) {
      els.batchCount.textContent = '已选 ' + state.selected.length + ' 条';
    }
    var has = state.selected.length > 0;
    if (els.btnApproveSel) els.btnApproveSel.disabled = !has;
    if (els.btnRejectSel) els.btnRejectSel.disabled = !has;
    if (els.btnDeleteSel) els.btnDeleteSel.disabled = !has;
    if (els.selectAll) {
      els.selectAll.checked = state.notes.length > 0 && state.selected.length === state.notes.length;
    }
  }

  /* ---------- 模式切换 ---------- */

  function showLogin(message) {
    if (els.panel) els.panel.hidden = true;
    if (els.loginSection) els.loginSection.hidden = false;
    if (els.loginError) {
      if (message) {
        els.loginError.textContent = message;
        els.loginError.hidden = false;
      } else {
        els.loginError.hidden = true;
      }
    }
  }

  function showPanel() {
    if (els.loginSection) els.loginSection.hidden = true;
    if (els.panel) els.panel.hidden = false;
    if (els.demoBanner) els.demoBanner.hidden = !state.demoMode;
  }

  function enterDemoMode() {
    state.demoMode = true;
    state.notes = demoAdminNotes();
    state.selected = [];
    showPanel();
    render();
  }

  /* ---------- 数据加载 ---------- */

  function loadAll(key) {
    return fetch('/api/admin/notes', {
      headers: { 'x-admin-key': key },
      cache: 'no-store'
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, status: res.status, data: data };
        }).catch(function () {
          return { ok: false, status: res.status, data: {} };
        });
      });
  }

  function attemptLogin(key) {
    loadAll(key).then(function (r) {
      if (r.ok && r.data && r.data.ok === true) {
        state.demoMode = false;
        state.key = key;
        writeKey(key);
        state.notes = Array.isArray(r.data.notes) ? r.data.notes : [];
        state.selected = [];
        showPanel();
        render();
      } else if (r.status === 401) {
        clearKey();
        showLogin('密码错误或未授权');
      } else if (r.data && r.data.error === 'DB_NOT_BOUND') {
        state.key = key;
        writeKey(key);
        enterDemoMode();
      } else {
        // 网络错误 / 其他：按无后端处理（本地静态服务器）
        state.key = key;
        writeKey(key);
        enterDemoMode();
      }
    }).catch(function () {
      state.key = key;
      writeKey(key);
      enterDemoMode();
    });
  }

  function refresh() {
    if (state.demoMode) {
      render();
      return;
    }
    loadAll(state.key).then(function (r) {
      if (r.ok && r.data && r.data.ok === true) {
        state.notes = Array.isArray(r.data.notes) ? r.data.notes : [];
        state.selected = state.selected.filter(function (id) {
          return findNote(id) !== null;
        });
        render();
      } else if (r.status === 401) {
        clearKey();
        showLogin('登录已过期，请重新登录');
      } else {
        showToast('刷新失败：' + (r.data && r.data.error ? r.data.error : r.status));
      }
    });
  }

  /* ---------- 变更：通过 / 拒绝 / 删除 ---------- */

  function patchStatus(ids, status) {
    if (state.demoMode) {
      for (var i = 0; i < ids.length; i++) {
        var n = findNote(ids[i]);
        if (n) {
          n.status = status;
          n.reviewed_at = new Date().toISOString();
        }
      }
      state.selected = [];
      render();
      showToast('演示模式：修改仅本机可见');
      return;
    }

    var body = ids.length === 1
      ? { id: ids[0], status: status }
      : { items: ids.map(function (id) { return { id: id, status: status }; }) };

    fetch('/api/admin/notes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': state.key },
      body: JSON.stringify(body)
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, status: res.status, data: data };
        }).catch(function () {
          return { ok: false, status: res.status, data: {} };
        });
      })
      .then(function (r) {
        if (r.ok && r.data && r.data.ok === true) {
          showToast('已更新 ' + (r.data.updated || 0) + ' 条');
          refresh();
        } else if (r.status === 401) {
          clearKey();
          showLogin('登录已过期，请重新登录');
        } else {
          showToast('操作失败：' + (r.data && r.data.error ? r.data.error : r.status));
        }
      });
  }

  function deleteNote(id) {
    if (state.demoMode) {
      var next = [];
      for (var i = 0; i < state.notes.length; i++) {
        if (state.notes[i].id !== id) next.push(state.notes[i]);
      }
      state.notes = next;
      state.selected = state.selected.filter(function (x) { return x !== id; });
      render();
      showToast('演示模式：删除仅本机可见');
      return;
    }

    fetch('/api/admin/notes?id=' + encodeURIComponent(id), {
      method: 'DELETE',
      headers: { 'x-admin-key': state.key }
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, status: res.status, data: data };
        }).catch(function () {
          return { ok: false, status: res.status, data: {} };
        });
      })
      .then(function (r) {
        if (r.ok && r.data && r.data.ok === true) {
          showToast('已删除');
          refresh();
        } else if (r.status === 401) {
          clearKey();
          showLogin('登录已过期，请重新登录');
        } else {
          showToast('删除失败：' + (r.data && r.data.error ? r.data.error : r.status));
        }
      });
  }

  /* ---------- 导出 / 导入 CSV ---------- */

  function csvCell(value) {
    var s = String(value == null ? '' : value);
    if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function buildCSV(notes) {
    var header = ['id', '昵称', '最爱的一部电影', '留言内容', '审核状态(通过/待审核/不通过)', '提交时间', '审核时间'];
    var lines = [header];
    for (var i = 0; i < notes.length; i++) {
      var n = notes[i];
      lines.push([
        n.id,
        n.nickname,
        n.favorite_movie || '',
        n.content,
        STATUS_EXPORT[n.status] || n.status,
        n.created_at,
        n.reviewed_at || ''
      ]);
    }
    return '\uFEFF' + lines.map(function (row) {
      return row.map(csvCell).join(',');
    }).join('\r\n');
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename || 'notes.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function exportCSV() {
    if (state.demoMode) {
      downloadBlob(new Blob([buildCSV(state.notes)], { type: 'text/csv;charset=utf-8' }), 'mujian-notes-' + today() + '.csv');
      showToast('演示模式：已导出本地演示数据');
      return;
    }

    fetch('/api/admin/export', { headers: { 'x-admin-key': state.key } })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        var cd = res.headers.get('Content-Disposition') || '';
        var m = cd.match(/filename="?([^";]+)"?/);
        var filename = m ? m[1] : 'mujian-notes-' + today() + '.csv';
        return res.blob().then(function (blob) {
          downloadBlob(blob, filename);
        });
      })
      .catch(function () {
        showToast('导出失败，请重试');
      });
  }

  function parseCSV(text) {
    var rows = [];
    var row = [];
    var cell = '';
    var inQuotes = false;
    var src = String(text || '').replace(/^\uFEFF/, '');
    for (var i = 0; i < src.length; i++) {
      var ch = src[i];
      if (inQuotes) {
        if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') inQuotes = false;
        else cell += ch;
      } else {
        if (ch === '"') inQuotes = true;
        else if (ch === ',') { row.push(cell); cell = ''; }
        else if (ch === '\r') { /* ignore */ }
        else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
        else cell += ch;
      }
    }
    if (cell.length || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  function normalizeStatus(raw) {
    var s = String(raw || '').trim().toLowerCase();
    if (['通过', '已通过', 'approved', 'approve', 'yes', 'y', '1', 'true', 'ok'].indexOf(s) !== -1) return 'approved';
    if (['不通过', '拒绝', 'rejected', 'reject', 'no', 'n', '0', 'false'].indexOf(s) !== -1) return 'rejected';
    return 'pending';
  }

  function validateCSV(text) {
    var rows = parseCSV(text);
    if (rows.length < 2) return { ok: false, error: 'CSV 为空或缺少数据行' };
    var headers = rows[0].map(function (h) { return String(h).trim().toLowerCase(); });
    var idIdx = -1;
    var statusIdx = -1;
    for (var i = 0; i < headers.length; i++) {
      if (headers[i] === 'id') idIdx = i;
      if (headers[i].indexOf('审核') !== -1 || headers[i].indexOf('status') !== -1) statusIdx = i;
    }
    if (idIdx === -1 || statusIdx === -1) {
      return { ok: false, error: 'CSV 缺少必需列：需要「id」列和「审核状态」列' };
    }
    return { ok: true, idIdx: idIdx, statusIdx: statusIdx, rows: rows };
  }

  function handleImportFile(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var text = String(reader.result || '');
      var v = validateCSV(text);
      if (!v.ok) {
        showToast(v.error);
        return;
      }

      if (state.demoMode) {
        var updated = 0;
        for (var i = 1; i < v.rows.length; i++) {
          var r = v.rows[i];
          var id = Number(r[v.idIdx]);
          if (!Number.isInteger(id) || id <= 0) continue;
          var n = findNote(id);
          if (n) {
            n.status = normalizeStatus(r[v.statusIdx]);
            n.reviewed_at = new Date().toISOString();
            updated++;
          }
        }
        render();
        showToast('演示模式：已本地更新 ' + updated + ' 条');
      } else {
        fetch('/api/admin/import', {
          method: 'POST',
          headers: { 'x-admin-key': state.key, 'Content-Type': 'text/csv' },
          body: text
        })
          .then(function (res) {
            return res.json().then(function (data) {
              return { ok: res.ok, status: res.status, data: data };
            }).catch(function () {
              return { ok: false, status: res.status, data: {} };
            });
          })
          .then(function (r) {
            if (r.ok && r.data && r.data.ok === true) {
              showToast('已导入，更新 ' + (r.data.updated || 0) + ' 条');
              refresh();
            } else if (r.status === 401) {
              clearKey();
              showLogin('登录已过期，请重新登录');
            } else {
              showToast('导入失败：' + (r.data && r.data.error ? r.data.error : r.status));
            }
          });
      }
    };
    reader.onerror = function () {
      showToast('读取文件失败');
    };
    reader.readAsText(file, 'utf-8');
  }

  /* ---------- 事件绑定 ---------- */

  function bindEvents() {
    if (els.loginForm) {
      els.loginForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var key = els.adminKey ? els.adminKey.value.trim() : '';
        if (!key) {
          if (els.loginError) {
            els.loginError.textContent = '请输入管理员密码';
            els.loginError.hidden = false;
          }
          return;
        }
        if (els.loginError) els.loginError.hidden = true;
        attemptLogin(key);
      });
    }

    if (els.btnLogout) {
      els.btnLogout.addEventListener('click', function () {
        clearKey();
        state.key = '';
        state.demoMode = false;
        state.notes = [];
        state.selected = [];
        showLogin();
      });
    }

    if (els.btnExport) {
      els.btnExport.addEventListener('click', exportCSV);
    }

    if (els.importFile) {
      els.importFile.addEventListener('change', function (e) {
        var file = e.target.files && e.target.files[0];
        if (file) handleImportFile(file);
        els.importFile.value = '';
      });
    }

    if (els.list) {
      els.list.addEventListener('click', function (e) {
        var btn = e.target.closest('.admin-btn');
        if (btn) {
          var card = btn.closest('.admin-card');
          var id = Number(card ? card.getAttribute('data-id') : 0);
          if (!id) return;
          var action = btn.getAttribute('data-action');
          if (action === 'approved') patchStatus([id], 'approved');
          else if (action === 'rejected') patchStatus([id], 'rejected');
          else if (action === 'delete') {
            if (window.confirm('确定删除这条留言？此操作不可撤销。')) deleteNote(id);
          }
          return;
        }

        var check = e.target.closest('.admin-check');
        if (check) {
          var ccard = check.closest('.admin-card');
          var cid = Number(ccard ? ccard.getAttribute('data-id') : 0);
          if (!cid) return;
          var idx = state.selected.indexOf(cid);
          if (check.checked) {
            if (idx === -1) state.selected.push(cid);
          } else {
            if (idx !== -1) state.selected.splice(idx, 1);
          }
          updateSelectionUI();
        }
      });
    }

    if (els.selectAll) {
      els.selectAll.addEventListener('change', function () {
        if (els.selectAll.checked) {
          state.selected = state.notes.map(function (n) { return n.id; });
        } else {
          state.selected = [];
        }
        render();
      });
    }

    if (els.btnApproveSel) {
      els.btnApproveSel.addEventListener('click', function () {
        if (state.selected.length) patchStatus(state.selected.slice(), 'approved');
      });
    }
    if (els.btnRejectSel) {
      els.btnRejectSel.addEventListener('click', function () {
        if (state.selected.length) patchStatus(state.selected.slice(), 'rejected');
      });
    }
    if (els.btnDeleteSel) {
      els.btnDeleteSel.addEventListener('click', function () {
        if (!state.selected.length) return;
        if (!window.confirm('确定删除选中的 ' + state.selected.length + ' 条留言？此操作不可撤销。')) return;
        if (state.demoMode) {
          var ids = state.selected.slice();
          var next = [];
          for (var i = 0; i < state.notes.length; i++) {
            if (ids.indexOf(state.notes[i].id) === -1) next.push(state.notes[i]);
          }
          state.notes = next;
          state.selected = [];
          render();
          showToast('演示模式：已删除 ' + ids.length + ' 条');
          return;
        }
        // 在线批量删除：后端 DELETE 仅支持单条，逐条调用
        var pending = state.selected.slice();
        state.selected = [];
        render();
        var chain = Promise.resolve();
        pending.forEach(function (id) {
          chain = chain.then(function () { return deleteNoteOnline(id); });
        });
        chain.then(function () {
          showToast('已删除 ' + pending.length + ' 条');
          refresh();
        });
      });
    }
  }

  function deleteNoteOnline(id) {
    return fetch('/api/admin/notes?id=' + encodeURIComponent(id), {
      method: 'DELETE',
      headers: { 'x-admin-key': state.key }
    }).then(function (res) {
      if (res.status === 401) {
        clearKey();
        showLogin('登录已过期，请重新登录');
      }
    }).catch(function () {});
  }

  /* ---------- INIT ---------- */

  function detectBackend() {
    return fetch('/api/admin/notes', { cache: 'no-store' })
      .then(function (res) {
        // 静态服务器无 functions：/api/admin/notes 返回 404
        return res.status !== 404;
      })
      .catch(function () {
        return false;
      });
  }

  function init() {
    bindEvents();
    detectBackend().then(function (hasBackend) {
      if (!hasBackend) {
        enterDemoMode();
        return;
      }
      var key = readKey();
      if (key) {
        attemptLogin(key);
      } else {
        showLogin();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
