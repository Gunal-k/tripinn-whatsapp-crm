import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { baileysManager } from './baileys-manager.js';
import { supabaseService, StoredMessageRecord } from './supabase.js';

// Load local and CRM root environment variables
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '127.0.0.1';
const SERVICE_SECRET = process.env.SERVICE_SECRET || 'dev_experimental_qr_secret_12345';

app.use(cors({ origin: ['http://localhost:3000', 'http://127.0.0.1:3000'] }));
app.use(express.json());

/**
 * Security: Authentication Middleware
 * Requires Authorization: Bearer <SERVICE_SECRET> on internal routes.
 */
function authenticateServiceRequest(req: Request, res: Response, next: NextFunction): void {
  // Allow health endpoint without auth for pinging
  if (req.path === '/health') {
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing Bearer token' });
    return;
  }

  const token = authHeader.slice(7).trim();
  if (token !== SERVICE_SECRET) {
    res.status(403).json({ error: 'Forbidden: Invalid service secret' });
    return;
  }

  next();
}

app.use(authenticateServiceRequest);

// 1. Health Endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'tripinn-whatsapp-qr',
    supabaseConnected: supabaseService.isConfigured(),
    timestamp: new Date().toISOString(),
  });
});

// 2. Session Status Endpoint
app.get('/session/status', (req: Request, res: Response) => {
  const sessionId = (req.query.sessionId as string) || 'default_test_session';
  const session = baileysManager.getSession(sessionId);

  res.json({
    sessionId: session.sessionId,
    status: session.status,
    phoneNumber: session.phoneNumber,
    platform: session.platform,
    pushName: session.pushName,
    connectedAt: session.connectedAt,
    qrReady: session.status === 'qr_ready' && !!session.qrCodeDataUrl,
    qrCodeDataUrl: session.status === 'qr_ready' ? session.qrCodeDataUrl : null,
    lastError: session.lastError,
  });
});

// 3. Start / Connect Session Endpoint
app.post('/session/start', async (req: Request, res: Response) => {
  const sessionId = req.body?.sessionId || 'default_test_session';
  try {
    const session = await baileysManager.startSession(sessionId);
    res.json({
      success: true,
      sessionId: session.sessionId,
      status: session.status,
      phoneNumber: session.phoneNumber,
      qrReady: session.status === 'qr_ready' && !!session.qrCodeDataUrl,
      qrCodeDataUrl: session.status === 'qr_ready' ? session.qrCodeDataUrl : null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to start session';
    res.status(500).json({ success: false, error: message });
  }
});

// 4. Disconnect Session Endpoint
app.post('/session/disconnect', async (req: Request, res: Response) => {
  const sessionId = req.body?.sessionId || 'default_test_session';
  try {
    const session = await baileysManager.disconnectSession(sessionId, true);
    res.json({
      success: true,
      sessionId: session.sessionId,
      status: session.status,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to disconnect session';
    res.status(500).json({ success: false, error: message });
  }
});

// 5. Send Message (Phase 3 with Persistence)
app.post('/message/send', async (req: Request, res: Response) => {
  const sessionId = req.body?.sessionId || 'default_test_session';
  const toPhone = (req.body?.toPhone || req.body?.to || '').toString().trim();
  const messageText = (req.body?.messageText || req.body?.text || '').toString().trim();

  if (!toPhone || !messageText) {
    res.status(400).json({ error: 'Missing toPhone or messageText' });
    return;
  }

  const session = baileysManager.getSession(sessionId);
  if (session.status !== 'connected' || !session.socket) {
    res.status(400).json({
      error: 'WhatsApp QR session is not connected. Scan QR code first.',
      status: session.status,
    });
    return;
  }

  try {
    const digitsOnly = toPhone.replace(/[^0-9]/g, '');
    const jid = `${digitsOnly}@s.whatsapp.net`;
    const result = await session.socket.sendMessage(jid, { text: messageText });
    const providerMessageId = result?.key?.id || `out_${Date.now()}`;

    const storedMsg: StoredMessageRecord = {
      sessionId,
      providerMessageId,
      direction: 'outbound',
      fromPhone: session.phoneNumber || '',
      toPhone: digitsOnly,
      messageBody: messageText,
      messageType: 'text',
      status: 'sent',
      createdAt: new Date().toISOString(),
    };

    // Store in memory buffer & persist to Supabase
    baileysManager.addMessageToMemory(sessionId, storedMsg);
    await supabaseService.persistMessage(storedMsg);

    res.json({
      success: true,
      messageId: providerMessageId,
      timestamp: storedMsg.createdAt,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to send message';
    res.status(500).json({ success: false, error: message });
  }
});

// 6. Recent Messages Endpoint
app.get('/messages', async (req: Request, res: Response) => {
  const sessionId = (req.query.sessionId as string) || 'default_test_session';
  try {
    const messages = await baileysManager.getMessages(sessionId);
    res.json({
      success: true,
      sessionId,
      messages,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve messages';
    res.status(500).json({ success: false, error: message });
  }
});

// Start listening
const server = app.listen(PORT, HOST, () => {
  console.log(`[WhatsApp QR Service] Daemon active on http://${HOST}:${PORT}`);

  // Auto-resume existing session if credentials exist on disk
  const defaultSessionPath = path.resolve(process.env.SESSIONS_DIR || './sessions', 'session_default_test_session');
  if (fs.existsSync(defaultSessionPath)) {
    console.log('[WhatsApp QR Service] Found existing session credentials. Auto-resuming connection...');
    baileysManager.startSession('default_test_session').catch((err) => {
      console.warn('[WhatsApp QR Service] Auto-resume notice:', err.message);
    });
  }
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('[WhatsApp QR Service] SIGTERM received. Shutting down gracefully...');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('[WhatsApp QR Service] SIGINT received. Shutting down gracefully...');
  server.close(() => process.exit(0));
});
