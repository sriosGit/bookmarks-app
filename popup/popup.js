// Bookmark data structure
class Bookmark {
  constructor(url, title, description = "", tags = [], timestamp = Date.now()) {
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
    this.searchTerm = "";
    this.currentTab = "bookmarks";

    // GitHub sync properties
    this.githubService = null;
    this.githubAuth = null;
    this.isGitHubConnected = false;
    this.lastSync = null;
    this.repositoryStatus = null;
    this.availableRepositories = [];

    this.init();
  }

  async init() {
    // Inicializar servicios de GitHub
    this.githubService = new GitHubService();
    this.githubAuth = new GitHubAuth();

    // Verificar conexión con GitHub
    await this.checkGitHubConnection();

    // Verificar estado del repositorio si está conectado
    if (this.isGitHubConnected) {
      await this.checkRepositoryStatus();
    }

    await this.loadBookmarks();
    this.setupEventListeners();
    this.render();
  }

  setupEventListeners() {
    // Save current page button
    document.getElementById("saveCurrent").addEventListener("click", () => {
      this.saveCurrentPage();
    });

    // Search input
    document.getElementById("searchInput").addEventListener("input", (e) => {
      this.searchTerm = e.target.value.toLowerCase();
      this.filterBookmarks();
      this.render();
    });

    // Tab buttons
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        this.switchTab(e.target.dataset.tab);
      });
    });

    // GitHub connection buttons
    document
      .getElementById("connectGitHubBtn")
      .addEventListener("click", () => {
        this.connectToGitHub();
      });

    document
      .getElementById("disconnectGitHubBtn")
      .addEventListener("click", () => {
        this.disconnectFromGitHub();
      });

    // GitHub sync buttons
    document.getElementById("syncFromGitHub").addEventListener("click", () => {
      this.syncFromGitHub();
    });

    document.getElementById("syncToGitHub").addEventListener("click", () => {
      this.syncToGitHub();
    });

    document.getElementById("fullSync").addEventListener("click", () => {
      this.fullSync();
    });

    // Repository selection buttons
    document.getElementById("selectRepo").addEventListener("click", () => {
      this.showRepositoryList();
    });

    document.getElementById("createRepo").addEventListener("click", () => {
      this.createNewRepository();
    });

    document
      .getElementById("cancelRepoSelection")
      .addEventListener("click", () => {
        this.hideRepositoryList();
      });
  }

  switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.classList.remove("active");
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add("active");

    // Update tab content
    document.querySelectorAll(".tab-content").forEach((content) => {
      content.classList.remove("active");
    });
    document.getElementById(`${tabName}Tab`).classList.add("active");

    this.currentTab = tabName;

    // Reset search when switching to bookmarks tab
    if (tabName === "bookmarks") {
      this.searchTerm = "";
      document.getElementById("searchInput").value = "";
    }

    // Show all bookmarks when entering tags tab
    if (tabName === "tags") {
      this.activeTags.clear();
      this.filteredBookmarks = [...this.bookmarks];
    }

    this.render();
  }

   async saveCurrentPage() {
     try {
       const saveBtn = document.getElementById("saveCurrent");
       const originalText = saveBtn.textContent;
       saveBtn.textContent = "⏳ Guardando...";
       saveBtn.disabled = true;

       // Get current tab info
       const [tab] = await chrome.tabs.query({
         active: true,
         currentWindow: true,
       });

       let pageData = { title: tab.title, description: "", tags: [] };

       // Try to get page metadata from content script
       try {
         const contentScriptData = await chrome.tabs.sendMessage(tab.id, {
           action: "getPageData",
         });
         if (contentScriptData) {
           pageData = contentScriptData;
         }
       } catch (contentScriptError) {
         console.log("Content script not available, using basic tab info");
         // Content script not available, use basic tab info
       }

       const bookmark = new Bookmark(
         tab.url,
         pageData.title || tab.title,
         pageData.description || "",
         pageData.tags || []
       );

       const result = await this.addBookmark(bookmark);

       // Show success or duplicate feedback
       saveBtn.textContent = result.duplicate ? "⚠️ Ya guardado" : "✅ Guardado!";
       setTimeout(() => {
         saveBtn.textContent = originalText;
         saveBtn.disabled = false;
       }, 2000);
     } catch (error) {
       console.error("Error saving bookmark:", error);
       const saveBtn = document.getElementById("saveCurrent");
       saveBtn.textContent = "❌ Error";
       setTimeout(() => {
         saveBtn.textContent = "💾 Guardar";
         saveBtn.disabled = false;
       }, 2000);
     }
   }

  async addBookmark(bookmark) {
    const isDuplicate = this.bookmarks.some((b) => b.url === bookmark.url);
    if (isDuplicate) {
      this.showNotification("⚠️ Esta página ya está guardada", "warning");
      return { added: false, duplicate: true };
    }
    this.bookmarks.unshift(bookmark);
    await this.saveBookmarks();
    this.filterBookmarks();
    this.render();
    return { added: true, duplicate: false };
  }

  async removeBookmark(bookmarkId) {
    this.bookmarks = this.bookmarks.filter((b) => b.id !== bookmarkId);
    await this.saveBookmarks();
    this.filterBookmarks();
    this.render();
  }

  async loadBookmarks() {
    try {
      const result = await chrome.storage.local.get(["bookmarks"]);
      this.bookmarks = result.bookmarks || [];
    } catch (error) {
      console.error("Error loading bookmarks:", error);
      this.bookmarks = [];
    }
  }

  async saveBookmarks() {
    try {
      await chrome.storage.local.set({ bookmarks: this.bookmarks });
    } catch (error) {
      console.error("Error saving bookmarks:", error);
    }
  }

  filterBookmarks() {
    this.filteredBookmarks = this.bookmarks.filter((bookmark) => {
      // Search filter (only in bookmarks tab)
      const matchesSearch =
        this.currentTab !== "bookmarks" ||
        !this.searchTerm ||
        bookmark.title.toLowerCase().includes(this.searchTerm) ||
        bookmark.description.toLowerCase().includes(this.searchTerm) ||
        bookmark.url.toLowerCase().includes(this.searchTerm) ||
        bookmark.tags.some((tag) =>
          tag.toLowerCase().includes(this.searchTerm)
        );

      // Tags filter (only in tags tab)
      const matchesTags =
        this.currentTab !== "tags" ||
        this.activeTags.size === 0 ||
        bookmark.tags.some((tag) => this.activeTags.has(tag));

      return matchesSearch && matchesTags;
    });
  }

  render() {
    if (this.currentTab === "bookmarks") {
      this.renderBookmarks();
      this.renderEmptyState();
    } else if (this.currentTab === "tags") {
      this.renderTags();
      this.renderFilteredBookmarks();
      this.renderEmptyFilteredState();
    } else if (this.currentTab === "sync") {
      this.renderSyncTab();
    }
  }

  renderBookmarks() {
    const bookmarksList = document.getElementById("bookmarksList");
    bookmarksList.innerHTML = "";

    // Show all bookmarks or filtered by search
    const bookmarksToShow = this.searchTerm
      ? this.filteredBookmarks
      : this.bookmarks;

    bookmarksToShow.forEach((bookmark) => {
      const bookmarkElement = this.createBookmarkElement(bookmark);
      bookmarksList.appendChild(bookmarkElement);
    });
  }

  renderFilteredBookmarks() {
    const filteredBookmarksList = document.getElementById(
      "filteredBookmarksList"
    );
    filteredBookmarksList.innerHTML = "";

    // In tags tab, show all bookmarks if no tags selected, otherwise show filtered
    const bookmarksToShow =
      this.activeTags.size === 0 ? this.bookmarks : this.filteredBookmarks;

    bookmarksToShow.forEach((bookmark) => {
      const bookmarkElement = this.createBookmarkElement(bookmark);
      filteredBookmarksList.appendChild(bookmarkElement);
    });
  }

  createBookmarkElement(bookmark) {
    const div = document.createElement("div");
    div.className = "bookmark-item";

    // Create the HTML structure without inline event handlers
    div.innerHTML = `
            <div class="bookmark-title">${this.escapeHtml(bookmark.title)}</div>
            <div class="bookmark-url">${this.escapeHtml(bookmark.url)}</div>
            ${
              bookmark.description
                ? `<div class="bookmark-description">${this.escapeHtml(
                    bookmark.description
                  )}</div>`
                : ""
            }
            ${
              bookmark.tags.length > 0
                ? `
                <div class="bookmark-tags">
                    ${bookmark.tags
                      .map(
                        (tag) =>
                          `<span class="bookmark-tag">${this.escapeHtml(
                            tag
                          )}</span>`
                      )
                      .join("")}
                </div>
            `
                : ""
            }
            <div class="bookmark-actions">
                <button class="action-btn copy-btn" title="Copiar enlace">📋</button>
                <button class="action-btn open-btn" title="Abrir en nueva pestaña">🔗</button>
                <button class="action-btn delete-btn" title="Eliminar">🗑️</button>
            </div>
        `;

    // Add event listeners for action buttons
    const copyBtn = div.querySelector(".copy-btn");
    const openBtn = div.querySelector(".open-btn");
    const deleteBtn = div.querySelector(".delete-btn");

    copyBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.copyToClipboard(bookmark.url, copyBtn);
    });

    openBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.openBookmark(bookmark.url);
    });

    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.removeBookmark(bookmark.id);
    });

    // Add click handler to open bookmark (when clicking on the card)
    div.addEventListener("click", () => {
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
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        textArea.remove();
      }

      // Show success feedback
      const originalText = button.textContent;
      button.textContent = "✅";
      button.style.background = "#d4edda";
      button.style.color = "#155724";

      setTimeout(() => {
        button.textContent = originalText;
        button.style.background = "";
        button.style.color = "";
      }, 1500);
    } catch (error) {
      console.error("Error copying to clipboard:", error);

      // Show error feedback
      const originalText = button.textContent;
      button.textContent = "❌";
      button.style.background = "#f8d7da";
      button.style.color = "#721c24";

      setTimeout(() => {
        button.textContent = originalText;
        button.style.background = "";
        button.style.color = "";
      }, 1500);
    }
  }

  renderTags() {
    const tagsList = document.getElementById("tagsList");
    const allTags = new Set();

    this.bookmarks.forEach((bookmark) => {
      bookmark.tags.forEach((tag) => allTags.add(tag));
    });

    tagsList.innerHTML = "";

    if (allTags.size > 0) {
      const allTagsBtn = document.createElement("span");
      allTagsBtn.className = `tag ${
        this.activeTags.size === 0 ? "active" : ""
      }`;
      allTagsBtn.textContent = "Todos";
      allTagsBtn.addEventListener("click", () => {
        this.activeTags.clear();
        this.filterBookmarks();
        this.render();
      });
      tagsList.appendChild(allTagsBtn);
    }

    Array.from(allTags)
      .sort()
      .forEach((tag) => {
        const tagElement = document.createElement("span");
        tagElement.className = `tag ${
          this.activeTags.has(tag) ? "active" : ""
        }`;
        tagElement.textContent = tag;
        tagElement.addEventListener("click", () => {
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
    const emptyState = document.getElementById("emptyState");
    const bookmarksList = document.getElementById("bookmarksList");
    const bookmarksToShow = this.searchTerm
      ? this.filteredBookmarks
      : this.bookmarks;

    if (bookmarksToShow.length === 0) {
      emptyState.style.display = "block";
      bookmarksList.style.display = "none";
    } else {
      emptyState.style.display = "none";
      bookmarksList.style.display = "block";
    }
  }

  renderEmptyFilteredState() {
    const emptyFilteredState = document.getElementById("emptyFilteredState");
    const filteredBookmarksList = document.getElementById(
      "filteredBookmarksList"
    );

    // In tags tab, show empty state only if tags are selected and no results
    const shouldShowEmpty =
      this.activeTags.size > 0 && this.filteredBookmarks.length === 0;

    if (shouldShowEmpty) {
      emptyFilteredState.style.display = "block";
      filteredBookmarksList.style.display = "none";
    } else {
      emptyFilteredState.style.display = "none";
      filteredBookmarksList.style.display = "block";
    }
  }

  async openBookmark(url) {
    try {
      await chrome.tabs.create({ url });
    } catch (error) {
      console.error("Error opening bookmark:", error);
    }
  }

  renderSyncTab() {
    // Actualizar estado de conexión
    const connectionIcon = document.getElementById("connectionIcon");
    const connectionText = document.getElementById("connectionText");
    const connectBtn = document.getElementById("connectGitHubBtn");
    const disconnectBtn = document.getElementById("disconnectGitHubBtn");
    const syncActions = document.getElementById("syncActions");
    const syncInfo = document.getElementById("syncInfo");
    const repoSelection = document.getElementById("repoSelection");

    if (this.isGitHubConnected) {
      connectionIcon.textContent = "🟢";
      connectionText.textContent = "Conectado a GitHub";
      connectBtn.style.display = "none";
      disconnectBtn.style.display = "block";
      syncInfo.style.display = "block";
      repoSelection.style.display = "block";

      // Actualizar información de sincronización
      if (this.githubService && this.githubService.username) {
        document.getElementById("githubUsername").textContent =
          this.githubService.username;
        document.getElementById(
          "githubRepo"
        ).textContent = `${this.githubService.username}/${this.githubService.repoName}`;
      }

      if (this.lastSync) {
        const syncDate = new Date(this.lastSync);
        document.getElementById("lastSyncTime").textContent =
          syncDate.toLocaleString();
      }

      // Mostrar/ocultar opciones de sincronización basado en el estado del repositorio
      this.updateRepositoryStatus();
    } else {
      connectionIcon.textContent = "🔴";
      connectionText.textContent = "Desconectado";
      connectBtn.style.display = "block";
      disconnectBtn.style.display = "none";
      syncActions.style.display = "none";
      syncInfo.style.display = "none";
      repoSelection.style.display = "none";
    }
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // ===== MÉTODOS DE GITHUB SYNC =====

  // Verificar conexión con GitHub
  async checkGitHubConnection() {
    try {
      const hasToken = await this.githubAuth.hasStoredToken();
      if (hasToken) {
        const token = await this.githubAuth.getStoredToken();
        const result = await this.githubService.setToken(token);
        if (result.success) {
          this.isGitHubConnected = true;
          console.log("Conectado a GitHub:", result.user.login);
        }
      }
    } catch (error) {
      console.error("Error verificando conexión GitHub:", error);
      this.isGitHubConnected = false;
    }
  }

  // Conectar con GitHub
  async connectToGitHub() {
    try {
      const result = await this.githubAuth.authenticate();
      if (result.success) {
        await this.githubAuth.saveToken(result.token);
        const tokenResult = await this.githubService.setToken(result.token);
        if (tokenResult.success) {
          this.isGitHubConnected = true;
          this.showNotification(
            "✅ Conectado a GitHub exitosamente",
            "success"
          );
          this.render(); // Actualizar UI
          return { success: true };
        }
      }
      throw new Error(result.error || "Error en autenticación");
    } catch (error) {
      console.error("Error conectando a GitHub:", error);
      this.showNotification(
        "❌ Error conectando a GitHub: " + error.message,
        "error"
      );
      return { success: false, error: error.message };
    }
  }

  // Desconectar de GitHub
  async disconnectFromGitHub() {
    try {
      await this.githubAuth.logout();
      this.isGitHubConnected = false;
      this.githubService = new GitHubService(); // Reset service
      this.showNotification("🔌 Desconectado de GitHub", "info");
      this.render(); // Actualizar UI
      return { success: true };
    } catch (error) {
      console.error("Error desconectando de GitHub:", error);
      return { success: false, error: error.message };
    }
  }

  // Sincronizar desde GitHub
  async syncFromGitHub(silent = false) {
    if (!this.isGitHubConnected) {
      this.showNotification("⚠️ No estás conectado a GitHub", "warning");
      return { success: false, error: "No conectado a GitHub" };
    }

    try {
      if (!silent) this.showNotification("🔄 Sincronizando desde GitHub...", "info");

      const result = await this.githubService.syncFromGitHub();
      if (result.success) {
        // Fusionar favoritos (evitar duplicados)
        const mergedBookmarks = this.mergeBookmarks(
          this.bookmarks,
          result.bookmarks
        );
        this.bookmarks = mergedBookmarks;
        await this.saveBookmarks();
        this.lastSync = result.lastSync;

        if (!silent) this.showNotification("✅ Sincronizado desde GitHub", "success");
        this.render();
        return { success: true, bookmarks: mergedBookmarks };
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Error sincronizando desde GitHub:", error);
      if (!silent) this.showNotification(
        "❌ Error sincronizando: " + error.message,
        "error"
      );
      return { success: false, error: error.message };
    }
  }

  // Sincronizar a GitHub
  async syncToGitHub(silent = false) {
    if (!this.isGitHubConnected) {
      this.showNotification("⚠️ No estás conectado a GitHub", "warning");
      return { success: false, error: "No conectado a GitHub" };
    }

    try {
      if (!silent) this.showNotification("🔄 Sincronizando a GitHub...", "info");

      const result = await this.githubService.syncToGitHub(this.bookmarks);
      if (result.success) {
        this.lastSync = result.lastSync;
        if (!silent) this.showNotification("✅ Sincronizado a GitHub", "success");
        return { success: true };
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Error sincronizando a GitHub:", error);
      if (!silent) this.showNotification(
        "❌ Error sincronizando: " + error.message,
        "error"
      );
      return { success: false, error: error.message };
    }
  }

  // Sincronización bidireccional
  async fullSync() {
    if (!this.isGitHubConnected) {
      this.showNotification("⚠️ No estás conectado a GitHub", "warning");
      return { success: false, error: "No conectado a GitHub" };
    }

    try {
      this.showNotification("🔄 Sincronización completa...", "info");

      // Primero sincronizar desde GitHub
      const fromResult = await this.syncFromGitHub(true);
      if (!fromResult.success) {
        throw new Error("Error sincronizando desde GitHub");
      }

      // Luego sincronizar a GitHub
      const toResult = await this.syncToGitHub(true);
      if (!toResult.success) {
        throw new Error("Error sincronizando a GitHub");
      }

      this.showNotification("✅ Sincronización completa exitosa", "success");
      return { success: true };
    } catch (error) {
      console.error("Error en sincronización completa:", error);
      this.showNotification(
        "❌ Error en sincronización: " + error.message,
        "error"
      );
      return { success: false, error: error.message };
    }
  }

  // Fusionar favoritos evitando duplicados
  mergeBookmarks(localBookmarks, remoteBookmarks) {
    const merged = [...localBookmarks];
    const localUrls = new Set(localBookmarks.map((b) => b.url));

    remoteBookmarks.forEach((remoteBookmark) => {
      if (!localUrls.has(remoteBookmark.url)) {
        merged.push(remoteBookmark);
      }
    });

    // Ordenar por timestamp
    return merged.sort((a, b) => b.timestamp - a.timestamp);
  }

  // Mostrar notificación
  showNotification(message, type = "info") {
    // Crear elemento de notificación
    const notification = document.createElement("div");
    notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 8px;
            color: white;
            font-size: 14px;
            font-weight: 500;
            z-index: 10000;
            max-width: 300px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            animation: slideIn 0.3s ease;
        `;

    // Colores según tipo
    const colors = {
      success: "#28a745",
      error: "#dc3545",
      warning: "#ffc107",
      info: "#17a2b8",
    };
    notification.style.background = colors[type] || colors.info;

    notification.textContent = message;
    document.body.appendChild(notification);

    // Remover después de 3 segundos
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.animation = "slideOut 0.3s ease";
        setTimeout(() => {
          if (notification.parentNode) {
            document.body.removeChild(notification);
          }
        }, 300);
      }
    }, 3000);
  }

  // ===== MÉTODOS DE GESTIÓN DE REPOSITORIOS =====

  // Verificar estado del repositorio
  async checkRepositoryStatus() {
    if (!this.isGitHubConnected || !this.githubService) {
      return;
    }

    try {
      this.repositoryStatus = await this.githubService.checkRepositoryStatus();
      console.log("Estado del repositorio:", this.repositoryStatus);
    } catch (error) {
      console.error("Error verificando estado del repositorio:", error);
      this.repositoryStatus = {
        success: false,
        status: "error",
        message: "Error verificando repositorio",
      };
    }
  }

  // Actualizar estado del repositorio en la UI
  updateRepositoryStatus() {
    const repoStatus = document.getElementById("repoStatus");
    const syncActions = document.getElementById("syncActions");

    if (!this.repositoryStatus) {
      repoStatus.textContent = "Verificando repositorio...";
      repoStatus.className = "repo-status";
      syncActions.style.display = "none";
      return;
    }

    if (this.repositoryStatus.success) {
      switch (this.repositoryStatus.status) {
        case "ready":
          repoStatus.textContent = "✅ Repositorio listo para sincronización";
          repoStatus.className = "repo-status ready";
          syncActions.style.display = "block";
          break;
        case "no_bookmarks_file":
          repoStatus.textContent = "⚠️ Repositorio sin archivo de favoritos";
          repoStatus.className = "repo-status no-bookmarks";
          syncActions.style.display = "block";
          break;
        default:
          repoStatus.textContent = this.repositoryStatus.message;
          repoStatus.className = "repo-status";
          syncActions.style.display = "none";
      }
    } else {
      repoStatus.textContent = `❌ ${this.repositoryStatus.message}`;
      repoStatus.className = "repo-status not-found";
      syncActions.style.display = "none";
    }
  }

  // Mostrar lista de repositorios
  async showRepositoryList() {
    try {
      this.showNotification("🔄 Cargando repositorios...", "info");

      const result = await this.githubService.listUserRepositories();
      if (!result.success) {
        throw new Error(result.error);
      }

      this.availableRepositories = result.repositories;

      // No verificar archivos aquí - solo mostrar la lista
      this.renderRepositoryList();
      document.getElementById("repoListModal").style.display = "flex";
    } catch (error) {
      console.error("Error cargando repositorios:", error);
      this.showNotification(
        "❌ Error cargando repositorios: " + error.message,
        "error"
      );
    }
  }

  // Renderizar lista de repositorios
  renderRepositoryList() {
    const repoList = document.getElementById("repoList");
    repoList.innerHTML = "";

    this.availableRepositories.forEach((repo) => {
      const repoItem = document.createElement("div");
      repoItem.className = "repo-item";
      repoItem.dataset.repoName = repo.name;

      repoItem.innerHTML = `
                <div class="repo-item-info">
                    <div class="repo-item-name">${this.escapeHtml(
                      repo.name
                    )}</div>
                    <div class="repo-item-description">${this.escapeHtml(
                      repo.description || "Sin descripción"
                    )}</div>
                    <div class="repo-item-meta">
                        <span>${
                          repo.private ? "🔒 Privado" : "🌐 Público"
                        }</span>
                        <span>📅 ${new Date(
                          repo.updatedAt
                        ).toLocaleDateString()}</span>
                    </div>
                </div>
                <div class="repo-item-status">Seleccionar</div>
            `;

      repoItem.addEventListener("click", () => {
        this.selectRepository(repo.name);
      });

      repoList.appendChild(repoItem);
    });
  }

  // Seleccionar repositorio
  async selectRepository(repoName) {
    try {
      this.showNotification("🔄 Verificando repositorio...", "info");

      // Cambiar repositorio activo
      const result = await this.githubService.setActiveRepository(repoName);
      if (!result.success) {
        throw new Error(result.error);
      }

      // Verificar si el repositorio tiene archivo de favoritos
      const bookmarksCheck =
        await this.githubService.checkRepositoryForBookmarks(repoName);

      if (bookmarksCheck.success && bookmarksCheck.hasBookmarksFile) {
        // Repositorio tiene archivo de favoritos - listo para usar
        await this.checkRepositoryStatus();
        this.hideRepositoryList();
        this.renderSyncTab();
        this.showNotification(
          `✅ Repositorio ${repoName} listo para sincronización`,
          "success"
        );
      } else {
        // No tiene archivo de favoritos - preguntar si crear
        this.showRepositorySetupOptions(repoName);
      }
    } catch (error) {
      console.error("Error seleccionando repositorio:", error);
      this.showNotification(
        "❌ Error verificando repositorio: " + error.message,
        "error"
      );
    }
  }

  // Mostrar opciones para repositorio sin archivo de favoritos
  showRepositorySetupOptions(repoName) {
    const modal = document.createElement("div");
    modal.className = "modal-overlay";
    modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;

    modal.innerHTML = `
            <div style="
                background: white;
                padding: 30px;
                border-radius: 12px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                max-width: 500px;
                width: 90%;
            ">
                <h3 style="margin-bottom: 20px; color: #333;">📁 Configurar Repositorio</h3>
                <p style="margin-bottom: 20px; color: #666;">
                    El repositorio <strong>${this.escapeHtml(
                      repoName
                    )}</strong> no tiene archivo de favoritos.
                    ¿Qué quieres hacer?
                </p>
                
                <div style="display: flex; flex-direction: column; gap: 15px; margin-bottom: 20px;">
                    <button id="useExistingBookmarks" style="
                        padding: 15px 20px;
                        background: #28a745;
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 500;
                    ">
                        📥 Usar favoritos locales (${
                          this.bookmarks.length
                        } favoritos)
                    </button>
                    
                    <button id="createBookmarksFile" style="
                        padding: 15px 20px;
                        background: #667eea;
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 500;
                    ">
                        ➕ Crear archivo vacío
                    </button>
                    
                    <button id="importFromGitHub" style="
                        padding: 15px 20px;
                        background: #17a2b8;
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 500;
                    ">
                        🔄 Buscar en otros repositorios
                    </button>
                </div>
                
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button id="cancelSetup" style="
                        padding: 10px 20px;
                        border: 1px solid #ddd;
                        background: white;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                    ">Cancelar</button>
                </div>
            </div>
        `;

    document.body.appendChild(modal);

    // Event listeners
    document
      .getElementById("useExistingBookmarks")
      .addEventListener("click", () => {
        this.setupRepositoryWithFile(repoName, "use_local");
        document.body.removeChild(modal);
      });

    document
      .getElementById("createBookmarksFile")
      .addEventListener("click", () => {
        this.setupRepositoryWithFile(repoName, "empty");
        document.body.removeChild(modal);
      });

    document
      .getElementById("importFromGitHub")
      .addEventListener("click", () => {
        this.searchOtherRepositories(repoName);
        document.body.removeChild(modal);
      });

    document.getElementById("cancelSetup").addEventListener("click", () => {
      document.body.removeChild(modal);
    });
  }

  // Configurar repositorio con archivo de favoritos
  async setupRepositoryWithFile(repoName, option) {
    try {
      this.showNotification("🔄 Configurando repositorio...", "info");

      let bookmarksToUpload = [];

      if (option === "use_local") {
        bookmarksToUpload = this.bookmarks;
      } else if (option === "empty") {
        bookmarksToUpload = [];
      } else {
        // create - crear archivo vacío
        bookmarksToUpload = [];
      }

      // Crear archivo de favoritos en el repositorio
      const result = await this.githubService.createBookmarksFileInRepository(
        bookmarksToUpload
      );
      if (!result.success) {
        throw new Error(result.error);
      }

      // Verificar estado del repositorio
      await this.checkRepositoryStatus();
      this.hideRepositoryList();
      this.renderSyncTab();

      this.showNotification(
        `✅ Repositorio ${repoName} configurado exitosamente`,
        "success"
      );
    } catch (error) {
      console.error("Error configurando repositorio:", error);
      this.showNotification(
        "❌ Error configurando repositorio: " + error.message,
        "error"
      );
    }
  }

  // Buscar favoritos en otros repositorios
  async searchOtherRepositories(currentRepoName) {
    try {
      this.showNotification(
        "🔄 Buscando favoritos en otros repositorios...",
        "info"
      );

      // Obtener lista de repositorios
      const result = await this.githubService.listUserRepositories();
      if (!result.success) {
        throw new Error(result.error);
      }

      // Filtrar repositorios que no sean el actual
      const otherRepos = result.repositories.filter(
        (repo) => repo.name !== currentRepoName
      );

      // Buscar repositorios que tengan archivo de favoritos
      const reposWithBookmarks = [];

      for (let repo of otherRepos) {
        const checkResult =
          await this.githubService.checkRepositoryForBookmarks(repo.name);
        if (checkResult.success && checkResult.hasBookmarksFile) {
          reposWithBookmarks.push(repo);
        }
      }

      if (reposWithBookmarks.length === 0) {
        this.showNotification(
          "ℹ️ No se encontraron favoritos en otros repositorios",
          "info"
        );
        return;
      }

      // Mostrar modal de selección de repositorio con favoritos
      this.showRepositoryImportModal(reposWithBookmarks, currentRepoName);
    } catch (error) {
      console.error("Error buscando en otros repositorios:", error);
      this.showNotification(
        "❌ Error buscando favoritos: " + error.message,
        "error"
      );
    }
  }

  // Mostrar modal para importar desde otro repositorio
  showRepositoryImportModal(reposWithBookmarks, targetRepoName) {
    const modal = document.createElement("div");
    modal.className = "modal-overlay";
    modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;

    modal.innerHTML = `
            <div style="
                background: white;
                padding: 30px;
                border-radius: 12px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                max-width: 600px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
            ">
                <h3 style="margin-bottom: 20px; color: #333;">🔄 Importar Favoritos</h3>
                <p style="margin-bottom: 20px; color: #666;">
                    Se encontraron ${
                      reposWithBookmarks.length
                    } repositorio(s) con favoritos. 
                    Selecciona uno para importar a <strong>${this.escapeHtml(
                      targetRepoName
                    )}</strong>:
                </p>
                
                <div id="importRepoList" style="max-height: 400px; overflow-y: auto;">
                    <!-- Repositorios se cargarán aquí -->
                </div>
                
                <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
                    <button id="cancelImport" style="
                        padding: 10px 20px;
                        border: 1px solid #ddd;
                        background: white;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                    ">Cancelar</button>
                </div>
            </div>
        `;

    document.body.appendChild(modal);

    // Renderizar lista de repositorios con favoritos
    const repoList = document.getElementById("importRepoList");
    reposWithBookmarks.forEach((repo) => {
      const repoItem = document.createElement("div");
      repoItem.className = "repo-item";
      repoItem.style.cssText = `
                display: flex;
                align-items: center;
                padding: 12px;
                border: 1px solid #e9ecef;
                border-radius: 8px;
                margin-bottom: 8px;
                cursor: pointer;
                transition: all 0.3s ease;
            `;

      repoItem.innerHTML = `
                <div style="flex: 1;">
                    <div style="font-weight: 600; color: #333; margin-bottom: 4px;">${this.escapeHtml(
                      repo.name
                    )}</div>
                    <div style="font-size: 12px; color: #666; margin-bottom: 4px;">${this.escapeHtml(
                      repo.description || "Sin descripción"
                    )}</div>
                    <div style="font-size: 11px; color: #999; display: flex; gap: 10px;">
                        <span>${
                          repo.private ? "🔒 Privado" : "🌐 Público"
                        }</span>
                        <span>📅 ${new Date(
                          repo.updatedAt
                        ).toLocaleDateString()}</span>
                    </div>
                </div>
                <div style="margin-left: 10px; padding: 4px 8px; background: #d4edda; color: #155724; border-radius: 4px; font-size: 10px; font-weight: 500;">
                    Tiene favoritos
                </div>
            `;

      repoItem.addEventListener("click", () => {
        this.importFromRepository(repo.name, targetRepoName);
        document.body.removeChild(modal);
      });

      repoList.appendChild(repoItem);
    });

    // Event listeners
    document.getElementById("cancelImport").addEventListener("click", () => {
      document.body.removeChild(modal);
    });
  }

  // Importar favoritos desde otro repositorio
  async importFromRepository(sourceRepoName, targetRepoName) {
    try {
      this.showNotification("🔄 Importando favoritos...", "info");

      // Cambiar temporalmente al repositorio fuente
      const originalRepo = this.githubService.repoName;
      let sourceResult;
      try {
        this.githubService.repoName = sourceRepoName;

        // Obtener favoritos del repositorio fuente
        sourceResult = await this.githubService.syncFromGitHub();
        if (!sourceResult.success) {
          throw new Error("Error obteniendo favoritos del repositorio fuente");
        }

        // Cambiar al repositorio destino y crear archivo de favoritos
        this.githubService.repoName = targetRepoName;
        const createResult =
          await this.githubService.createBookmarksFileInRepository(
            sourceResult.bookmarks
          );
        if (!createResult.success) {
          throw new Error("Error creando archivo en repositorio destino");
        }
      } finally {
        this.githubService.repoName = originalRepo;
      }

      // Verificar estado del repositorio destino
      await this.checkRepositoryStatus();
      this.renderSyncTab();

      this.showNotification(
        `✅ Favoritos importados exitosamente a ${targetRepoName}`,
        "success"
      );
    } catch (error) {
      console.error("Error importando favoritos:", error);
      this.showNotification(
        "❌ Error importando favoritos: " + error.message,
        "error"
      );
    }
  }

  // Ocultar lista de repositorios
  hideRepositoryList() {
    document.getElementById("repoListModal").style.display = "none";
  }

  // Crear nuevo repositorio
  async createNewRepository() {
    try {
      this.showNotification("🔄 Creando nuevo repositorio...", "info");

      const result = await this.githubService.ensureRepository();
      if (!result.success) {
        throw new Error(result.error);
      }

      // Verificar estado del nuevo repositorio
      await this.checkRepositoryStatus();
      this.renderSyncTab();

      this.showNotification(
        "✅ Nuevo repositorio creado exitosamente",
        "success"
      );
    } catch (error) {
      console.error("Error creando repositorio:", error);
      this.showNotification(
        "❌ Error creando repositorio: " + error.message,
        "error"
      );
    }
  }
}

// Initialize app when popup opens
let app;
document.addEventListener("DOMContentLoaded", () => {
  app = new BookmarksApp();
});
