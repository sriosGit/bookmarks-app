// Bookmark data structure
class Bookmark {
    constructor(url, title, description = '', tags = [], timestamp = Date.now()) {
        this.id = this.generateId();
        this.url = url;
        this.title = title;
        this.description = description;
        this.tags = tags;
        this.timestamp = timestamp;
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
}

// Main App Class
class BookmarksApp {
    constructor() {
        this.bookmarks = [];
        this.filteredBookmarks = [];
        this.activeTags = new Set();
        this.searchTerm = '';
        this.currentTab = 'bookmarks';
        
        this.init();
    }

    async init() {
        await this.loadBookmarks();
        this.setupEventListeners();
        this.render();
    }

    setupEventListeners() {
        // Save current page button
        document.getElementById('saveCurrent').addEventListener('click', () => {
            this.saveCurrentPage();
        });

        // Search input
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.searchTerm = e.target.value.toLowerCase();
            this.filterBookmarks();
            this.render();
        });

        // Tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}Tab`).classList.add('active');

        this.currentTab = tabName;
        
        // Reset search when switching to bookmarks tab
        if (tabName === 'bookmarks') {
            this.searchTerm = '';
            document.getElementById('searchInput').value = '';
        }
        
        // Show all bookmarks when entering tags tab
        if (tabName === 'tags') {
            this.activeTags.clear();
            this.filteredBookmarks = [...this.bookmarks];
        }
        
        this.render();
    }

    async saveCurrentPage() {
        try {
            const saveBtn = document.getElementById('saveCurrent');
            const originalText = saveBtn.textContent;
            saveBtn.textContent = '⏳ Guardando...';
            saveBtn.disabled = true;

            // Get current tab info
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            // Get page metadata from content script
            const pageData = await chrome.tabs.sendMessage(tab.id, { action: 'getPageData' });
            
            const bookmark = new Bookmark(
                tab.url,
                pageData.title || tab.title,
                pageData.description || '',
                pageData.tags || []
            );

            await this.addBookmark(bookmark);
            
            // Show success feedback
            saveBtn.textContent = '✅ Guardado!';
            setTimeout(() => {
                saveBtn.textContent = originalText;
                saveBtn.disabled = false;
            }, 2000);

        } catch (error) {
            console.error('Error saving bookmark:', error);
            const saveBtn = document.getElementById('saveCurrent');
            saveBtn.textContent = '❌ Error';
            setTimeout(() => {
                saveBtn.textContent = '💾 Guardar';
                saveBtn.disabled = false;
            }, 2000);
        }
    }

    async addBookmark(bookmark) {
        this.bookmarks.unshift(bookmark);
        await this.saveBookmarks();
        this.filterBookmarks();
        this.render();
    }

    async removeBookmark(bookmarkId) {
        this.bookmarks = this.bookmarks.filter(b => b.id !== bookmarkId);
        await this.saveBookmarks();
        this.filterBookmarks();
        this.render();
    }

    async loadBookmarks() {
        try {
            const result = await chrome.storage.local.get(['bookmarks']);
            this.bookmarks = result.bookmarks || [];
        } catch (error) {
            console.error('Error loading bookmarks:', error);
            this.bookmarks = [];
        }
    }

    async saveBookmarks() {
        try {
            await chrome.storage.local.set({ bookmarks: this.bookmarks });
        } catch (error) {
            console.error('Error saving bookmarks:', error);
        }
    }

    filterBookmarks() {
        this.filteredBookmarks = this.bookmarks.filter(bookmark => {
            // Search filter (only in bookmarks tab)
            const matchesSearch = this.currentTab !== 'bookmarks' || !this.searchTerm || 
                bookmark.title.toLowerCase().includes(this.searchTerm) ||
                bookmark.description.toLowerCase().includes(this.searchTerm) ||
                bookmark.url.toLowerCase().includes(this.searchTerm) ||
                bookmark.tags.some(tag => tag.toLowerCase().includes(this.searchTerm));

            // Tags filter (only in tags tab)
            const matchesTags = this.currentTab !== 'tags' || this.activeTags.size === 0 || 
                bookmark.tags.some(tag => this.activeTags.has(tag));

            return matchesSearch && matchesTags;
        });
    }

    render() {
        if (this.currentTab === 'bookmarks') {
            this.renderBookmarks();
            this.renderEmptyState();
        } else {
            this.renderTags();
            this.renderFilteredBookmarks();
            this.renderEmptyFilteredState();
        }
    }

    renderBookmarks() {
        const bookmarksList = document.getElementById('bookmarksList');
        bookmarksList.innerHTML = '';

        // Show all bookmarks or filtered by search
        const bookmarksToShow = this.searchTerm ? this.filteredBookmarks : this.bookmarks;
        
        bookmarksToShow.forEach(bookmark => {
            const bookmarkElement = this.createBookmarkElement(bookmark);
            bookmarksList.appendChild(bookmarkElement);
        });
    }

    renderFilteredBookmarks() {
        const filteredBookmarksList = document.getElementById('filteredBookmarksList');
        filteredBookmarksList.innerHTML = '';

        // In tags tab, show all bookmarks if no tags selected, otherwise show filtered
        const bookmarksToShow = this.activeTags.size === 0 ? this.bookmarks : this.filteredBookmarks;
        
        bookmarksToShow.forEach(bookmark => {
            const bookmarkElement = this.createBookmarkElement(bookmark);
            filteredBookmarksList.appendChild(bookmarkElement);
        });
    }

    createBookmarkElement(bookmark) {
        const div = document.createElement('div');
        div.className = 'bookmark-item';
        
        // Create the HTML structure without inline event handlers
        div.innerHTML = `
            <div class="bookmark-title">${this.escapeHtml(bookmark.title)}</div>
            <div class="bookmark-url">${this.escapeHtml(bookmark.url)}</div>
            ${bookmark.description ? `<div class="bookmark-description">${this.escapeHtml(bookmark.description)}</div>` : ''}
            ${bookmark.tags.length > 0 ? `
                <div class="bookmark-tags">
                    ${bookmark.tags.map(tag => `<span class="bookmark-tag">${this.escapeHtml(tag)}</span>`).join('')}
                </div>
            ` : ''}
            <div class="bookmark-actions">
                <button class="action-btn copy-btn" title="Copiar enlace">📋</button>
                <button class="action-btn open-btn" title="Abrir en nueva pestaña">🔗</button>
                <button class="action-btn delete-btn" title="Eliminar">🗑️</button>
            </div>
        `;

        // Add event listeners for action buttons
        const copyBtn = div.querySelector('.copy-btn');
        const openBtn = div.querySelector('.open-btn');
        const deleteBtn = div.querySelector('.delete-btn');

        copyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.copyToClipboard(bookmark.url, copyBtn);
        });

        openBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openBookmark(bookmark.url);
        });

        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeBookmark(bookmark.id);
        });

        // Add click handler to open bookmark (when clicking on the card)
        div.addEventListener('click', () => {
            this.openBookmark(bookmark.url);
        });

        return div;
    }

    async copyToClipboard(text, button) {
        try {
            // Try using the modern clipboard API
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
            } else {
                // Fallback for older browsers or non-secure contexts
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand('copy');
                textArea.remove();
            }

            // Show success feedback
            const originalText = button.textContent;
            button.textContent = '✅';
            button.style.background = '#d4edda';
            button.style.color = '#155724';
            
            setTimeout(() => {
                button.textContent = originalText;
                button.style.background = '';
                button.style.color = '';
            }, 1500);

        } catch (error) {
            console.error('Error copying to clipboard:', error);
            
            // Show error feedback
            const originalText = button.textContent;
            button.textContent = '❌';
            button.style.background = '#f8d7da';
            button.style.color = '#721c24';
            
            setTimeout(() => {
                button.textContent = originalText;
                button.style.background = '';
                button.style.color = '';
            }, 1500);
        }
    }

    renderTags() {
        const tagsList = document.getElementById('tagsList');
        const allTags = new Set();
        
        this.bookmarks.forEach(bookmark => {
            bookmark.tags.forEach(tag => allTags.add(tag));
        });

        tagsList.innerHTML = '';
        
        if (allTags.size > 0) {
            const allTagsBtn = document.createElement('span');
            allTagsBtn.className = `tag ${this.activeTags.size === 0 ? 'active' : ''}`;
            allTagsBtn.textContent = 'Todos';
            allTagsBtn.addEventListener('click', () => {
                this.activeTags.clear();
                this.filterBookmarks();
                this.render();
            });
            tagsList.appendChild(allTagsBtn);
        }

        Array.from(allTags).sort().forEach(tag => {
            const tagElement = document.createElement('span');
            tagElement.className = `tag ${this.activeTags.has(tag) ? 'active' : ''}`;
            tagElement.textContent = tag;
            tagElement.addEventListener('click', () => {
                if (this.activeTags.has(tag)) {
                    this.activeTags.delete(tag);
                } else {
                    this.activeTags.add(tag);
                }
                this.filterBookmarks();
                this.render();
            });
            tagsList.appendChild(tagElement);
        });
    }

    renderEmptyState() {
        const emptyState = document.getElementById('emptyState');
        const bookmarksList = document.getElementById('bookmarksList');
        const bookmarksToShow = this.searchTerm ? this.filteredBookmarks : this.bookmarks;
        
        if (bookmarksToShow.length === 0) {
            emptyState.style.display = 'block';
            bookmarksList.style.display = 'none';
        } else {
            emptyState.style.display = 'none';
            bookmarksList.style.display = 'block';
        }
    }

    renderEmptyFilteredState() {
        const emptyFilteredState = document.getElementById('emptyFilteredState');
        const filteredBookmarksList = document.getElementById('filteredBookmarksList');
        
        // In tags tab, show empty state only if tags are selected and no results
        const shouldShowEmpty = this.activeTags.size > 0 && this.filteredBookmarks.length === 0;
        
        if (shouldShowEmpty) {
            emptyFilteredState.style.display = 'block';
            filteredBookmarksList.style.display = 'none';
        } else {
            emptyFilteredState.style.display = 'none';
            filteredBookmarksList.style.display = 'block';
        }
    }

    async openBookmark(url) {
        try {
            await chrome.tabs.create({ url });
        } catch (error) {
            console.error('Error opening bookmark:', error);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize app when popup opens
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new BookmarksApp();
}); 