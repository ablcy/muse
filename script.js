(function () {
  const STORAGE_KEY = 'muse_notes';

  const $input = document.getElementById('noteInput');
  const $addBtn = document.getElementById('addBtn');
  const $container = document.getElementById('notesContainer');
  const $search = document.getElementById('searchInput');
  const $charCount = document.getElementById('charCount');
  const $filterTabs = document.querySelectorAll('.filter-tab');

  let notes = [];
  let currentFilter = 'all';

  function loadNotes() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      notes = raw ? JSON.parse(raw) : [];
    } catch {
      notes = [];
    }
  }

  function saveNotes() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }

  function formatTime(ts) {
    const d = new Date(ts);
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}`;

    const diffDays = Math.floor((now - d) / 86400000);
    if (diffDays === 0) return `今天 ${timeStr}`;
    if (diffDays === 1) return `昨天 ${timeStr}`;
    if (diffDays < 7) return `${diffDays} 天前 ${timeStr}`;
    return `${dateStr} ${timeStr}`;
  }

  function isToday(ts) {
    const d = new Date(ts);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }

  function isThisWeek(ts) {
    const d = new Date(ts);
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    return d >= startOfWeek;
  }

  function getFilteredNotes() {
    let filtered = [...notes];
    const query = $search.value.trim().toLowerCase();

    if (currentFilter === 'today') {
      filtered = filtered.filter((n) => isToday(n.timestamp));
    } else if (currentFilter === 'week') {
      filtered = filtered.filter((n) => isThisWeek(n.timestamp));
    }

    if (query) {
      filtered = filtered.filter((n) => n.content.toLowerCase().includes(query));
    }

    return filtered.reverse();
  }

  function render() {
    const filtered = getFilteredNotes();

    if (filtered.length === 0) {
      $container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">💡</div>
          <p>${notes.length === 0 ? '还没有灵感记录，开始写下第一条吧' : '没有匹配的便签'}</p>
        </div>`;
      return;
    }

    $container.innerHTML = filtered
      .map(
        (note, i) => `
      <div class="note-card" data-id="${note.id}">
        <div class="note-content">${escapeHtml(note.content)}</div>
        <div class="note-meta">
          <span class="note-time">${formatTime(note.timestamp)}</span>
          <div class="note-actions">
            <button class="btn-copy" data-action="copy" data-id="${note.id}">复制</button>
            <button class="btn-delete" data-action="delete" data-id="${note.id}">删除</button>
          </div>
        </div>
      </div>`
      )
      .join('');
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function addNote() {
    const content = $input.value.trim();
    if (!content) return;
    if (content.length > 500) {
      showToast('内容不能超过 500 字');
      return;
    }

    notes.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      content,
      timestamp: Date.now(),
    });

    saveNotes();
    $input.value = '';
    updateCharCount();
    render();
    showToast('灵感已记录');
  }

  function deleteNote(id) {
    notes = notes.filter((n) => n.id !== id);
    saveNotes();
    render();
    showToast('便签已删除');
  }

  function copyNote(id) {
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    navigator.clipboard.writeText(note.content).then(() => {
      showToast('已复制到剪贴板');
    });
  }

  function showToast(msg) {
    let toast = document.querySelector('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 1800);
  }

  function updateCharCount() {
    const len = $input.value.length;
    $charCount.textContent = `${len} / 500`;
    $charCount.classList.toggle('warn', len > 450);
  }

  // Events
  $addBtn.addEventListener('click', addNote);
  $input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      addNote();
    }
  });
  $input.addEventListener('input', updateCharCount);

  $search.addEventListener('input', render);

  $filterTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      $filterTabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = tab.dataset.filter;
      render();
    });
  });

  $container.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === 'delete') deleteNote(id);
    if (btn.dataset.action === 'copy') copyNote(id);
  });

  // Init
  loadNotes();
  render();
  updateCharCount();
})();