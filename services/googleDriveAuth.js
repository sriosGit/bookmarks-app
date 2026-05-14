// Google Drive OAuth2 via chrome.identity
class GoogleDriveAuth {
  constructor() {
    this.SCOPE      = 'https://www.googleapis.com/auth/drive.file';
    this.REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
  }

  // Show Google OAuth consent screen interactively
  async authenticate() {
    return new Promise(resolve => {
      chrome.identity.getAuthToken({ interactive: true, scopes: [this.SCOPE] }, token => {
        if (chrome.runtime.lastError || !token) {
          resolve({ success: false, error: chrome.runtime.lastError?.message || 'No se obtuvo token' });
        } else {
          resolve({ success: true, token });
        }
      });
    });
  }

  // Return cached token without UI prompt; null if not cached
  async getToken() {
    return new Promise(resolve => {
      chrome.identity.getAuthToken({ interactive: false, scopes: [this.SCOPE] }, token => {
        if (chrome.runtime.lastError || !token) resolve(null);
        else resolve(token);
      });
    });
  }

  async revokeToken(token) {
    try {
      await new Promise(resolve => chrome.identity.removeCachedAuthToken({ token }, resolve));
      await fetch(`${this.REVOKE_URL}?token=${encodeURIComponent(token)}`);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async logout(token) {
    if (token) await this.revokeToken(token);
    return { success: true };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GoogleDriveAuth;
} else {
  window.GoogleDriveAuth = GoogleDriveAuth;
}
