import {
  makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  WAMessage,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import { Boom } from '@hapi/boom';
import path from 'path';
import fs from 'fs';
import { sessionStore } from './session-store.js';
import { supabaseService, StoredMessageRecord } from './supabase.js';

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'qr_ready'
  | 'connected'
  | 'reconnecting'
  | 'failed';

export interface ActiveSession {
  sessionId: string;
  socket: ReturnType<typeof makeWASocket> | null;
  status: ConnectionStatus;
  qrCodeDataUrl: string | null;
  qrRaw: string | null;
  qrGeneratedAt: number | null;
  phoneNumber: string | null;
  pushName: string | null;
  platform: string | null;
  connectedAt: string | null;
  reconnectAttempts: number;
  lastError: string | null;
}

const logger = pino({ level: 'silent' });

export class BaileysManager {
  private sessions = new Map<string, ActiveSession>();
  private reconnectTimers = new Map<string, NodeJS.Timeout>();
  private messageBuffers = new Map<string, StoredMessageRecord[]>();
  private groupSubjectCache = new Map<string, string>();

  /**
   * Returns or registers an in-memory session handle.
   */
  getSession(sessionId: string): ActiveSession {
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = {
        sessionId,
        socket: null,
        status: 'disconnected',
        qrCodeDataUrl: null,
        qrRaw: null,
        qrGeneratedAt: null,
        phoneNumber: null,
        pushName: null,
        platform: null,
        connectedAt: null,
        reconnectAttempts: 0,
        lastError: null,
      };

      // Check if credentials already exist on disk to populate known phone number
      try {
        const credsPath = path.resolve(
          process.env.SESSIONS_DIR || './sessions',
          `session_${sessionId}`,
          'creds.json'
        );
        if (fs.existsSync(credsPath)) {
          const credsData = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
          if (credsData?.me?.id) {
            const rawPhone = (credsData.me.id.split(':')[0] || credsData.me.id.split('@')[0] || '').replace(/\D/g, '');
            if (rawPhone) session.phoneNumber = rawPhone;
            if (credsData.me.name) session.pushName = credsData.me.name;
            session.platform = 'WhatsApp Multi-Device';
          }
        }
      } catch {
        // Ignore read errors
      }

      this.sessions.set(sessionId, session);
    }
    return session;
  }

  /**
   * Adds a message to the in-memory rolling buffer (deduplicated by providerMessageId).
   */
  addMessageToMemory(sessionId: string, msg: StoredMessageRecord): void {
    const list = this.messageBuffers.get(sessionId) || [];
    if (!list.some((m) => m.providerMessageId === msg.providerMessageId)) {
      list.unshift(msg);
      if (list.length > 100) list.pop();
      this.messageBuffers.set(sessionId, list);
    }
  }

  /**
   * Retrieves messages from in-memory cache and/or Supabase database.
   */
  async getMessages(sessionId: string): Promise<StoredMessageRecord[]> {
    const memoryMsgs = this.messageBuffers.get(sessionId) || [];
    const dbMsgs = await supabaseService.getRecentMessages(sessionId, 50);

    // Merge and deduplicate by providerMessageId
    const map = new Map<string, StoredMessageRecord>();
    for (const m of memoryMsgs) map.set(m.providerMessageId, m);
    for (const m of dbMsgs) {
      if (!map.has(m.providerMessageId)) {
        map.set(m.providerMessageId, m);
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()
    );
  }

  /**
   * Starts or resumes connection for a given session.
   */
  async startSession(sessionId: string): Promise<ActiveSession> {
    const session = this.getSession(sessionId);

    // If already connected, return existing active session
    if (session.status === 'connected' && session.socket) {
      return session;
    }

    // Cancel any pending reconnect timers
    this.clearReconnectTimer(sessionId);

    session.status = 'connecting';
    session.lastError = null;

    try {
      const { state, saveCreds } = await sessionStore.getAuthState(sessionId);
      if (state.creds?.me?.id) {
        const rawPhone = (state.creds.me.id.split(':')[0] || state.creds.me.id.split('@')[0] || '').replace(/\D/g, '');
        if (rawPhone) session.phoneNumber = rawPhone;
        if (state.creds.me.name) session.pushName = state.creds.me.name;
        session.platform = 'WhatsApp Multi-Device';
      }
      const { version } = await fetchLatestBaileysVersion();

      const sock = makeWASocket({
        version,
        logger,
        printQRInTerminal: false,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        generateHighQualityLinkPreview: false,
        syncFullHistory: false,
        connectTimeoutMs: 60_000,
        keepAliveIntervalMs: 25_000,
      });

      session.socket = sock;

      // Handle credentials update
      sock.ev.on('creds.update', saveCreds);

      // Handle connection updates
      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // 1. QR Code generated
        if (qr) {
          try {
            session.qrRaw = qr;
            session.qrGeneratedAt = Date.now();
            session.qrCodeDataUrl = await QRCode.toDataURL(qr, {
              margin: 2,
              width: 300,
              color: {
                dark: '#000000',
                light: '#ffffff',
              },
            });
            session.status = 'qr_ready';
            console.log(`[BaileysManager] QR generated for session: ${sessionId}`);
          } catch (qrErr) {
            console.error('[BaileysManager] Failed to generate QR data URL:', qrErr);
          }
        }

        // 2. Connection Open (Successfully Paired)
        if (connection === 'open') {
          session.status = 'connected';
          session.qrCodeDataUrl = null;
          session.qrRaw = null;
          session.reconnectAttempts = 0;
          session.lastError = null;
          session.connectedAt = new Date().toISOString();

          const userJid = sock.user?.id || '';
          const rawPhone = userJid.split(':')[0] || userJid.split('@')[0] || '';
          session.phoneNumber = rawPhone;
          session.pushName = sock.user?.name || null;
          session.platform = 'WhatsApp Multi-Device';

          console.log(`[BaileysManager] Session ${sessionId} CONNECTED! Phone: ${rawPhone}`);

          // Sync to Supabase
          await supabaseService.syncSession(sessionId, {
            phoneNumber: rawPhone,
            status: 'connected',
            pairedAt: session.connectedAt,
            metadata: {
              pushName: session.pushName,
              platform: session.platform,
            },
          });
        }

        // 3. Connection Closed
        if (connection === 'close') {
          session.socket = null;
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          console.warn(
            `[BaileysManager] Session ${sessionId} connection closed. Code: ${statusCode}, shouldReconnect: ${shouldReconnect}`
          );

          if (statusCode === DisconnectReason.loggedOut) {
            session.status = 'disconnected';
            session.phoneNumber = null;
            session.qrCodeDataUrl = null;
            session.lastError = 'Logged out by device';
            await sessionStore.deleteSession(sessionId);
            await supabaseService.syncSession(sessionId, {
              status: 'disconnected',
              phoneNumber: null,
            });
          } else if (shouldReconnect) {
            session.status = 'connecting';
            this.scheduleReconnect(sessionId);
          } else {
            session.status = 'failed';
            session.lastError = `Connection failed with status: ${statusCode}`;
            await supabaseService.syncSession(sessionId, {
              status: 'failed',
            });
          }
        }
      });

      // Handle incoming & outgoing messages
      sock.ev.on('messages.upsert', async (m) => {
        if (!m.messages || m.messages.length === 0) return;

        for (const msg of m.messages) {
          try {
            // Ignore status broadcast updates
            if (msg.key.remoteJid === 'status@broadcast') continue;

            // Unwrap ephemeral, viewOnce, or edited containers
            let innerMsg: any = msg.message;
            if (innerMsg?.ephemeralMessage?.message) innerMsg = innerMsg.ephemeralMessage.message;
            if (innerMsg?.viewOnceMessage?.message) innerMsg = innerMsg.viewOnceMessage.message;
            if (innerMsg?.viewOnceMessageV2?.message) innerMsg = innerMsg.viewOnceMessageV2.message;
            if (innerMsg?.viewOnceMessageV2Extension?.message) innerMsg = innerMsg.viewOnceMessageV2Extension.message;
            if (innerMsg?.documentWithCaptionMessage?.message) innerMsg = innerMsg.documentWithCaptionMessage.message;
            if (innerMsg?.protocolMessage?.editedMessage) innerMsg = innerMsg.protocolMessage.editedMessage;

            if (!innerMsg) continue;

            // Extract content and media descriptions
            let bodyText = '';
            let messageType = 'text';

            if (innerMsg.conversation) {
              bodyText = innerMsg.conversation;
            } else if (innerMsg.extendedTextMessage?.text) {
              bodyText = innerMsg.extendedTextMessage.text;
            } else if (innerMsg.imageMessage) {
              messageType = 'image';
              const cap = innerMsg.imageMessage.caption;
              bodyText = cap ? `📷 [Photo]: ${cap}` : '📷 [Photo]';
            } else if (innerMsg.videoMessage) {
              messageType = 'video';
              const cap = innerMsg.videoMessage.caption;
              bodyText = cap ? `🎥 [Video]: ${cap}` : '🎥 [Video]';
            } else if (innerMsg.audioMessage) {
              messageType = 'audio';
              bodyText = innerMsg.audioMessage.ptt ? '🎙️ [Voice Note]' : '🎵 [Audio File]';
            } else if (innerMsg.stickerMessage) {
              messageType = 'sticker';
              bodyText = '🏷️ [Sticker]';
            } else if (innerMsg.documentMessage) {
              messageType = 'document';
              const fn = innerMsg.documentMessage.fileName || 'Document';
              const cap = innerMsg.documentMessage.caption;
              bodyText = cap ? `📄 [Document: ${fn}]: ${cap}` : `📄 [Document: ${fn}]`;
            } else if (innerMsg.contactMessage) {
              messageType = 'contact';
              bodyText = `👤 [Contact: ${innerMsg.contactMessage.displayName || 'Card'}]`;
            } else if (innerMsg.contactsArrayMessage) {
              messageType = 'contact';
              const names = (innerMsg.contactsArrayMessage.contacts || []).map((c: any) => c.displayName).filter(Boolean).join(', ');
              bodyText = `👥 [Contacts: ${names || 'Cards'}]`;
            } else if (innerMsg.locationMessage) {
              messageType = 'location';
              const loc = innerMsg.locationMessage.name || innerMsg.locationMessage.address || '';
              bodyText = loc ? `📍 [Location: ${loc}]` : '📍 [Pinned Location]';
            } else if (innerMsg.liveLocationMessage) {
              messageType = 'location';
              bodyText = '📍 [Live Location]';
            } else if (innerMsg.reactionMessage) {
              messageType = 'reaction';
              bodyText = `Reacted ${innerMsg.reactionMessage.text || '👍'}`;
            } else if (innerMsg.pollCreationMessage || innerMsg.pollCreationMessageV3) {
              messageType = 'poll';
              const pollName = innerMsg.pollCreationMessage?.name || innerMsg.pollCreationMessageV3?.name || 'Poll';
              bodyText = `📊 [Poll: ${pollName}]`;
            } else if (innerMsg.buttonsResponseMessage) {
              messageType = 'button_reply';
              bodyText = `🔘 [Button]: ${innerMsg.buttonsResponseMessage.selectedDisplayText || innerMsg.buttonsResponseMessage.selectedButtonId || 'Clicked'}`;
            } else if (innerMsg.templateButtonReplyMessage) {
              messageType = 'button_reply';
              bodyText = `🔘 [Button]: ${innerMsg.templateButtonReplyMessage.selectedDisplayText || 'Clicked'}`;
            } else if (innerMsg.listResponseMessage) {
              messageType = 'list_reply';
              bodyText = `📋 [Selection]: ${innerMsg.listResponseMessage.title || innerMsg.listResponseMessage.singleSelectReply?.selectedRowId || 'Selected'}`;
            } else if (innerMsg.protocolMessage?.type === 0) {
              messageType = 'deleted';
              bodyText = '🚫 [This message was deleted]';
            } else {
              const keys = Object.keys(innerMsg || {}).filter((k) => k !== 'messageContextInfo');
              if (keys.length > 0) {
                const cleanKey = keys[0].replace(/Message$/i, '');
                bodyText = `📎 [${cleanKey.charAt(0).toUpperCase() + cleanKey.slice(1)}]`;
                messageType = cleanKey.toLowerCase();
              } else {
                bodyText = '📎 [Media / Attachment]';
                messageType = 'media';
              }
            }

            const providerMessageId = msg.key.id || `baileys_${Date.now()}`;
            const isFromMe = Boolean(msg.key.fromMe);
            const remoteJid = msg.key.remoteJid || '';
            const rawPhone = remoteJid.replace(/[^0-9]/g, '');
            const isGroup =
              remoteJid.endsWith('@g.us') ||
              remoteJid.endsWith('@newsletter') ||
              rawPhone.length > 15 ||
              rawPhone.startsWith('120363');
            const participantJid = msg.key.participant || (msg as any).participant || '';
            const participantPhone = participantJid.replace(/[^0-9]/g, '');
            const myPhone = session.phoneNumber || '';

            // Handle Group Metadata (Subject / Group Name)
            let groupName: string | undefined = undefined;
            if (isGroup) {
              if (this.groupSubjectCache.has(remoteJid)) {
                groupName = this.groupSubjectCache.get(remoteJid);
              } else if (sock) {
                sock.groupMetadata(remoteJid).then((meta) => {
                  if (meta?.subject) {
                    this.groupSubjectCache.set(remoteJid, meta.subject);
                  }
                }).catch(() => {});
              }
            }

            const senderName = isFromMe
              ? (session.pushName || 'You')
              : (msg.pushName || undefined);

            const senderPhone = isFromMe
              ? myPhone
              : isGroup
              ? (participantPhone || '')
              : rawPhone;

            const storedMsg: StoredMessageRecord = {
              sessionId,
              providerMessageId,
              direction: isFromMe ? 'outbound' : 'inbound',
              fromPhone: isFromMe ? myPhone : (isGroup ? senderPhone || rawPhone : rawPhone),
              toPhone: isFromMe ? (isGroup ? rawPhone : rawPhone) : myPhone,
              messageBody: bodyText,
              messageType,
              chatType: isGroup ? 'group' : 'direct',
              senderPhone,
              senderName,
              groupJid: isGroup ? remoteJid : undefined,
              groupName,
              status: isFromMe ? 'sent' : 'received',
              createdAt: msg.messageTimestamp
                ? new Date(Number(msg.messageTimestamp) * 1000).toISOString()
                : new Date().toISOString(),
            };

            // Store in in-memory rolling buffer
            this.addMessageToMemory(sessionId, storedMsg);

            // Persist to Supabase if configured
            await supabaseService.persistMessage(storedMsg);

            console.log(
              `[BaileysManager] ${storedMsg.direction.toUpperCase()} (${storedMsg.chatType || 'direct'}${groupName ? ` in "${groupName}"` : ''}): ${storedMsg.messageBody.slice(0, 50)}`
            );
          } catch (msgErr) {
            console.warn('[BaileysManager] Error processing message:', msgErr);
          }
        }
      });

      return session;
    } catch (err: unknown) {
      session.status = 'failed';
      session.lastError = err instanceof Error ? err.message : 'Unknown connection error';
      console.error(`[BaileysManager] Error starting session ${sessionId}:`, err);
      return session;
    }
  }

  /**
   * Exponential backoff reconnection scheduler.
   */
  private scheduleReconnect(sessionId: string) {
    const session = this.getSession(sessionId);
    session.reconnectAttempts++;

    // Max 10 attempts before failing
    if (session.reconnectAttempts > 10) {
      session.status = 'failed';
      session.lastError = 'Max reconnection attempts exceeded';
      console.error(`[BaileysManager] Session ${sessionId} reached max reconnection limit`);
      return;
    }

    // Exponential backoff: min(2^attempts * 1000, 30000) + random jitter
    const delay = Math.min(Math.pow(2, session.reconnectAttempts) * 1000, 30_000) + Math.random() * 1000;
    console.log(
      `[BaileysManager] Scheduling reconnect for ${sessionId} in ${Math.round(delay)}ms (attempt ${session.reconnectAttempts})`
    );

    const timer = setTimeout(() => {
      this.startSession(sessionId).catch((err) => {
        console.error(`[BaileysManager] Scheduled reconnect error for ${sessionId}:`, err);
      });
    }, delay);

    this.reconnectTimers.set(sessionId, timer);
  }

  private clearReconnectTimer(sessionId: string) {
    const timer = this.reconnectTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(sessionId);
    }
  }

  /**
   * Gracefully disconnects and logs out a session.
   */
  async disconnectSession(sessionId: string, wipeCredentials = true): Promise<ActiveSession> {
    this.clearReconnectTimer(sessionId);
    const session = this.getSession(sessionId);

    if (session.socket) {
      try {
        await session.socket.logout();
      } catch {
        // Socket might already be closed
      }
      try {
        session.socket.end(new Error('Manual user disconnect'));
      } catch {
        // ignore
      }
      session.socket = null;
    }

    if (wipeCredentials) {
      await sessionStore.deleteSession(sessionId);
      session.phoneNumber = null;
      session.platform = null;
      session.pushName = null;
    }

    session.status = 'disconnected';
    session.qrCodeDataUrl = null;
    session.qrRaw = null;
    session.reconnectAttempts = 0;
    session.lastError = null;
    session.connectedAt = null;

    await supabaseService.syncSession(sessionId, {
      status: 'disconnected',
      phoneNumber: null,
    });

    console.log(`[BaileysManager] Session ${sessionId} cleanly disconnected.`);
    return session;
  }
}

export const baileysManager = new BaileysManager();
