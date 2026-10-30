import fs from 'fs';
import path from 'path';
import { useMultiFileAuthState, AuthenticationState } from '@whiskeysockets/baileys';

const BASE_SESSIONS_DIR = path.resolve(process.env.SESSIONS_DIR || './sessions');

// Ensure base sessions directory exists with restricted permissions
if (!fs.existsSync(BASE_SESSIONS_DIR)) {
  fs.mkdirSync(BASE_SESSIONS_DIR, { recursive: true, mode: 0o700 });
}

export interface SessionAuthResult {
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
  sessionFolder: string;
}

export const sessionStore = {
  /**
   * Initializes or loads multi-file auth state for a specific session ID.
   */
  async getAuthState(sessionId: string): Promise<SessionAuthResult> {
    // Sanitize session ID to prevent directory traversal
    const safeSessionId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const sessionFolder = path.join(BASE_SESSIONS_DIR, `session_${safeSessionId}`);

    if (!fs.existsSync(sessionFolder)) {
      fs.mkdirSync(sessionFolder, { recursive: true, mode: 0o700 });
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);

    return {
      state,
      saveCreds,
      sessionFolder,
    };
  },

  /**
   * Completely removes stored credentials and auth files for a session.
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    const safeSessionId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const sessionFolder = path.join(BASE_SESSIONS_DIR, `session_${safeSessionId}`);

    if (fs.existsSync(sessionFolder)) {
      try {
        fs.rmSync(sessionFolder, { recursive: true, force: true });
        return true;
      } catch (err) {
        console.error(`[SessionStore] Failed to remove session ${sessionId}:`, err);
        return false;
      }
    }
    return false;
  },

  /**
   * Checks if a session has existing saved credentials on disk.
   */
  hasSavedCredentials(sessionId: string): boolean {
    const safeSessionId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const credsPath = path.join(BASE_SESSIONS_DIR, `session_${safeSessionId}`, 'creds.json');
    return fs.existsSync(credsPath);
  },
};

