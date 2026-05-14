# Google Drive Sync — Setup Guide

Google Drive sync requires a Google Cloud Console project with an OAuth 2.0 client ID registered for this Chrome Extension. Without this, the "Conectar con Google" button will fail.

---

## Step 1 — Create a Google Cloud project

1. Go to https://console.cloud.google.com/
2. Click **Select a project** → **New Project**
3. Name it (e.g. "Bookmarks App") and click **Create**

---

## Step 2 — Enable the Google Drive API

1. With your project selected, go to **APIs & Services > Library**
2. Search for **Google Drive API** and click **Enable**

---

## Step 3 — Configure the OAuth consent screen

1. Go to **APIs & Services > OAuth consent screen**
2. Select **External** and click **Create**
3. Fill in:
   - **App name**: Bookmarks App
   - **User support email**: your email
   - **Developer contact email**: your email
4. Click **Save and Continue** through the remaining screens (no extra scopes needed here)
5. On the **Test users** screen, add your own Gmail address
6. Click **Save and Continue**

---

## Step 4 — Create an OAuth 2.0 client ID

1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > OAuth client ID**
3. Application type: **Chrome Extension**
4. **Item ID**: paste your extension's ID
   - Find it at `chrome://extensions` (enable Developer mode if needed)
   - Example: `abcdefghijklmnopabcdefghijklmnop`
5. Click **Create**
6. Copy the **Client ID** (looks like `123456789-abc...apps.googleusercontent.com`)

---

## Step 5 — Add the client ID to manifest.json

Open `manifest.json` and replace `YOUR_CLIENT_ID.apps.googleusercontent.com` with your real client ID:

```json
"oauth2": {
  "client_id": "123456789-abc...apps.googleusercontent.com",
  "scopes": ["https://www.googleapis.com/auth/drive.file"]
}
```

Reload the extension at `chrome://extensions` (click the refresh icon).

---

## What the `drive.file` scope means

- The extension can **only** read and write files it creates itself.
- It cannot access any other files in your Google Drive.
- The first time you click "Conectar con Google", a Google sign-in popup will appear.
- After that, Chrome caches the token and re-authenticates silently on each popup open.

---

## Revoking access

- Click **Desconectar** in the extension's Sync tab, or
- Visit https://myaccount.google.com/permissions and remove "Bookmarks App"

---

## Troubleshooting

**"OAuth2 not granted or revoked"** — The client_id in manifest.json is still the placeholder. Complete Step 5 above.

**"The caller does not have permission"** — The extension ID used in Step 4 doesn't match the loaded extension. Check `chrome://extensions` and update the OAuth client in the Cloud Console.

**"Access blocked: Bookmarks App has not completed the Google verification process"** — Your Gmail is not in the test users list. Add it in **APIs & Services > OAuth consent screen > Test users**.
