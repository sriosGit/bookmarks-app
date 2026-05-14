// Local File Sync Service — File System Access API + IndexedDB for handle persistence
class LocalFileService {
  constructor() {
    this.DB_NAME    = 'BookmarksAppDB';
    this.DB_VERSION = 1;
    this.STORE_NAME = 'fileHandles';
    this.HANDLE_KEY = 'localFileHandle';
  }

  // ── IndexedDB helpers ──────────────────────────────────────────────────────

  _openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.DB_NAME, this.DB_VERSION);
      req.onupgradeneeded = e => e.target.result.createObjectStore(this.STORE_NAME);
      req.onsuccess = e => resolve(e.target.result);
      req.onerror   = () => reject(req.error);
    });
  }

  async _getHandle() {
    const db = await this._openDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(this.STORE_NAME, 'readonly');
      const req = tx.objectStore(this.STORE_NAME).get(this.HANDLE_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror   = () => reject(req.error);
    });
  }

  async _saveHandle(handle) {
    const db = await this._openDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(this.STORE_NAME, 'readwrite');
      const req = tx.objectStore(this.STORE_NAME).put(handle, this.HANDLE_KEY);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  }

  async _deleteHandle() {
    const db = await this._openDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(this.STORE_NAME, 'readwrite');
      const req = tx.objectStore(this.STORE_NAME).delete(this.HANDLE_KEY);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  }

  // ── Permission helpers ─────────────────────────────────────────────────────

  async _verifyPermission(handle) {
    const perm = await handle.queryPermission({ mode: 'readwrite' });
    if (perm === 'granted') return true;
    const requested = await handle.requestPermission({ mode: 'readwrite' });
    return requested === 'granted';
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async hasStoredFile() {
    const handle = await this._getHandle();
    return handle !== null;
  }

  async getStoredFileName() {
    try {
      const result = await chrome.storage.local.get(['localFileName']);
      return result.localFileName || null;
    } catch { return null; }
  }

  async _persistFileName(name) {
    await chrome.storage.local.set({ localFileName: name });
  }

  // Must be called directly from a button click — File System Access API requires a user gesture
  async pickFile() {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: 'JSON files', accept: { 'application/json': ['.json'] } }],
        multiple: false
      });
      await this._saveHandle(handle);
      await this._persistFileName(handle.name);
      return { success: true, name: handle.name };
    } catch (err) {
      if (err.name === 'AbortError') return { success: false, error: 'Cancelado' };
      return { success: false, error: err.message };
    }
  }

  // Must be called directly from a button click — File System Access API requires a user gesture
  async createFile() {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: 'bookmarks.json',
        types: [{ description: 'JSON files', accept: { 'application/json': ['.json'] } }]
      });
      const writable = await handle.createWritable();
      await writable.write(JSON.stringify([], null, 2));
      await writable.close();
      await this._saveHandle(handle);
      await this._persistFileName(handle.name);
      return { success: true, name: handle.name };
    } catch (err) {
      if (err.name === 'AbortError') return { success: false, error: 'Cancelado' };
      return { success: false, error: err.message };
    }
  }

  async syncFromFile() {
    try {
      const handle = await this._getHandle();
      if (!handle) return { success: false, error: 'No hay archivo seleccionado' };
      const ok = await this._verifyPermission(handle);
      if (!ok) return { success: false, error: 'Permiso denegado al archivo' };
      const file      = await handle.getFile();
      const text      = await file.text();
      const bookmarks = JSON.parse(text);
      if (!Array.isArray(bookmarks)) return { success: false, error: 'El archivo no contiene un array válido' };
      return { success: true, bookmarks };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async syncToFile(bookmarks) {
    try {
      const handle = await this._getHandle();
      if (!handle) return { success: false, error: 'No hay archivo seleccionado' };
      const ok = await this._verifyPermission(handle);
      if (!ok) return { success: false, error: 'Permiso denegado al archivo' };
      const writable = await handle.createWritable();
      await writable.write(JSON.stringify(bookmarks, null, 2));
      await writable.close();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async clearStoredFile() {
    try {
      await this._deleteHandle();
      await chrome.storage.local.remove(['localFileName']);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = LocalFileService;
} else {
  window.LocalFileService = LocalFileService;
}
