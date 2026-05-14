// Google Drive Sync Service — Drive REST API v3, drive.file scope
class GoogleDriveService {
  constructor() {
    this.FILE_NAME  = 'bookmarks.json';
    this.MIME       = 'application/json';
    this.UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
    this.FILES_URL  = 'https://www.googleapis.com/drive/v3/files';
    this.BOUNDARY   = 'BookmarksApp_boundary_1234';
  }

  // ── chrome.storage helpers ─────────────────────────────────────────────────

  async getStoredFileId() {
    const result = await chrome.storage.local.get(['googleDriveFileId']);
    return result.googleDriveFileId || null;
  }

  async saveFileId(id) {
    await chrome.storage.local.set({ googleDriveFileId: id });
  }

  async clearFileId() {
    await chrome.storage.local.remove(['googleDriveFileId']);
  }

  // ── Multipart body builder ─────────────────────────────────────────────────

  _buildMultipartBody(metadata, content) {
    const b = this.BOUNDARY;
    return [
      `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
      JSON.stringify(metadata),
      `\r\n--${b}\r\nContent-Type: ${this.MIME}\r\n\r\n`,
      content,
      `\r\n--${b}--`
    ].join('');
  }

  // ── Drive REST methods ─────────────────────────────────────────────────────

  async createFile(bookmarks, token) {
    try {
      const content  = JSON.stringify(bookmarks, null, 2);
      const body     = this._buildMultipartBody({ name: this.FILE_NAME, mimeType: this.MIME }, content);
      const response = await fetch(`${this.UPLOAD_URL}?uploadType=multipart`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary="${this.BOUNDARY}"`,
        },
        body
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { success: false, error: err.error?.message || `HTTP ${response.status}` };
      }
      const data = await response.json();
      await this.saveFileId(data.id);
      return { success: true, fileId: data.id };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async updateFile(fileId, bookmarks, token) {
    try {
      const content  = JSON.stringify(bookmarks, null, 2);
      const body     = this._buildMultipartBody({ name: this.FILE_NAME, mimeType: this.MIME }, content);
      const response = await fetch(`${this.UPLOAD_URL}/${encodeURIComponent(fileId)}?uploadType=multipart`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary="${this.BOUNDARY}"`,
        },
        body
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { success: false, error: err.error?.message || `HTTP ${response.status}` };
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async readFile(fileId, token) {
    try {
      const response = await fetch(`${this.FILES_URL}/${encodeURIComponent(fileId)}?alt=media`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        if (response.status === 404) return { success: false, error: 'NOT_FOUND' };
        const err = await response.json().catch(() => ({}));
        return { success: false, error: err.error?.message || `HTTP ${response.status}` };
      }
      const bookmarks = await response.json();
      return { success: true, bookmarks };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // Find an existing bookmarks.json owned by this app in Drive (drive.file scope only sees its own files)
  async findExistingFile(token) {
    try {
      const q        = encodeURIComponent(`name='${this.FILE_NAME}' and mimeType='${this.MIME}' and trashed=false`);
      const response = await fetch(`${this.FILES_URL}?q=${q}&spaces=drive&fields=files(id,name)`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) return { success: false, error: `HTTP ${response.status}` };
      const data  = await response.json();
      const files = data.files || [];
      return { success: true, fileId: files.length > 0 ? files[0].id : null };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // ── High-level sync ────────────────────────────────────────────────────────

  async syncFromDrive(token) {
    try {
      const fileId = await this.getStoredFileId();
      if (!fileId) return { success: false, error: 'No hay archivo de Drive seleccionado' };
      const result = await this.readFile(fileId, token);
      if (!result.success) {
        if (result.error === 'NOT_FOUND') {
          await this.clearFileId();
          return { success: false, error: 'El archivo ya no existe en Drive. Selecciona o crea uno nuevo.' };
        }
        return result;
      }
      return { success: true, bookmarks: result.bookmarks, lastSync: new Date().toISOString() };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async syncToDrive(bookmarks, token) {
    try {
      const fileId = await this.getStoredFileId();
      const result = fileId
        ? await this.updateFile(fileId, bookmarks, token)
        : await this.createFile(bookmarks, token);
      if (!result.success) return result;
      return { success: true, lastSync: new Date().toISOString() };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GoogleDriveService;
} else {
  window.GoogleDriveService = GoogleDriveService;
}
