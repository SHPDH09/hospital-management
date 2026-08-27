import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import {
  createWhatsAppGroup,
  disconnectWhatsApp,
  exportGroupParticipants,
  getWhatsAppStatus,
  listWhatsAppGroups,
  parsePhoneList,
  sendBulkWhatsAppMessages,
  startWhatsAppConnection,
} from './wa-service';

const app = express();
const PORT = Number(process.env.PORT || 4040);
const BRIDGE_SECRET = process.env.WHATSAPP_BRIDGE_SECRET || 'change-me-in-production';

app.use(cors({ origin: true }));
app.use(express.json({ limit: '2mb' }));

app.use((req, res, next) => {
  const key = req.header('x-bridge-key');
  if (key !== BRIDGE_SECRET) {
    res.status(401).json({ success: false, message: 'Invalid bridge key' });
    return;
  }
  next();
});

app.get('/health', (_req, res) => {
  res.json({ success: true, service: 'whatsapp-bridge', status: getWhatsAppStatus().status });
});

app.get('/status', (_req, res) => {
  res.json({ success: true, data: getWhatsAppStatus() });
});

app.post('/connect', async (_req, res) => {
  try {
    const data = await startWhatsAppConnection();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err instanceof Error ? err.message : 'Connect failed' });
  }
});

app.post('/disconnect', async (_req, res) => {
  await disconnectWhatsApp();
  res.json({ success: true, data: { disconnected: true } });
});

app.get('/groups', async (_req, res) => {
  try {
    res.json({ success: true, data: await listWhatsAppGroups() });
  } catch (err) {
    res.status(400).json({ success: false, message: err instanceof Error ? err.message : 'Failed' });
  }
});

app.get('/groups/:groupId/export', async (req, res) => {
  try {
    const participants = await exportGroupParticipants(req.params.groupId);
    res.json({
      success: true,
      data: {
        groupId: req.params.groupId,
        count: participants.length,
        participants,
        csv: ['phone,name,isAdmin', ...participants.map((p) => `${p.phone},${p.name || ''},${p.isAdmin ? 'yes' : 'no'}`)].join('\n'),
      },
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err instanceof Error ? err.message : 'Export failed' });
  }
});

app.post('/groups/create', async (req, res) => {
  try {
    const { name, phones } = req.body as { name?: string; phones?: string | string[] };
    if (!name) {
      res.status(400).json({ success: false, message: 'Group name is required' });
      return;
    }
    const phoneList = Array.isArray(phones) ? phones : parsePhoneList(phones || '');
    const data = await createWhatsAppGroup(name, phoneList);
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err instanceof Error ? err.message : 'Create failed' });
  }
});

app.post('/bulk-send', async (req, res) => {
  try {
    const { message, phones, delayMs } = req.body as { message?: string; phones?: string | string[]; delayMs?: number };
    const phoneList = Array.isArray(phones) ? phones : parsePhoneList(phones || '');
    const results = await sendBulkWhatsAppMessages(phoneList, message || '', delayMs ?? 2000);
    const sentCount = results.filter((r) => r.success).length;
    res.json({ success: true, data: { results, sentCount, failedCount: results.length - sentCount } });
  } catch (err) {
    res.status(400).json({ success: false, message: err instanceof Error ? err.message : 'Send failed' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`WhatsApp Bridge running on http://0.0.0.0:${PORT}`);
});
