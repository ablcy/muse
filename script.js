(function () {
  // ============================================================
  // 配置
  // ============================================================
  var API_BASE = '/api';
  var TOKEN_KEY = 'muse_token';
  var USER_KEY = 'muse_user';

  // ============================================================
  // API 请求模块
  // ============================================================
  var api = {
    getToken: function () {
      return localStorage.getItem(TOKEN_KEY);
    },

    setToken: function (token) {
      localStorage.setItem(TOKEN_KEY, token);
    },

    clearToken: function () {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    },

    getUser: function () {
      try {
        var raw = localStorage.getItem(USER_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    },

    setUser: function (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    },

    request: async function (method, path, body) {
      var headers = { 'Content-Type': 'application/json' };
      var token = this.getToken();
      if (token) {
        headers['Authorization'] = 'Bearer ' + token;
      }

      var options = { method: method, headers: headers };
      if (body) {
        options.body = JSON.stringify(body);
      }

      var res = await fetch(API_BASE + path, options);
      var data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          this.clearToken();
        }
        throw new Error(data.error || '请求失败');
      }

      return data;
    },

    register: function (username, password) {
      return this.request('POST', '/auth/register', { username: username, password: password });
    },

    login: function (username, password) {
      return this.request('POST', '/auth/login', { username: username, password: password });
    },

    getMe: function () {
      return this.request('GET', '/auth/me');
    },

    getNotes: function () {
      return this.request('GET', '/notes');
    },

    createNote: function (content) {
      return this.request('POST', '/notes', { content: content });
    },

    deleteNote: function (id) {
      return this.request('DELETE', '/notes/' + id);
    }
  };

  // ============================================================
  // Toast 提示
  // ============================================================
  function showToast(msg) {
    var toast = document.querySelector('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () {
      toast.classList.remove('show');
    }, 1800);
  }

  // ============================================================
  // 页面切换
  // ============================================================
  var $authPage = document.getElementById('authPage');
  var $appPage = document.getElementById('appPage');

  function showAuthPage() {
    $authPage.classList.remove('hidden');
    $appPage.classList.add('hidden');
  }

  function showAppPage(username) {
    $authPage.classList.add('hidden');
    $appPage.classList.remove('hidden');
    document.getElementById('userGreeting').textContent = '你好，' + username;
    loadAndRenderNotes();
  }

  // ============================================================
  // 认证模块
  // ============================================================
  var $loginForm = document.getElementById('loginForm');
  var $registerForm = document.getElementById('registerForm');
  var $showRegister = document.getElementById('showRegister');
  var $showLogin = document.getElementById('showLogin');
  var $logoutBtn = document.getElementById('logoutBtn');

  $showRegister.addEventListener('click', function (e) {
    e.preventDefault();
    $loginForm.classList.add('hidden');
    $registerForm.classList.remove('hidden');
    document.getElementById('loginError').textContent = '';
    document.getElementById('registerError').textContent = '';
  });

  $showLogin.addEventListener('click', function (e) {
    e.preventDefault();
    $registerForm.classList.add('hidden');
    $loginForm.classList.remove('hidden');
    document.getElementById('loginError').textContent = '';
    document.getElementById('registerError').textContent = '';
  });

  // 登录
  $loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    var username = document.getElementById('loginUsername').value.trim();
    var password = document.getElementById('loginPassword').value;
    var errorEl = document.getElementById('loginError');
    var btn = $loginForm.querySelector('button');

    if (!username || !password) {
      errorEl.textContent = '请填写用户名和密码';
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="loading-spinner"></span>登录中...';
    errorEl.textContent = '';

    try {
      var data = await api.login(username, password);
      api.setToken(data.token);
      api.setUser(data.user);
      showAppPage(data.user.username);
    } catch (err) {
      errorEl.textContent = err.message;
    } finally {
      btn.disabled = false;
      btn.textContent = '登录';
    }
  });

  // 注册
  $registerForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    var username = document.getElementById('registerUsername').value.trim();
    var password = document.getElementById('registerPassword').value;
    var confirm = document.getElementById('registerConfirm').value;
    var errorEl = document.getElementById('registerError');
    var btn = $registerForm.querySelector('button');

    if (!username || !password || !confirm) {
      errorEl.textContent = '请填写所有字段';
      return;
    }
    if (username.length < 2) {
      errorEl.textContent = '用户名至少 2 个字符';
      return;
    }
    if (password.length < 6) {
      errorEl.textContent = '密码至少 6 个字符';
      return;
    }
    if (password !== confirm) {
      errorEl.textContent = '两次密码输入不一致';
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="loading-spinner"></span>注册中...';
    errorEl.textContent = '';

    try {
      var data = await api.register(username, password);
      api.setToken(data.token);
      api.setUser(data.user);
      showAppPage(data.user.username);
    } catch (err) {
      errorEl.textContent = err.message;
    } finally {
      btn.disabled = false;
      btn.textContent = '注册';
    }
  });

  // 退出登录
  $logoutBtn.addEventListener('click', function () {
    api.clearToken();
    showAuthPage();
    $loginForm.reset();
    $registerForm.reset();
    document.getElementById('loginError').textContent = '';
    document.getElementById('registerError').textContent = '';
  });

  // ============================================================
  // 便签模块
  // ============================================================
  var $input = document.getElementById('noteInput');
  var $addBtn = document.getElementById('addBtn');
  var $container = document.getElementById('notesContainer');
  var $search = document.getElementById('searchInput');
  var $charCount = document.getElementById('charCount');
  var $filterTabs = document.querySelectorAll('.filter-tab');

  var notes = [];
  var currentFilter = 'all';

  function formatTime(ts) {
    var d = new Date(ts);
    var now = new Date();
    var pad = function (n) { return String(n).padStart(2, '0'); };
    var dateStr = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    var timeStr = pad(d.getHours()) + ':' + pad(d.getMinutes());
    var diffDays = Math.floor((now - d) / 86400000);

    if (diffDays === 0) return '今天 ' + timeStr;
    if (diffDays === 1) return '昨天 ' + timeStr;
    if (diffDays < 7) return diffDays + ' 天前 ' + timeStr;
    return dateStr + ' ' + timeStr;
  }

  function isToday(ts) {
    var d = new Date(ts);
    var now = new Date();
    return d.toDateString() === now.toDateString();
  }

  function isThisWeek(ts) {
    var d = new Date(ts);
    var now = new Date();
    var startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    return d >= startOfWeek;
  }

  function getFilteredNotes() {
    var filtered = notes.slice();
    var query = $search.value.trim().toLowerCase();

    if (currentFilter === 'today') {
      filtered = filtered.filter(function (n) { return isToday(n.created_at); });
    } else if (currentFilter === 'week') {
      filtered = filtered.filter(function (n) { return isThisWeek(n.created_at); });
    }

    if (query) {
      filtered = filtered.filter(function (n) {
        return n.content.toLowerCase().indexOf(query) !== -1;
      });
    }

    return filtered;
  }

  function render() {
    var filtered = getFilteredNotes();

    if (filtered.length === 0) {
      $container.innerHTML =
        '<div class="empty-state">' +
        '<div class="empty-icon">💡</div>' +
        '<p>' + (notes.length === 0 ? '还没有灵感记录，开始写下第一条吧' : '没有匹配的便签') + '</p>' +
        '</div>';
      return;
    }

    $container.innerHTML = filtered.map(function (note) {
      return (
        '<div class="note-card" data-id="' + note.id + '">' +
        '<div class="note-content">' + escapeHtml(note.content) + '</div>' +
        '<div class="note-meta">' +
        '<span class="note-time">' + formatTime(note.created_at) + '</span>' +
        '<div class="note-actions">' +
        '<button class="btn-copy" data-action="copy" data-id="' + note.id + '">复制</button>' +
        '<button class="btn-delete" data-action="delete" data-id="' + note.id + '">删除</button>' +
        '</div>' +
        '</div>' +
        '</div>'
      );
    }).join('');
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  async function addNote() {
    var content = $input.value.trim();
    if (!content) return;
    if (content.length > 500) {
      showToast('内容不能超过 500 字');
      return;
    }

    try {
      await api.createNote(content);
      $input.value = '';
      updateCharCount();
      await loadAndRenderNotes();
      showToast('灵感已记录');
    } catch (err) {
      showToast(err.message);
    }
  }

  async function deleteNote(id) {
    try {
      await api.deleteNote(id);
      await loadAndRenderNotes();
      showToast('便签已删除');
    } catch (err) {
      showToast(err.message);
    }
  }

  function copyNote(id) {
    var note = notes.find(function (n) { return n.id === Number(id); });
    if (!note) return;
    navigator.clipboard.writeText(note.content).then(function () {
      showToast('已复制到剪贴板');
    });
  }

  async function loadAndRenderNotes() {
    try {
      var data = await api.getNotes();
      notes = data.notes;
      render();
    } catch (err) {
      showToast('加载便签失败');
    }
  }

  function updateCharCount() {
    var len = $input.value.length;
    $charCount.textContent = len + ' / 500';
    $charCount.classList.toggle('warn', len > 450);
  }

  // ============================================================
  // 事件绑定
  // ============================================================
  $addBtn.addEventListener('click', addNote);
  $input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      addNote();
    }
  });
  $input.addEventListener('input', updateCharCount);

  $search.addEventListener('input', render);

  $filterTabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      $filterTabs.forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      currentFilter = tab.dataset.filter;
      render();
    });
  });

  $container.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var id = btn.dataset.id;
    if (btn.dataset.action === 'delete') deleteNote(id);
    if (btn.dataset.action === 'copy') copyNote(id);
  });

  // ============================================================
  // 启动：检查登录状态
  // ============================================================
  (async function init() {
    var token = api.getToken();
    var user = api.getUser();

    if (token && user) {
      try {
        var data = await api.getMe();
        showAppPage(data.user.username);
        return;
      } catch (e) {
        api.clearToken();
      }
    }

    showAuthPage();
    updateCharCount();
  })();
})();
（内容由AI生成，仅供参考）
