class Bookmark {
  constructor(url, title, description = '', tags = [], timestamp = Date.now(), wordCount = 0) {
    this.id = Date.now().toString(36) + Math.random().toString(36).substr(2);
    this.url = url;
    this.title = title;
    this.description = description;
    this.tags = tags;
    this.timestamp = timestamp;
    this.wordCount = wordCount;
  }
}

class BookmarksApp {
  constructor() {
    this.bookmarks = [];
    this.activeTag = null;
    this.searchTerm = '';
    this._searchTimer = null;

    // Theme
    this.theme = 'light';

    // Sync provider
    this.currentSyncProvider = 'github';

    // GitHub
    this.githubService = null;
    this.githubAuth = null;
    this.isGitHubConnected = false;
    this.lastSync = null;
    this.repositoryStatus = null;
    this.availableRepositories = [];

    // Local File
    this.localFileService = null;
    this.hasLocalFile = false;

    // Google Drive
    this.googleDriveService = null;
    this.googleDriveAuth = null;
    this.isGoogleDriveConnected = false;
    this.googleDriveToken = null;

    // Pending confirm-delete id + timer
    this._deleteConfirmId = null;
    this._deleteConfirmTimer = null;

    this.init();
  }

  async init() {
    this.githubService = new GitHubService();
    this.githubAuth = new GitHubAuth();
    this.localFileService = new LocalFileService();
    this.googleDriveService = new GoogleDriveService();
    this.googleDriveAuth = new GoogleDriveAuth();

    // Theme — persisted, fallback to system preference
    const stored = await chrome.storage.local.get(['theme', 'currentSyncProvider']);
    if (stored.theme) {
      this.theme = stored.theme;
    } else {
      this.theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', this.theme);

    if (stored.currentSyncProvider) this.currentSyncProvider = stored.currentSyncProvider;

    // GitHub
    await this.checkGitHubConnection();
    if (this.isGitHubConnected) await this.checkRepositoryStatus();

    // Local File
    this.hasLocalFile = await this.localFileService.hasStoredFile();

    // Google Drive cached token
    const cachedToken = await this.googleDriveAuth.getToken();
    if (cachedToken) {
      this.googleDriveToken = cachedToken;
      this.isGoogleDriveConnected = true;
    }

    await this.loadBookmarks();
    this.setupEventListeners();
    this.populateSaveBar();
    this.render();
  }

  // ─────────────────────────────────────────────────────────────────
  //  Save bar — show the active tab
  // ─────────────────────────────────────────────────────────────────

  async populateSaveBar() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;

      const titleEl = document.getElementById('currentTitle');
      const domainEl = document.getElementById('currentDomain');
      const favEl = document.getElementById('currentFav');

      titleEl.textContent = tab.title || tab.url;
      try {
        domainEl.textContent = new URL(tab.url).hostname;
      } catch { domainEl.textContent = ''; }

      const faviconUrl = this.faviconUrl(tab.url);
      favEl.innerHTML = '';
      const img = document.createElement('img');
      img.src = faviconUrl;
      img.alt = '';
      img.onerror = () => {
        favEl.innerHTML = '';
        const letter = document.createElement('div');
        letter.className = 'rf-fav-letter';
        letter.style.background = this.letterColor(tab.title || tab.url);
        letter.textContent = (tab.title || tab.url || '?')[0].toUpperCase();
        favEl.appendChild(letter);
      };
      favEl.appendChild(img);
    } catch (e) {
      console.error('populateSaveBar error', e);
    }
  }

  faviconUrl(url) {
    try {
      const encoded = encodeURIComponent(url);
      return chrome.runtime.getURL(`_favicon/?pageUrl=${encoded}&size=28`);
    } catch {
      return '';
    }
  }

  letterColor(seed) {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
    return `oklch(0.55 0.14 ${Math.abs(h) % 360})`;
  }

  readingTime(wordCount) {
    if (!wordCount || wordCount < 1) return null;
    const mins = Math.max(1, Math.round(wordCount / 200));
    return `${mins} min`;
  }

  // ─────────────────────────────────────────────────────────────────
  //  Event listeners
  // ─────────────────────────────────────────────────────────────────

  setupEventListeners() {
    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());

    // Sync button → quick sync with active provider
    document.getElementById('syncBtn').addEventListener('click', () => this.quickSync());

    // Settings panel
    document.getElementById('settingsBtn').addEventListener('click', () => this.openSettings());
    document.getElementById('closeSettings').addEventListener('click', () => this.closeSettings());

    // Save bar
    document.getElementById('saveCurrentBtn').addEventListener('click', () => this.saveCurrentPage());

    // Search — debounced
    document.getElementById('searchInput').addEventListener('input', (e) => {
      clearTimeout(this._searchTimer);
      this._searchTimer = setTimeout(() => {
        this.searchTerm = e.target.value.toLowerCase();
        this.renderList();
      }, 80);
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => this.handleKeydown(e));

    // ⌘K pill focuses search
    document.getElementById('kbdHint').addEventListener('click', () => {
      document.getElementById('searchInput').focus();
    });

    // Provider selector
    document.querySelectorAll('.provider-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => this.switchSyncProvider(e.currentTarget.dataset.provider));
    });

    // GitHub
    document.getElementById('connectGitHubBtn').addEventListener('click', () => this.connectToGitHub());
    document.getElementById('disconnectGitHubBtn').addEventListener('click', () => this.disconnectFromGitHub());
    document.getElementById('syncFromGitHub').addEventListener('click', () => this.syncFromGitHub());
    document.getElementById('syncToGitHub').addEventListener('click', () => this.syncToGitHub());
    document.getElementById('fullSync').addEventListener('click', () => this.fullSync());
    document.getElementById('selectRepo').addEventListener('click', () => this.showRepositoryList());
    document.getElementById('createRepo').addEventListener('click', () => this.createNewRepository());
    document.getElementById('cancelRepoSelection').addEventListener('click', () => this.hideRepositoryList());

    // Local File
    document.getElementById('pickLocalFileBtn').addEventListener('click', () => this.syncLocalFilePickFile());
    document.getElementById('createLocalFileBtn').addEventListener('click', () => this.syncLocalFileCreate());
    document.getElementById('syncFromLocalFile').addEventListener('click', () => this.syncLocalFileFrom());
    document.getElementById('syncToLocalFile').addEventListener('click', () => this.syncLocalFileTo());
    document.getElementById('fullSyncLocalFile').addEventListener('click', () => this.fullSyncLocalFile());
    document.getElementById('clearLocalFileBtn').addEventListener('click', () => this.clearLocalFile());

    // Google Drive
    document.getElementById('connectDriveBtn').addEventListener('click', () => this.connectToGoogleDrive());
    document.getElementById('disconnectDriveBtn').addEventListener('click', () => this.disconnectFromGoogleDrive());
    document.getElementById('createDriveFileBtn').addEventListener('click', () => this.createDriveFile());
    document.getElementById('selectDriveFileBtn').addEventListener('click', () => this.selectDriveFile());
    document.getElementById('syncFromDrive').addEventListener('click', () => this.syncDriveFrom());
    document.getElementById('syncToDrive').addEventListener('click', () => this.syncDriveTo());
    document.getElementById('fullSyncDrive').addEventListener('click', () => this.fullSyncDrive());
    document.getElementById('clearDriveFileBtn').addEventListener('click', () => this.clearDriveFile());
  }

  handleKeydown(e) {
    const key = e.key;
    const meta = e.metaKey || e.ctrlKey;
    const searchInput = document.getElementById('searchInput');
    const settingsPanel = document.getElementById('settingsPanel');

    if (meta && key === 'k') {
      e.preventDefault();
      searchInput.focus();
      return;
    }

    if (key === 'Escape') {
      if (!settingsPanel.classList.contains('hidden')) {
        this.closeSettings();
        return;
      }
      if (this.searchTerm) {
        searchInput.value = '';
        this.searchTerm = '';
        this.renderList();
        return;
      }
      if (this.activeTag !== null) {
        this.activeTag = null;
        this.renderTags();
        this.renderList();
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────
  //  Theme
  // ─────────────────────────────────────────────────────────────────

  async toggleTheme() {
    this.theme = this.theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', this.theme);
    await chrome.storage.local.set({ theme: this.theme });
    this.renderThemeIcon();
  }

  renderThemeIcon() {
    const btn = document.getElementById('themeToggle');
    if (this.theme === 'light') {
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
      btn.title = 'Switch to dark';
    } else {
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.07" y2="4.93"/></svg>`;
      btn.title = 'Switch to light';
    }
  }

  // ─────────────────────────────────────────────────────────────────
  //  Settings panel
  // ─────────────────────────────────────────────────────────────────

  openSettings() {
    document.getElementById('settingsPanel').classList.remove('hidden');
    this.renderSyncTab();
  }

  closeSettings() {
    document.getElementById('settingsPanel').classList.add('hidden');
  }

  // ─────────────────────────────────────────────────────────────────
  //  Save / Add bookmark
  // ─────────────────────────────────────────────────────────────────

  async saveCurrentPage() {
    const btn = document.getElementById('saveCurrentBtn');
    const btnText = btn.querySelector('span');
    const original = btnText.textContent;
    btnText.textContent = 'Saving…';
    btn.disabled = true;

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      let pageData = { title: tab.title, description: '', tags: [], wordCount: 0 };

      try {
        const data = await chrome.tabs.sendMessage(tab.id, { action: 'getPageData' });
        if (data) pageData = data;
      } catch {
        // content script unavailable — use basic tab info
      }

      const bookmark = new Bookmark(
        tab.url,
        pageData.title || tab.title,
        pageData.description || '',
        pageData.tags || [],
        Date.now(),
        pageData.wordCount || 0
      );

      const result = await this.addBookmark(bookmark);
      btnText.textContent = result.duplicate ? 'Already saved' : 'Saved!';
      setTimeout(() => { btnText.textContent = original; btn.disabled = false; }, 2000);
    } catch (err) {
      console.error('Save error', err);
      btnText.textContent = 'Error';
      setTimeout(() => { btnText.textContent = original; btn.disabled = false; }, 2000);
    }
  }

  async addBookmark(bookmark) {
    const isDuplicate = this.bookmarks.some((b) => b.url === bookmark.url);
    if (isDuplicate) {
      this.showNotification('Already saved', 'warning');
      return { added: false, duplicate: true };
    }
    this.bookmarks.unshift(bookmark);
    await this.saveBookmarks();
    this.render();
    return { added: true, duplicate: false };
  }

  async removeBookmark(id) {
    this.bookmarks = this.bookmarks.filter((b) => b.id !== id);
    this._deleteConfirmId = null;
    this._deleteConfirmTimer = null;
    await this.saveBookmarks();
    this.render();
  }

  // ─────────────────────────────────────────────────────────────────
  //  Storage
  // ─────────────────────────────────────────────────────────────────

  async loadBookmarks() {
    try {
      const result = await chrome.storage.local.get(['bookmarks', 'lastSync']);
      this.bookmarks = result.bookmarks || [];
      if (result.lastSync) this.lastSync = result.lastSync;
    } catch {
      this.bookmarks = [];
    }
  }

  async saveBookmarks() {
    try {
      await chrome.storage.local.set({ bookmarks: this.bookmarks });
    } catch (e) {
      console.error('saveBookmarks error', e);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  //  Render
  // ─────────────────────────────────────────────────────────────────

  render() {
    this.renderThemeIcon();
    document.getElementById('bookmarkCount').textContent = this.bookmarks.length;
    this.renderSyncStatus();
    this.renderTags();
    this.renderList();
  }

  renderSyncStatus() {
    const dot = document.getElementById('syncDot');
    const label = document.getElementById('syncLabel');
    if (this.lastSync) {
      dot.className = 'rf-sync-dot';
      const diff = Math.round((Date.now() - new Date(this.lastSync).getTime()) / 60000);
      label.textContent = diff < 1 ? 'Synced just now' : `Synced · ${diff} min ago`;
    } else {
      dot.className = 'rf-sync-dot error';
      label.textContent = 'Not synced';
    }
  }

  renderTags() {
    const row = document.getElementById('tagsRow');
    row.innerHTML = '';

    // Count tag frequency
    const freq = {};
    this.bookmarks.forEach((b) => {
      (b.tags || []).forEach((t) => { freq[t] = (freq[t] || 0) + 1; });
    });

    const sortedTags = Object.keys(freq).sort((a, b) => freq[b] - freq[a]);
    if (sortedTags.length === 0) return;

    const allBtn = document.createElement('button');
    allBtn.className = 'rf-chip' + (this.activeTag === null ? ' active' : '');
    allBtn.textContent = 'All';
    allBtn.addEventListener('click', () => {
      this.activeTag = null;
      this.renderTags();
      this.renderList();
    });
    row.appendChild(allBtn);

    sortedTags.forEach((tag) => {
      const btn = document.createElement('button');
      btn.className = 'rf-chip' + (this.activeTag === tag ? ' active' : '');
      btn.textContent = tag;
      btn.addEventListener('click', () => {
        this.activeTag = this.activeTag === tag ? null : tag;
        this.renderTags();
        this.renderList();
      });
      row.appendChild(btn);
    });
  }

  renderList() {
    const listEl = document.getElementById('bookmarkList');
    listEl.innerHTML = '';

    const visible = this.bookmarks.filter((b) => {
      if (this.activeTag && !(b.tags || []).includes(this.activeTag)) return false;
      if (this.searchTerm) {
        const hay = `${b.title} ${b.description} ${b.url}`.toLowerCase();
        if (!hay.includes(this.searchTerm)) return false;
      }
      return true;
    });

    if (visible.length === 0) {
      listEl.appendChild(this.makeEmptyState());
      return;
    }

    visible.forEach((b) => listEl.appendChild(this.makeItem(b)));
  }

  makeEmptyState() {
    const el = document.createElement('div');
    el.className = 'rf-empty';
    const hasFilter = this.activeTag || this.searchTerm;
    el.innerHTML = `
      <div class="rf-empty-logomark"></div>
      <div class="rf-empty-title">${hasFilter ? 'No matches' : 'No bookmarks yet'}</div>
      <div class="rf-empty-sub">${hasFilter ? 'Try a different search or tag' : 'Press Save to add this page'}</div>
    `;
    return el;
  }

  makeItem(b) {
    const item = document.createElement('div');
    item.className = 'rf-item';

    // Favicon
    const favWrap = document.createElement('div');
    favWrap.className = 'rf-fav';
    const img = document.createElement('img');
    img.src = this.faviconUrl(b.url);
    img.alt = '';
    img.onerror = () => {
      favWrap.innerHTML = '';
      const letter = document.createElement('div');
      letter.className = 'rf-fav-letter';
      letter.style.background = this.letterColor(b.title || b.url);
      letter.textContent = (b.title || b.url || '?')[0].toUpperCase();
      favWrap.appendChild(letter);
    };
    favWrap.appendChild(img);

    // Body
    const body = document.createElement('div');
    body.className = 'rf-item-body';

    const titleEl = document.createElement('div');
    titleEl.className = 'rf-item-title';
    titleEl.textContent = b.title || b.url;

    const meta = document.createElement('div');
    meta.className = 'rf-item-meta';
    let domain = '';
    try { domain = new URL(b.url).hostname; } catch { domain = b.url; }
    const rt = this.readingTime(b.wordCount);
    meta.innerHTML = `<span>${this.escapeHtml(domain)}</span>${rt ? `<span class="rf-dot">·</span><span>${rt}</span>` : ''}`;

    body.appendChild(titleEl);
    body.appendChild(meta);

    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.className = 'rf-item-remove';
    removeBtn.title = 'Remove';
    removeBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this._deleteConfirmId === b.id) {
        clearTimeout(this._deleteConfirmTimer);
        this.removeBookmark(b.id);
      } else {
        // First click: show confirm state
        if (this._deleteConfirmId) {
          // Reset previous confirm
          this._resetDeleteConfirm();
        }
        this._deleteConfirmId = b.id;
        removeBtn.classList.add('confirm');
        removeBtn.textContent = 'Confirm?';
        this._deleteConfirmTimer = setTimeout(() => {
          this._resetDeleteConfirm();
          // Re-render item back to normal
          if (removeBtn.isConnected) {
            removeBtn.classList.remove('confirm');
            removeBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
          }
        }, 2000);
      }
    });

    // Click row → open
    item.addEventListener('click', () => this.openBookmark(b.url));

    item.appendChild(favWrap);
    item.appendChild(body);
    item.appendChild(removeBtn);
    return item;
  }

  _resetDeleteConfirm() {
    clearTimeout(this._deleteConfirmTimer);
    this._deleteConfirmId = null;
    this._deleteConfirmTimer = null;
  }

  async openBookmark(url) {
    try {
      await chrome.tabs.create({ url });
    } catch (e) {
      console.error(e);
    }
  }

  escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
  }

  // ─────────────────────────────────────────────────────────────────
  //  Quick sync button (header)
  // ─────────────────────────────────────────────────────────────────

  async quickSync() {
    const dot = document.getElementById('syncDot');
    dot.className = 'rf-sync-dot syncing';
    try {
      if (this.currentSyncProvider === 'github' && this.isGitHubConnected) {
        await this.fullSync();
      } else if (this.currentSyncProvider === 'localfile' && this.hasLocalFile) {
        await this.fullSyncLocalFile();
      } else if (this.currentSyncProvider === 'googledrive' && this.isGoogleDriveConnected) {
        await this.fullSyncDrive();
      } else {
        this.showNotification('No sync provider connected', 'warning');
      }
    } finally {
      this.renderSyncStatus();
    }
  }

  // ─────────────────────────────────────────────────────────────────
  //  Notifications
  // ─────────────────────────────────────────────────────────────────

  showNotification(message, type = 'info') {
    const el = document.createElement('div');
    el.className = 'rf-notification';
    const colors = {
      success: 'oklch(0.52 0.14 145)',
      error: 'oklch(0.52 0.18 25)',
      warning: 'oklch(0.62 0.12 80)',
      info: 'oklch(0.52 0.12 240)',
    };
    el.style.background = colors[type] || colors.info;
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => {
      if (el.parentNode) {
        el.style.animation = 'slideOut 0.25s ease forwards';
        setTimeout(() => el.parentNode && el.parentNode.removeChild(el), 280);
      }
    }, 3000);
  }

  // ─────────────────────────────────────────────────────────────────
  //  Sync provider switching
  // ─────────────────────────────────────────────────────────────────

  async switchSyncProvider(provider) {
    this.currentSyncProvider = provider;
    await chrome.storage.local.set({ currentSyncProvider: provider });
    document.querySelectorAll('.provider-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.provider === provider);
    });
    this.renderSyncTab();
  }

  renderSyncTab() {
    document.getElementById('githubSection').style.display = this.currentSyncProvider === 'github' ? 'flex' : 'none';
    document.getElementById('localFileSection').style.display = this.currentSyncProvider === 'localfile' ? 'flex' : 'none';
    document.getElementById('googleDriveSection').style.display = this.currentSyncProvider === 'googledrive' ? 'flex' : 'none';

    document.querySelectorAll('.provider-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.provider === this.currentSyncProvider);
    });

    if (this.currentSyncProvider === 'github') this._renderGitHubSection();
    else if (this.currentSyncProvider === 'localfile') this._renderLocalFileSection();
    else if (this.currentSyncProvider === 'googledrive') this._renderGoogleDriveSection();
  }

  _renderGitHubSection() {
    const connectionIcon = document.getElementById('connectionIcon');
    const connectionText = document.getElementById('connectionText');
    const connectBtn = document.getElementById('connectGitHubBtn');
    const disconnectBtn = document.getElementById('disconnectGitHubBtn');
    const syncActions = document.getElementById('syncActions');
    const syncInfo = document.getElementById('syncInfo');
    const repoSelection = document.getElementById('repoSelection');

    if (this.isGitHubConnected) {
      connectionIcon.textContent = '🟢';
      connectionText.textContent = 'Connected to GitHub';
      connectBtn.style.display = 'none';
      disconnectBtn.style.display = 'block';
      syncInfo.style.display = 'block';
      repoSelection.style.display = 'block';

      if (this.githubService && this.githubService.username) {
        document.getElementById('githubUsername').textContent = this.githubService.username;
        document.getElementById('githubRepo').textContent = `${this.githubService.username}/${this.githubService.repoName}`;
      }
      if (this.lastSync) {
        document.getElementById('lastSyncTime').textContent = new Date(this.lastSync).toLocaleString();
      }
      this.updateRepositoryStatus();
    } else {
      connectionIcon.textContent = '🔴';
      connectionText.textContent = 'Disconnected';
      connectBtn.style.display = 'block';
      disconnectBtn.style.display = 'none';
      syncActions.style.display = 'none';
      syncInfo.style.display = 'none';
      repoSelection.style.display = 'none';
    }
  }

  async _renderLocalFileSection() {
    const icon = document.getElementById('localFileIcon');
    const text = document.getElementById('localFileText');
    const pickActions = document.getElementById('localFilePickActions');
    const syncActions = document.getElementById('localFileSyncActions');
    const clearBtn = document.getElementById('clearLocalFileBtn');

    if (this.hasLocalFile) {
      const name = await this.localFileService.getStoredFileName();
      icon.textContent = '📄';
      text.textContent = name || 'File selected';
      pickActions.style.display = 'none';
      syncActions.style.display = 'block';
      clearBtn.style.display = 'block';
    } else {
      icon.textContent = '📄';
      text.textContent = 'No file selected';
      pickActions.style.display = 'flex';
      syncActions.style.display = 'none';
      clearBtn.style.display = 'none';
    }
  }

  async _renderGoogleDriveSection() {
    const icon = document.getElementById('driveConnectionIcon');
    const text = document.getElementById('driveConnectionText');
    const connectBtn = document.getElementById('connectDriveBtn');
    const disconnectBtn = document.getElementById('disconnectDriveBtn');
    const filePickActions = document.getElementById('driveFilePickActions');
    const syncActions = document.getElementById('driveSyncActions');
    const clearBtn = document.getElementById('clearDriveFileBtn');

    if (this.isGoogleDriveConnected) {
      icon.textContent = '🟢';
      text.textContent = 'Connected to Google Drive';
      connectBtn.style.display = 'none';
      disconnectBtn.style.display = 'block';

      const fileId = await this.googleDriveService.getStoredFileId();
      filePickActions.style.display = fileId ? 'none' : 'flex';
      syncActions.style.display = fileId ? 'block' : 'none';
      clearBtn.style.display = fileId ? 'block' : 'none';
    } else {
      icon.textContent = '🔴';
      text.textContent = 'Disconnected';
      connectBtn.style.display = 'block';
      disconnectBtn.style.display = 'none';
      filePickActions.style.display = 'none';
      syncActions.style.display = 'none';
      clearBtn.style.display = 'none';
    }
  }

  // ─────────────────────────────────────────────────────────────────
  //  GitHub sync
  // ─────────────────────────────────────────────────────────────────

  async checkGitHubConnection() {
    try {
      const hasToken = await this.githubAuth.hasStoredToken();
      if (hasToken) {
        const token = await this.githubAuth.getStoredToken();
        const result = await this.githubService.setToken(token);
        if (result.success) this.isGitHubConnected = true;
      }
    } catch (e) {
      this.isGitHubConnected = false;
    }
  }

  async connectToGitHub() {
    try {
      const result = await this.githubAuth.authenticate();
      if (result.success) {
        await this.githubAuth.saveToken(result.token);
        const tokenResult = await this.githubService.setToken(result.token);
        if (tokenResult.success) {
          this.isGitHubConnected = true;
          this.showNotification('Connected to GitHub', 'success');
          this._renderGitHubSection();
          return { success: true };
        }
      }
      throw new Error(result.error || 'Authentication error');
    } catch (err) {
      this.showNotification('GitHub error: ' + err.message, 'error');
      return { success: false, error: err.message };
    }
  }

  async disconnectFromGitHub() {
    await this.githubAuth.logout();
    this.isGitHubConnected = false;
    this.githubService = new GitHubService();
    this.showNotification('Disconnected from GitHub', 'info');
    this._renderGitHubSection();
  }

  async syncFromGitHub(silent = false) {
    if (!this.isGitHubConnected) {
      this.showNotification('Not connected to GitHub', 'warning');
      return { success: false };
    }
    try {
      if (!silent) this.showNotification('Syncing from GitHub…', 'info');
      const result = await this.githubService.syncFromGitHub();
      if (result.success) {
        this.bookmarks = this.mergeBookmarks(this.bookmarks, result.bookmarks);
        this.lastSync = result.lastSync;
        await this.saveBookmarks();
        await chrome.storage.local.set({ lastSync: this.lastSync });
        if (!silent) this.showNotification('Synced from GitHub', 'success');
        this.render();
        return { success: true };
      }
      throw new Error(result.error);
    } catch (err) {
      if (!silent) this.showNotification('Sync error: ' + err.message, 'error');
      return { success: false, error: err.message };
    }
  }

  async syncToGitHub(silent = false) {
    if (!this.isGitHubConnected) {
      this.showNotification('Not connected to GitHub', 'warning');
      return { success: false };
    }
    try {
      if (!silent) this.showNotification('Syncing to GitHub…', 'info');
      const result = await this.githubService.syncToGitHub(this.bookmarks);
      if (result.success) {
        this.lastSync = result.lastSync;
        await chrome.storage.local.set({ lastSync: this.lastSync });
        if (!silent) this.showNotification('Synced to GitHub', 'success');
        this.renderSyncStatus();
        return { success: true };
      }
      throw new Error(result.error);
    } catch (err) {
      if (!silent) this.showNotification('Sync error: ' + err.message, 'error');
      return { success: false, error: err.message };
    }
  }

  async fullSync() {
    if (!this.isGitHubConnected) {
      this.showNotification('Not connected to GitHub', 'warning');
      return { success: false };
    }
    this.showNotification('Full sync…', 'info');
    const from = await this.syncFromGitHub(true);
    if (!from.success) return from;
    const to = await this.syncToGitHub(true);
    if (!to.success) return to;
    this.showNotification('Sync complete', 'success');
    this.renderSyncStatus();
    return { success: true };
  }

  mergeBookmarks(local, remote) {
    const merged = [...local];
    const localUrls = new Set(local.map((b) => b.url));
    remote.forEach((r) => { if (!localUrls.has(r.url)) merged.push(r); });
    return merged.sort((a, b) => b.timestamp - a.timestamp);
  }

  // ─────────────────────────────────────────────────────────────────
  //  Repository management
  // ─────────────────────────────────────────────────────────────────

  async checkRepositoryStatus() {
    try {
      this.repositoryStatus = await this.githubService.checkRepositoryStatus();
    } catch {
      this.repositoryStatus = { success: false, status: 'error', message: 'Error checking repository' };
    }
  }

  updateRepositoryStatus() {
    const repoStatus = document.getElementById('repoStatus');
    const syncActions = document.getElementById('syncActions');
    if (!this.repositoryStatus) { repoStatus.textContent = 'Checking repository…'; syncActions.style.display = 'none'; return; }
    if (this.repositoryStatus.success) {
      switch (this.repositoryStatus.status) {
        case 'ready':
          repoStatus.textContent = 'Repository ready';
          repoStatus.className = 'repo-status ready';
          syncActions.style.display = 'block';
          break;
        case 'no_bookmarks_file':
          repoStatus.textContent = 'No bookmarks file in repo';
          repoStatus.className = 'repo-status no-bookmarks';
          syncActions.style.display = 'block';
          break;
        default:
          repoStatus.textContent = this.repositoryStatus.message;
          repoStatus.className = 'repo-status';
          syncActions.style.display = 'none';
      }
    } else {
      repoStatus.textContent = this.repositoryStatus.message;
      repoStatus.className = 'repo-status not-found';
      syncActions.style.display = 'none';
    }
  }

  async showRepositoryList() {
    try {
      this.showNotification('Loading repositories…', 'info');
      const result = await this.githubService.listUserRepositories();
      if (!result.success) throw new Error(result.error);
      this.availableRepositories = result.repositories;
      this.renderRepositoryList();
      document.getElementById('repoListModal').style.display = 'flex';
    } catch (err) {
      this.showNotification('Error: ' + err.message, 'error');
    }
  }

  renderRepositoryList() {
    const list = document.getElementById('repoList');
    list.innerHTML = '';
    this.availableRepositories.forEach((repo) => {
      const item = document.createElement('div');
      item.className = 'repo-item';
      item.innerHTML = `
        <div class="repo-item-info">
          <div class="repo-item-name">${this.escapeHtml(repo.name)}</div>
          <div class="repo-item-description">${this.escapeHtml(repo.description || 'No description')}</div>
          <div class="repo-item-meta">
            <span>${repo.private ? 'Private' : 'Public'}</span>
            <span>${new Date(repo.updatedAt).toLocaleDateString()}</span>
          </div>
        </div>
        <div class="repo-item-status">Select</div>
      `;
      item.addEventListener('click', () => this.selectRepository(repo.name));
      list.appendChild(item);
    });
  }

  async selectRepository(repoName) {
    try {
      this.showNotification('Checking repository…', 'info');
      const result = await this.githubService.setActiveRepository(repoName);
      if (!result.success) throw new Error(result.error);
      const check = await this.githubService.checkRepositoryForBookmarks(repoName);
      if (check.success && check.hasBookmarksFile) {
        await this.checkRepositoryStatus();
        this.hideRepositoryList();
        this.renderSyncTab();
        this.showNotification(`${repoName} ready`, 'success');
      } else {
        this.showRepositorySetupOptions(repoName);
      }
    } catch (err) {
      this.showNotification('Error: ' + err.message, 'error');
    }
  }

  showRepositorySetupOptions(repoName) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content">
        <h3>Set up ${this.escapeHtml(repoName)}</h3>
        <p style="font-size:13px;color:var(--ink-3);margin-bottom:16px">No bookmarks file found. What do you want to do?</p>
        <div style="display:flex;flex-direction:column;gap:8px">
          <button id="_useLocal" class="action-button primary">Use local bookmarks (${this.bookmarks.length})</button>
          <button id="_createEmpty" class="action-button secondary">Create empty file</button>
          <button id="_importOther" class="action-button secondary">Import from another repo</button>
          <button id="_cancelSetup" class="action-button secondary">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('#_useLocal').addEventListener('click', () => { this.setupRepositoryWithFile(repoName, 'use_local'); modal.remove(); });
    modal.querySelector('#_createEmpty').addEventListener('click', () => { this.setupRepositoryWithFile(repoName, 'empty'); modal.remove(); });
    modal.querySelector('#_importOther').addEventListener('click', () => { this.searchOtherRepositories(repoName); modal.remove(); });
    modal.querySelector('#_cancelSetup').addEventListener('click', () => modal.remove());
  }

  async setupRepositoryWithFile(repoName, option) {
    try {
      this.showNotification('Setting up repository…', 'info');
      const books = option === 'use_local' ? this.bookmarks : [];
      const result = await this.githubService.createBookmarksFileInRepository(books);
      if (!result.success) throw new Error(result.error);
      await this.checkRepositoryStatus();
      this.hideRepositoryList();
      this.renderSyncTab();
      this.showNotification(`${repoName} set up`, 'success');
    } catch (err) {
      this.showNotification('Error: ' + err.message, 'error');
    }
  }

  async searchOtherRepositories(currentRepoName) {
    try {
      this.showNotification('Searching other repos…', 'info');
      const result = await this.githubService.listUserRepositories();
      if (!result.success) throw new Error(result.error);
      const others = result.repositories.filter((r) => r.name !== currentRepoName);
      const withBooks = [];
      for (const repo of others) {
        const check = await this.githubService.checkRepositoryForBookmarks(repo.name);
        if (check.success && check.hasBookmarksFile) withBooks.push(repo);
      }
      if (withBooks.length === 0) { this.showNotification('No bookmarks found in other repos', 'info'); return; }
      this.showRepositoryImportModal(withBooks, currentRepoName);
    } catch (err) {
      this.showNotification('Error: ' + err.message, 'error');
    }
  }

  showRepositoryImportModal(repos, targetRepo) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content">
        <h3>Import bookmarks</h3>
        <p style="font-size:13px;color:var(--ink-3);margin-bottom:12px">Found ${repos.length} repo(s) with bookmarks. Select one to import into <strong>${this.escapeHtml(targetRepo)}</strong>.</p>
        <div id="_importList" class="repo-list"></div>
        <div class="modal-actions"><button id="_cancelImport" class="action-button secondary">Cancel</button></div>
      </div>
    `;
    document.body.appendChild(modal);
    const list = modal.querySelector('#_importList');
    repos.forEach((repo) => {
      const item = document.createElement('div');
      item.className = 'repo-item';
      item.innerHTML = `<div class="repo-item-info"><div class="repo-item-name">${this.escapeHtml(repo.name)}</div></div><div class="repo-item-status">Import</div>`;
      item.addEventListener('click', () => { this.importFromRepository(repo.name, targetRepo); modal.remove(); });
      list.appendChild(item);
    });
    modal.querySelector('#_cancelImport').addEventListener('click', () => modal.remove());
  }

  async importFromRepository(sourceRepo, targetRepo) {
    try {
      this.showNotification('Importing bookmarks…', 'info');
      const originalRepo = this.githubService.repoName;
      let sourceResult;
      try {
        this.githubService.repoName = sourceRepo;
        sourceResult = await this.githubService.syncFromGitHub();
        if (!sourceResult.success) throw new Error('Error reading source repo');
        this.githubService.repoName = targetRepo;
        const createResult = await this.githubService.createBookmarksFileInRepository(sourceResult.bookmarks);
        if (!createResult.success) throw new Error('Error writing to target repo');
      } finally {
        this.githubService.repoName = originalRepo;
      }
      await this.checkRepositoryStatus();
      this.renderSyncTab();
      this.showNotification(`Imported to ${targetRepo}`, 'success');
    } catch (err) {
      this.showNotification('Import error: ' + err.message, 'error');
    }
  }

  hideRepositoryList() {
    document.getElementById('repoListModal').style.display = 'none';
  }

  async createNewRepository() {
    try {
      this.showNotification('Creating repository…', 'info');
      const result = await this.githubService.ensureRepository();
      if (!result.success) throw new Error(result.error);
      await this.checkRepositoryStatus();
      this.renderSyncTab();
      this.showNotification('Repository created', 'success');
    } catch (err) {
      this.showNotification('Error: ' + err.message, 'error');
    }
  }

  // ─────────────────────────────────────────────────────────────────
  //  Local File sync
  // ─────────────────────────────────────────────────────────────────

  async syncLocalFilePickFile() {
    const result = await this.localFileService.pickFile();
    if (result.success) {
      this.hasLocalFile = true;
      this.showNotification('File: ' + result.name, 'success');
      this._renderLocalFileSection();
    } else if (result.error !== 'Cancelado') {
      this.showNotification('Error: ' + result.error, 'error');
    }
  }

  async syncLocalFileCreate() {
    const result = await this.localFileService.createFile();
    if (result.success) {
      this.hasLocalFile = true;
      this.showNotification('Created: ' + result.name, 'success');
      this._renderLocalFileSection();
    } else if (result.error !== 'Cancelado') {
      this.showNotification('Error: ' + result.error, 'error');
    }
  }

  async syncLocalFileFrom(silent = false) {
    try {
      if (!silent) this.showNotification('Importing from file…', 'info');
      const result = await this.localFileService.syncFromFile();
      if (result.success) {
        this.bookmarks = this.mergeBookmarks(this.bookmarks, result.bookmarks);
        await this.saveBookmarks();
        if (!silent) this.showNotification('Imported from file', 'success');
        this.render();
        return { success: true };
      }
      throw new Error(result.error);
    } catch (err) {
      if (!silent) this.showNotification('Import error: ' + err.message, 'error');
      return { success: false, error: err.message };
    }
  }

  async syncLocalFileTo(silent = false) {
    try {
      if (!silent) this.showNotification('Exporting to file…', 'info');
      const result = await this.localFileService.syncToFile(this.bookmarks);
      if (result.success) {
        if (!silent) this.showNotification('Exported to file', 'success');
        return { success: true };
      }
      throw new Error(result.error);
    } catch (err) {
      if (!silent) this.showNotification('Export error: ' + err.message, 'error');
      return { success: false, error: err.message };
    }
  }

  async fullSyncLocalFile() {
    this.showNotification('Syncing file…', 'info');
    const from = await this.syncLocalFileFrom(true);
    if (!from.success) { this.showNotification('Sync error: ' + from.error, 'error'); return from; }
    const to = await this.syncLocalFileTo(true);
    if (!to.success) { this.showNotification('Sync error: ' + to.error, 'error'); return to; }
    this.showNotification('Sync complete', 'success');
    return { success: true };
  }

  async clearLocalFile() {
    await this.localFileService.clearStoredFile();
    this.hasLocalFile = false;
    this._renderLocalFileSection();
    this.showNotification('File unlinked', 'info');
  }

  // ─────────────────────────────────────────────────────────────────
  //  Google Drive sync
  // ─────────────────────────────────────────────────────────────────

  async connectToGoogleDrive() {
    const result = await this.googleDriveAuth.authenticate();
    if (result.success) {
      this.googleDriveToken = result.token;
      this.isGoogleDriveConnected = true;
      this.showNotification('Connected to Google Drive', 'success');
      this._renderGoogleDriveSection();
    } else {
      if (result.error && result.error.toLowerCase().includes('oauth2')) {
        document.getElementById('driveSetupWarning').style.display = 'block';
      }
      this.showNotification('Drive error: ' + result.error, 'error');
    }
  }

  async disconnectFromGoogleDrive() {
    await this.googleDriveAuth.logout(this.googleDriveToken);
    this.googleDriveToken = null;
    this.isGoogleDriveConnected = false;
    await this.googleDriveService.clearFileId();
    this.showNotification('Disconnected from Drive', 'info');
    this._renderGoogleDriveSection();
  }

  async createDriveFile() {
    if (!this.googleDriveToken) return;
    this.showNotification('Creating Drive file…', 'info');
    const result = await this.googleDriveService.createFile(this.bookmarks, this.googleDriveToken);
    if (result.success) { this.showNotification('Drive file created', 'success'); this._renderGoogleDriveSection(); }
    else this.showNotification('Error: ' + result.error, 'error');
  }

  async selectDriveFile() {
    if (!this.googleDriveToken) return;
    this.showNotification('Searching Drive…', 'info');
    const result = await this.googleDriveService.findExistingFile(this.googleDriveToken);
    if (result.success && result.fileId) {
      await this.googleDriveService.saveFileId(result.fileId);
      this.showNotification('Drive file linked', 'success');
      this._renderGoogleDriveSection();
    } else if (result.success) {
      this.showNotification('bookmarks.json not found in Drive', 'info');
    } else {
      this.showNotification('Error: ' + result.error, 'error');
    }
  }

  async clearDriveFile() {
    await this.googleDriveService.clearFileId();
    this._renderGoogleDriveSection();
    this.showNotification('Drive file unlinked', 'info');
  }

  async syncDriveFrom(silent = false) {
    if (!this.googleDriveToken) { this.showNotification('Not connected to Drive', 'warning'); return { success: false }; }
    try {
      if (!silent) this.showNotification('Importing from Drive…', 'info');
      const result = await this.googleDriveService.syncFromDrive(this.googleDriveToken);
      if (result.success) {
        this.bookmarks = this.mergeBookmarks(this.bookmarks, result.bookmarks);
        await this.saveBookmarks();
        if (!silent) this.showNotification('Imported from Drive', 'success');
        this.render();
        return { success: true };
      }
      throw new Error(result.error);
    } catch (err) {
      if (!silent) this.showNotification('Error: ' + err.message, 'error');
      return { success: false, error: err.message };
    }
  }

  async syncDriveTo(silent = false) {
    if (!this.googleDriveToken) { this.showNotification('Not connected to Drive', 'warning'); return { success: false }; }
    try {
      if (!silent) this.showNotification('Exporting to Drive…', 'info');
      const result = await this.googleDriveService.syncToDrive(this.bookmarks, this.googleDriveToken);
      if (result.success) {
        if (!silent) this.showNotification('Exported to Drive', 'success');
        return { success: true };
      }
      throw new Error(result.error);
    } catch (err) {
      if (!silent) this.showNotification('Error: ' + err.message, 'error');
      return { success: false, error: err.message };
    }
  }

  async fullSyncDrive() {
    this.showNotification('Syncing Drive…', 'info');
    const from = await this.syncDriveFrom(true);
    if (!from.success) { this.showNotification('Sync error: ' + from.error, 'error'); return from; }
    const to = await this.syncDriveTo(true);
    if (!to.success) { this.showNotification('Sync error: ' + to.error, 'error'); return to; }
    this.showNotification('Sync complete', 'success');
    return { success: true };
  }
}

document.addEventListener('DOMContentLoaded', () => { new BookmarksApp(); });
