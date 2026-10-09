import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { DatabaseRepository } from './src/db/repository';

// Initialize Gemini client according to gemini-api guidelines
const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

// Prevent unhandled errors from terminating the process
process.on('uncaughtException', (err) => {
  console.error('Server uncaught exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Server unhandled rejection at:', promise, 'reason:', reason);
});

function getPort(): number {
  const portArgIndex = process.argv.indexOf('--port');
  if (portArgIndex !== -1 && process.argv[portArgIndex + 1]) {
    const parsed = parseInt(process.argv[portArgIndex + 1], 10);
    if (!isNaN(parsed)) return parsed;
  }
  return 3000;
}

const PORT = getPort();
const app = express();

// Universal CORS & Proxy Preflight middleware (Fixes 405 Method Not Allowed on Cloudflare Workers / Reverse Proxies)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Answer OPTIONS preflight requests immediately with 200/204 to prevent 405
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ----------------------------------------------------
// WebSocket Real-Time Broadcaster
// ----------------------------------------------------
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('error', (err) => {
  console.warn('WebSocket Server error:', err);
});

function broadcast(eventType: string, payload: any) {
  const msg = JSON.stringify({ type: eventType, data: payload });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(msg);
      } catch (e) {
        // ignore send error on closing socket
      }
    }
  });
}

wss.on('connection', (ws) => {
  ws.on('error', (err) => {
    console.warn('WebSocket client socket error:', err);
  });

  try {
    ws.send(JSON.stringify({ type: 'connected', data: { timestamp: new Date().toISOString() } }));
  } catch (e) {
    // ignore
  }

  ws.on('message', (data) => {
    try {
      const parsed = JSON.parse(data.toString());
      if (parsed.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch (e) {
      // ignore
    }
  });
});

// ----------------------------------------------------
// REST API Routes with Cloud SQL Database Persistence
// ----------------------------------------------------

function normalizeDigits(str: any): string {
  if (!str) return '';
  const p = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const a = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let s = str.toString().trim();
  for (let i = 0; i < 10; i++) {
    s = s.replace(new RegExp(p[i], 'g'), i.toString());
    s = s.replace(new RegExp(a[i], 'g'), i.toString());
  }
  return s;
}

// 0. Health check
app.get(['/api', '/api/health'], (req, res) => {
  res.json({ status: 'ok', app: 'School Chat', timestamp: new Date().toISOString() });
});

// 1. Auth: Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { personnelCode, password } = req.body;

    if (!personnelCode || !password) {
      return res.status(400).json({ error: 'کد پرسنلی و رمز عبور الزامی هستند' });
    }

    const normalizedCode = normalizeDigits(personnelCode);
    const normalizedPass = password.toString().trim();

    let user = await DatabaseRepository.findUserByPersonnelCode(normalizedCode);

    // Fallback for Principal login with keyword "مدیر" or "admin"
    if (!user && (normalizedCode === '10001356' || normalizedCode === '10001315' || normalizedCode === 'مدیر' || normalizedCode === 'admin')) {
      const allUsers = await DatabaseRepository.getAllUsers();
      user = allUsers.find(u => u.role === 'principal') || null;
    }

    if (!user) {
      return res.status(401).json({ error: 'کاربری با این کد پرسنلی یافت نشد' });
    }

    // Principal special check: can use initial requested password "bbp13156" or custom password
    if (user.role === 'principal') {
      if (normalizedPass === 'bbp13156' || normalizedPass === user.password) {
        broadcast('user:status', { userId: user.id, isOnline: true });
        return res.json({ success: true, user });
      }
      return res.status(401).json({ error: 'رمز ورود مدیر نادرست است (رمز اولیه: bbp13156)' });
    }

    // Teacher check
    if (user.password !== normalizedPass) {
      return res.status(401).json({ error: 'رمز عبور وارد شده اشتباه است. در صورت فراموشی با مدیر مدرسه تماس بگیرید.' });
    }

    broadcast('user:status', { userId: user.id, isOnline: true });
    return res.json({ success: true, user });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'خطای سرور در فرآیند ورود' });
  }
});

// 2. Auth: Register new Teacher / Staff
// Requirement: 8-digit personnel code + mobile number
app.post('/api/auth/register', async (req, res) => {
  try {
    const { fullName, personnelCode, mobile, subject, role = 'teacher', password } = req.body;

    if (!fullName || !personnelCode || !mobile) {
      return res.status(400).json({ error: 'لطفاً نام کامل، کد پرسنلی و شماره موبایل را وارد نمایید' });
    }

    const cleanCode = normalizeDigits(personnelCode);
    if (cleanCode.length !== 8 || !/^\d{8}$/.test(cleanCode)) {
      return res.status(400).json({ error: 'کد پرسنلی باید دقیقاً ۸ رقم عددی باشد' });
    }

    const cleanMobile = normalizeDigits(mobile);
    if (!/^09\d{9}$/.test(cleanMobile)) {
      return res.status(400).json({ error: 'شماره موبایل باید با ۰۹ شروع شده و ۱۱ رقم باشد' });
    }

    const existing = await DatabaseRepository.findUserByPersonnelCode(cleanCode);
    if (existing) {
      return res.status(400).json({ error: 'این کد پرسنلی قبلاً در سامانه ثبت شده است' });
    }

    const newUser = await DatabaseRepository.createUser({
      fullName: fullName.trim(),
      personnelCode: cleanCode,
      mobile: cleanMobile,
      subject: subject?.trim() || 'دبیر آموزشی',
      role: role === 'deputy' ? 'deputy' : 'teacher',
      password: password && password.trim().length > 0 ? password.trim() : undefined,
    });

    broadcast('user:created', newUser);
    const updatedGroups = await DatabaseRepository.getGroups();
    broadcast('group:updated', updatedGroups);

    res.json({ success: true, user: newUser });
  } catch (error: any) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'خطا در ثبت‌نام کاربر جدید در پایگاه داده' });
  }
});

// 3. Get all users
app.get('/api/users', async (req, res) => {
  try {
    const userList = await DatabaseRepository.getAllUsers();
    res.json({ users: userList });
  } catch (error: any) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'خطا در دریافت لیست همکاران' });
  }
});

// 4. Principal reset / update teacher's password
// Requirement: "مدیر قابلیت مشاهده رمز و ایجاد رمز جدید برای دبیران داشته باشد"
app.post(['/api/admin/users/:userId/password', '/api/users/:userId/password'], async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;

    const generated = newPassword && newPassword.trim().length > 0 
      ? newPassword.trim() 
      : 'sch_' + Math.floor(1000 + Math.random() * 9000);

    await DatabaseRepository.updatePassword(userId, generated);

    broadcast('user:password_updated', { userId, newPassword: generated });
    res.json({ success: true, userId, newPassword: generated });
  } catch (error: any) {
    console.error('Password update error:', error);
    res.status(500).json({ error: 'خطا در به‌روزرسانی رمز عبور' });
  }
});

// 4.5. Principal deletes user / cancels staff registration
// Requirement: "مدیر بتواند افراد و افراد پیش فرض رو حذف کند"
app.delete(['/api/admin/users/:userId', '/api/users/:userId'], async (req, res) => {
  try {
    const { userId } = req.params;
    const requestingUserId = (req.body?.requestingUserId || req.query?.requestingUserId || req.headers['x-user-id']) as string;
    const allUsers = await DatabaseRepository.getAllUsers();
    const target = allUsers.find(u => u.id === userId);

    if (!target) {
      return res.status(404).json({ error: 'کاربر مورد نظر در سامانه یافت نشد' });
    }

    if (requestingUserId && target.id === requestingUserId) {
      return res.status(403).json({ error: 'امکان حذف حساب کاربری جاری خودتان وجود ندارد' });
    }

    const success = await DatabaseRepository.deleteUser(userId);
    if (!success) {
      return res.status(400).json({ error: 'عملیات حذف کاربر با خطا مواجه شد' });
    }

    broadcast('user:deleted', { userId });
    res.json({ success: true, userId, message: `کاربر «${target.fullName}» با موفقیت از سامانه حذف شد` });
  } catch (error: any) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'خطا در حذف کاربر از سامانه' });
  }
});

// 4.8. Update user profile (Name, Photo/Avatar, Mobile, Subject, Password)
// Requirement: "مدیر بتواند مشخصات و عکس خود را ویرایش کند"
app.patch('/api/users/:userId/profile', async (req, res) => {
  try {
    const { userId } = req.params;
    const { fullName, personnelCode, mobile, subject, avatar, password } = req.body;

    const allUsers = await DatabaseRepository.getAllUsers();
    const existing = allUsers.find(u => u.id === userId);
    if (!existing) {
      return res.status(404).json({ error: 'کاربر در سامانه یافت نشد' });
    }

    // Check personnelCode uniqueness if updated
    if (personnelCode && personnelCode !== existing.personnelCode) {
      const cleanCode = normalizeDigits(personnelCode);
      if (cleanCode.length !== 8 || !/^\d{8}$/.test(cleanCode)) {
        return res.status(400).json({ error: 'کد پرسنلی باید دقیقاً ۸ رقم عددی باشد' });
      }
      const duplicate = await DatabaseRepository.findUserByPersonnelCode(cleanCode);
      if (duplicate && duplicate.id !== userId) {
        return res.status(400).json({ error: 'این کد پرسنلی به نام کاربر دیگری ثبت شده است' });
      }
    }

    const updatedUser = await DatabaseRepository.updateUserProfile(userId, {
      fullName,
      personnelCode: personnelCode ? normalizeDigits(personnelCode) : undefined,
      mobile: mobile ? normalizeDigits(mobile) : undefined,
      subject,
      avatar,
      password,
    });

    if (!updatedUser) {
      return res.status(400).json({ error: 'خطا در به‌روزرسانی مشخصات کاربر' });
    }

    broadcast('user:updated', updatedUser);
    res.json({ success: true, user: updatedUser });
  } catch (error: any) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'خطا در ویرایش اطلاعات کاربری' });
  }
});

// 5. Groups: Get groups
app.get('/api/groups', async (req, res) => {
  try {
    const { userId } = req.query;
    const groupList = await DatabaseRepository.getGroups(userId as string | undefined);
    res.json({ groups: groupList });
  } catch (error: any) {
    console.error('Get groups error:', error);
    res.status(500).json({ error: 'خطا در بارگذاری گروه‌ها' });
  }
});

// 6. Principal defines new group
// Requirement: "مدیر قابلیت تعریف گروه ... داشته باشد"
app.post(['/api/admin/groups', '/api/groups'], async (req, res) => {
  try {
    const { name, description, memberIds = [], isAnnouncementOnly = false, autoDeleteHours = 0, avatar } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'نام گروه الزامی است' });
    }

    const allUsers = await DatabaseRepository.getAllUsers();
    const principalId = allUsers.find(u => u.role === 'principal')?.id || 'u_principal';

    const newGroup = await DatabaseRepository.createGroup({
      name: name.trim(),
      description: description?.trim() || 'گروه گفتگوی کادر مدرسه',
      avatar,
      memberIds,
      isAnnouncementOnly: Boolean(isAnnouncementOnly),
      autoDeleteHours: Number(autoDeleteHours) || 0,
      createdBy: principalId,
    });

    broadcast('group:created', newGroup);
    res.json({ success: true, group: newGroup });
  } catch (error: any) {
    console.error('Create group error:', error);
    res.status(500).json({ error: 'خطا در ایجاد گروه جدید' });
  }
});

// 7. Principal updates group membership
// Requirement: "افراد را در گروه ها عضو کند"
app.post(['/api/admin/groups/:groupId/members', '/api/groups/:groupId/members'], async (req, res) => {
  try {
    const { groupId } = req.params;
    const { memberIds } = req.body;

    if (!Array.isArray(memberIds)) {
      return res.status(400).json({ error: 'فهرست اعضا نامعتبر است' });
    }

    const allUsers = await DatabaseRepository.getAllUsers();
    const principalId = allUsers.find(u => u.role === 'principal')?.id || 'u_principal';
    const finalMembers = Array.from(new Set([principalId, ...memberIds]));

    const updated = await DatabaseRepository.updateGroupMembers(groupId, finalMembers);
    const groups = await DatabaseRepository.getGroups();
    const updatedGroup = groups.find(g => g.id === groupId);
    broadcast('group:members_updated', { groupId, memberIds: updated });

    res.json({ success: true, groupId, memberIds: updated, group: updatedGroup });
  } catch (error: any) {
    console.error('Update group members error:', error);
    res.status(500).json({ error: 'خطا در به‌روزرسانی اعضای گروه' });
  }
});

// 7.5. Principal removes a member from a group
// Requirement: "مدیر قابلیت حذف افراد ... از گروه را داشته باشد"
app.delete(['/api/admin/groups/:groupId/members/:userId', '/api/groups/:groupId/members/:userId'], async (req, res) => {
  try {
    const { groupId, userId } = req.params;
    const allUsers = await DatabaseRepository.getAllUsers();
    const target = allUsers.find(u => u.id === userId);

    if (target?.role === 'principal') {
      return res.status(403).json({ error: 'مدیر آموزشگاه از گروه‌ها حذف نمی‌شود' });
    }

    const updated = await DatabaseRepository.removeGroupMember(groupId, userId);
    const groups = await DatabaseRepository.getGroups();
    const updatedGroup = groups.find(g => g.id === groupId);

    broadcast('group:members_updated', { groupId, memberIds: updated });
    res.json({ success: true, groupId, memberIds: updated, group: updatedGroup, message: 'عضو با موفقیت از گروه حذف گردید' });
  } catch (error: any) {
    console.error('Remove group member error:', error);
    res.status(500).json({ error: 'خطا در حذف عضو از گروه' });
  }
});

// 8. Messages: Get for chat or empty
app.get(['/api/messages', '/api/messages/'], (req, res) => {
  res.json({ messages: [] });
});

app.get('/api/messages/:chatId', async (req, res) => {
  try {
    const rawChatId = req.params.chatId;
    if (!rawChatId || rawChatId.trim().length === 0) {
      return res.json({ messages: [] });
    }
    const chatId = decodeURIComponent(rawChatId);
    const msgList = await DatabaseRepository.getMessages(chatId);
    res.json({ messages: msgList });
  } catch (error: any) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'خطا در بارگذاری پیام‌ها' });
  }
});

// 9. Send message
app.post('/api/messages', async (req, res) => {
  try {
    const { chatId, senderId, content, type = 'text', fileUrl, fileName, voiceDuration, videoDuration, replyTo, voiceTranscript, isVoiceTranscribed, isVoiceTranslated, originalSpokenText } = req.body;

    const allUsers = await DatabaseRepository.getAllUsers();
    const sender = allUsers.find(u => u.id === senderId);
    if (!sender) {
      return res.status(401).json({ error: 'فرستنده پیام معتبر نیست' });
    }

    // Check announcement permissions
    const allGroups = await DatabaseRepository.getGroups();
    const group = allGroups.find(g => g.id === chatId);
    if (group?.isAnnouncementOnly && sender.role !== 'principal' && sender.role !== 'deputy') {
      return res.status(403).json({ error: 'در این کانال فقط مدیر و معاونین مجاز به ارسال پیام هستند' });
    }

    const newMsg = await DatabaseRepository.insertMessage({
      chatId,
      senderId: sender.id,
      senderName: sender.fullName,
      senderRole: sender.role,
      senderAvatar: sender.avatar,
      content: content || '',
      type,
      fileUrl,
      fileName,
      voiceDuration,
      videoDuration,
      voiceTranscript,
      isVoiceTranscribed,
      isVoiceTranslated,
      originalSpokenText,
      replyTo,
    });

    broadcast('message:new', newMsg);
    res.json({ success: true, message: newMsg });
  } catch (error: any) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'خطا در ثبت پیام' });
  }
});

// 10. Pin / Unpin message
app.post('/api/messages/:id/pin', async (req, res) => {
  try {
    const { id } = req.params;
    const isPinned = await DatabaseRepository.togglePin(id);
    broadcast('message:pinned', { messageId: id, isPinned });
    res.json({ success: true, isPinned });
  } catch (error: any) {
    console.error('Pin message error:', error);
    res.status(500).json({ error: 'خطا در سنجاق پیام' });
  }
});

// 11. React to message
app.post('/api/messages/:id/react', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, emoji } = req.body;
    const reactions = await DatabaseRepository.reactToMessage(id, userId, emoji);
    broadcast('message:reaction', { messageId: id, reactions });
    res.json({ success: true, reactions });
  } catch (error: any) {
    console.error('Reaction error:', error);
    res.status(500).json({ error: 'خطا در ثبت واکنش' });
  }
});

// 11.5. Delete message (User can delete own sent message, Principal can delete any message)
// Requirement: "افراد بتوانند پیام های ارسالی خود را حذف کنند . مدیر نیز بتواند پیام افراد را حذف کند"
app.delete('/api/messages/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const requestingUserId = (req.body?.userId || req.query?.userId || req.headers['x-user-id']) as string;
    if (!requestingUserId) {
      return res.status(400).json({ error: 'شناسه کاربر ارسال‌کننده درخواست الزامی است' });
    }

    const result = await DatabaseRepository.deleteMessage(id, requestingUserId);
    if (!result.success) {
      return res.status(403).json({ error: result.error || 'دسترسی غیرمجاز برای حذف پیام' });
    }

    broadcast('message:deleted', { messageId: id, chatId: result.chatId });
    res.json({ success: true, messageId: id, chatId: result.chatId });
  } catch (error: any) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'خطا در حذف پیام' });
  }
});

// 11.55. Edit message (Sender can edit their own message)
// Requirement: "پیامی که می فرستیم قابلیت ویرایش داشته باشه"
app.patch('/api/messages/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { content, userId } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'متن پیام نمی‌تواند خالی باشد' });
    }
    const requestingUserId = (userId || req.headers['x-user-id']) as string;
    if (!requestingUserId) {
      return res.status(400).json({ error: 'شناسه کاربر الزامی است' });
    }

    const result = await DatabaseRepository.editMessage(id, content.trim(), requestingUserId);
    if (!result.success) {
      return res.status(403).json({ error: result.error || 'دسترسی غیرمجاز برای ویرایش پیام' });
    }

    broadcast('message:edited', { messageId: id, content: content.trim(), isEdited: true });
    res.json({ success: true, message: result.message });
  } catch (error: any) {
    console.error('Edit message error:', error);
    res.status(500).json({ error: 'خطا در ویرایش پیام' });
  }
});

// 11.6. Clear entire chat history for a group or conversation
// Requirement: "مدیر این امکان را داشته باشد که سابقه چت ها رو پاک کند یا مدت تنظیم کند اتومات حذف شود"
app.post('/api/chats/:chatId/clear-history', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'شناسه مدیر الزامی است' });
    }

    const result = await DatabaseRepository.clearChatHistory(chatId, userId);
    if (!result.success) {
      return res.status(403).json({ error: result.error || 'خطا در پاکسازی سابقه گفتگو' });
    }

    broadcast('chat:cleared', { chatId, deletedCount: result.deletedCount });
    res.json({ success: true, chatId, deletedCount: result.deletedCount });
  } catch (error: any) {
    console.error('Clear chat history error:', error);
    res.status(500).json({ error: 'خطا در پاکسازی سابقه گفتگو' });
  }
});

// 11.7. Set auto-delete duration (TTL) for a group
// Requirement: "مدیر این امکان را داشته باشد که سابقه چت ها رو پاک کند یا مدت تنظیم کند اتومات حذف شود"
app.post('/api/groups/:groupId/auto-delete', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { autoDeleteHours, userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'شناسه مدیر الزامی است' });
    }

    const result = await DatabaseRepository.updateGroupAutoDelete(groupId, Number(autoDeleteHours) || 0, userId);
    if (!result.success) {
      return res.status(403).json({ error: result.error || 'خطا در تنظیم حذف خودکار' });
    }

    broadcast('group:auto-delete-updated', { groupId, autoDeleteHours: Number(autoDeleteHours) || 0 });
    res.json({ success: true, groupId, autoDeleteHours: Number(autoDeleteHours) || 0 });
  } catch (error: any) {
    console.error('Update auto-delete error:', error);
    res.status(500).json({ error: 'خطا در تنظیم حذف خودکار' });
  }
});

// 12. Delete group
app.delete(['/api/admin/groups/:groupId', '/api/groups/:groupId'], async (req, res) => {
  try {
    const { groupId } = req.params;
    await DatabaseRepository.deleteGroup(groupId);
    broadcast('group:deleted', { groupId });
    res.json({ success: true, groupId });
  } catch (error: any) {
    console.error('Delete group error:', error);
    res.status(500).json({ error: 'خطا در حذف گروه' });
  }
});

// Helper for decoding HTML entities from translation APIs
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
}

// 13. Persian <-> English live translator endpoint
app.post('/api/translate', async (req, res) => {
  try {
    const { text, targetLang, sourceLang } = req.body;
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.json({ success: true, translatedText: '', originalText: '' });
    }

    const cleanInput = text.trim();
    // Auto-detect direction if not explicitly supplied
    const hasPersian = /[\u0600-\u06FF]/.test(cleanInput);
    const resolvedTarget = targetLang || (hasPersian ? 'en' : 'fa');
    const resolvedSource = sourceLang || (resolvedTarget === 'en' ? 'fa' : 'en');

    // 1. Primary Engine: Ultra-fast Google Translate (gtx) - ~150ms response, high reliability, zero quota exhaustion
    try {
      const gtxUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${resolvedSource}&tl=${resolvedTarget}&dt=t&q=${encodeURIComponent(cleanInput)}`;
      const gtxRes = await fetch(gtxUrl, { signal: AbortSignal.timeout(3500) });
      if (gtxRes.ok) {
        const gtxData = await gtxRes.json();
        if (Array.isArray(gtxData) && Array.isArray(gtxData[0])) {
          const translatedText = gtxData[0]
            .map((chunk: any) => (chunk && chunk[0] ? chunk[0] : ''))
            .join('')
            .trim();
          if (translatedText && translatedText.toLowerCase() !== cleanInput.toLowerCase()) {
            return res.json({
              success: true,
              originalText: cleanInput,
              translatedText: decodeHtmlEntities(translatedText),
              sourceLang: resolvedSource,
              targetLang: resolvedTarget,
              engine: 'gtx',
            });
          }
        }
      }
    } catch (gtxError: any) {
      console.warn('GTX translation error, switching to secondary engine:', gtxError.message || gtxError);
    }

    // 2. Secondary: Fast cloud translation service (MyMemory)
    try {
      const langpair = `${resolvedSource}|${resolvedTarget}`;
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleanInput)}&langpair=${langpair}`;
      const fetchRes = await fetch(url, { signal: AbortSignal.timeout(3500) });
      if (fetchRes.ok) {
        const json: any = await fetchRes.json();
        let candidate = '';
        if (json.matches && Array.isArray(json.matches)) {
          const best = json.matches.find((m: any) => m.quality >= 40 && !m.translation.startsWith('['));
          if (best && best.translation) candidate = best.translation;
        }
        if (!candidate && json.responseData?.translatedText) {
          candidate = json.responseData.translatedText.replace(/\[.*?\]\s*/g, '');
        }

        if (candidate && candidate.toLowerCase() !== cleanInput.toLowerCase()) {
          const decoded = decodeHtmlEntities(candidate.trim());
          return res.json({
            success: true,
            originalText: cleanInput,
            translatedText: decoded,
            sourceLang: resolvedSource,
            targetLang: resolvedTarget,
            engine: 'service',
          });
        }
      }
    } catch (fallbackError: any) {
      console.warn('Fallback translation error:', fallbackError.message || fallbackError);
    }

    // 3. Tertiary: Gemini model (if available)
    if (ai) {
      try {
        const prompt = resolvedTarget === 'en'
          ? `Translate the following Persian text accurately into natural, polite, and fluent English. Suitable for Iranian schools, teachers, and educational staff communications. Return ONLY the translated English text with no quotes, markdown formatting, or notes:\n\n${cleanInput}`
          : `Translate the following English text accurately into natural, polite, and formal Persian (Farsi) suitable for Iranian school communications and teachers. Return ONLY the translated Persian text with no quotes, markdown formatting, or notes:\n\n${cleanInput}`;

        const geminiPromise = ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
        });

        // Timeout race to prevent waiting if Gemini is busy
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Gemini timeout')), 3000)
        );

        const response: any = await Promise.race([geminiPromise, timeoutPromise]);
        const resultText = response.text ? response.text.trim().replace(/^["']|["']$/g, '') : '';

        if (resultText && resultText.toLowerCase() !== cleanInput.toLowerCase()) {
          return res.json({
            success: true,
            originalText: cleanInput,
            translatedText: resultText,
            sourceLang: resolvedSource,
            targetLang: resolvedTarget,
            engine: 'gemini',
          });
        }
      } catch (geminiError: any) {
        console.warn('Gemini translation temporarily unavailable, using fallback:', geminiError.message || geminiError);
      }
    }

    // 4. Fallback dictionary for common school/teacher phrases
    const fallbackDict: Record<string, string> = {
      'سلام': 'Hello',
      'سلام و خسته نباشید': 'Hello and more power to you',
      'خسته نباشید': 'Good work / More power to you',
      'صبح بخیر': 'Good morning',
      'عصر بخیر': 'Good afternoon',
      'شب بخیر': 'Good evening',
      'جلسه شورای دبیران': "Teachers' Council Meeting",
      'جلسه شورای معلمان': "Teachers' Council Meeting",
      'تکالیف دانش‌آموزان': "Students' homework",
      'لطفاً تکالیف را ارسال فرمایید': 'Please submit the homework assignments',
      'حضور و غیاب دانش‌آموزان': 'Student attendance',
      'کارنامه تحصیلی': 'Academic report card',
      'نمرات آزمون مستمر': 'Continuous assessment scores',
      'آزمون نوبت اول': 'First term exam',
      'آزمون نوبت دوم': 'Second term exam',
      'با تشکر و احترام': 'With thanks and respect',
      'موفق و پیروز باشید': 'Wishing you great success',
    };

    let dictMatch = fallbackDict[cleanInput];
    if (!dictMatch && resolvedTarget === 'fa') {
      const rev = Object.entries(fallbackDict).find(([k, v]) => v.toLowerCase() === cleanInput.toLowerCase());
      if (rev) dictMatch = rev[0];
    }

    res.json({
      success: true,
      originalText: cleanInput,
      translatedText: dictMatch || cleanInput,
      sourceLang: resolvedSource,
      targetLang: resolvedTarget,
      engine: 'dictionary',
    });
  } catch (error: any) {
    console.error('Translation endpoint error:', error);
    res.status(500).json({ error: 'خطا در ترجمه متن' });
  }
});

interface CachedTTS {
  buffer: Buffer;
  wordBoundaries: Array<{ text: string; start: number; end: number }>;
  duration: number;
  timestamp: number;
}
const ttsAudioCache = new Map<string, CachedTTS>();

function getVoiceForLang(langCode: string): { voice: string; locale: string } {
  const code = (langCode || 'fa').toLowerCase();
  if (code.startsWith('fa')) {
    // Official Microsoft Neural Persian voice (Dilara) - high natural quality
    return { voice: 'fa-IR-DilaraNeural', locale: 'fa-IR' };
  }
  if (code.startsWith('ar')) {
    return { voice: 'ar-SA-ZariyahNeural', locale: 'ar-SA' };
  }
  if (code.startsWith('en')) {
    return { voice: 'en-US-AriaNeural', locale: 'en-US' };
  }
  if (code.startsWith('fr')) {
    return { voice: 'fr-FR-DeniseNeural', locale: 'fr-FR' };
  }
  if (code.startsWith('de')) {
    return { voice: 'de-DE-KatjaNeural', locale: 'de-DE' };
  }
  if (code.startsWith('es')) {
    return { voice: 'es-ES-ElviraNeural', locale: 'es-ES' };
  }
  return { voice: 'fa-IR-DilaraNeural', locale: 'fa-IR' };
}

// 14. Text-To-Speech (TTS / تبدیل هوشمند متن به گفتار با صدای طبیعی فارسی، زمان‌بندی کلمات و هایلایت کارائوکه)
app.all(['/api/tts', '/api/speech'], async (req, res) => {
  try {
    const text = ((req.method === 'POST' ? req.body?.text : req.query.text) || req.body?.text || req.query.text) as string;
    const lang = ((req.method === 'POST' ? req.body?.lang : req.query.lang) || req.body?.lang || req.query.lang || 'fa') as string;
    const rateParam = (req.method === 'POST' ? req.body?.rate : req.query.rate) as string | number | undefined;
    const format = ((req.method === 'POST' ? req.body?.format : req.query.format) || (req.headers.accept?.includes('application/json') ? 'json' : 'audio')) as string;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'متن برای تبدیل به گفتار الزامی است' });
    }

    // Sanitize text and limit length
    const cleanText = text.trim().slice(0, 600);
    const { voice, locale } = getVoiceForLang(lang);

    // Calculate rate string if requested (e.g. '+0%', '-15%', '+10%')
    let rateStr = '+0%';
    if (rateParam !== undefined && rateParam !== null) {
      const parsedRate = typeof rateParam === 'number' ? rateParam : parseFloat(rateParam);
      if (!isNaN(parsedRate) && parsedRate >= 0.5 && parsedRate <= 2.0) {
        const percent = Math.round((parsedRate - 1.0) * 100);
        rateStr = `${percent >= 0 ? '+' : ''}${percent}%`;
      }
    }

    const cacheKey = `${voice}:${rateStr}:${cleanText}`;
    let cached = ttsAudioCache.get(cacheKey);

    let buffer: Buffer | null = cached?.buffer || null;
    let wordBoundaries: Array<{ text: string; start: number; end: number }> = cached?.wordBoundaries || [];
    let duration: number = cached?.duration || 0;

    if (!buffer) {
      // 1. Primary Engine: Neural Edge TTS (Fully supports Persian / fa-IR-DilaraNeural with exact word boundaries)
      try {
        // @ts-ignore
        const edgeMod: any = await import('@andresaya/edge-tts');
        const EdgeTTSClass: any = edgeMod.EdgeTTS || edgeMod.default?.EdgeTTS || edgeMod.default;
        const tts: any = new EdgeTTSClass({
          voice,
          lang: locale,
          rate: rateStr,
          outputFormat: 'audio-24khz-48kbitrate-mono-mp3'
        });

        await tts.synthesize(cleanText, voice, { rate: rateStr });
        const generatedBuffer: Buffer = await tts.toBuffer();

        if (generatedBuffer && generatedBuffer.length > 0) {
          buffer = generatedBuffer;
          const rawBoundaries = typeof tts.getWordBoundaries === 'function' ? tts.getWordBoundaries() : [];
          wordBoundaries = (rawBoundaries || []).map((b: any) => ({
            text: b.text || '',
            start: Math.round(((b.offset || 0) / 10_000_000) * 1000) / 1000,
            end: Math.round((((b.offset || 0) + (b.duration || 0)) / 10_000_000) * 1000) / 1000,
          }));

          if (wordBoundaries.length > 0) {
            duration = wordBoundaries[wordBoundaries.length - 1].end;
          } else {
            duration = Math.round((generatedBuffer.length / (24000 * 3)) * 10) / 10;
          }

          // Keep cache size bounded
          if (ttsAudioCache.size > 300) {
            const firstKey = ttsAudioCache.keys().next().value;
            if (firstKey) ttsAudioCache.delete(firstKey);
          }
          ttsAudioCache.set(cacheKey, { buffer: generatedBuffer, wordBoundaries, duration, timestamp: Date.now() });
        }
      } catch (edgeErr: any) {
        console.warn('EdgeTTS synthesis error, attempting fallback:', edgeErr?.message || edgeErr);
      }
    }

    // 2. Secondary Engine: Google Translate TTS fallback for non-Persian languages
    if (!buffer && !lang.startsWith('fa')) {
      const langCode = lang.startsWith('en') ? 'en' : lang.startsWith('ar') ? 'ar' : lang.slice(0, 2);
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanText.slice(0, 200))}&tl=${langCode}&client=tw-ob`;
      const fallbackRes = await fetch(ttsUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://translate.google.com/',
        },
        signal: AbortSignal.timeout(4000),
      });

      if (fallbackRes.ok && fallbackRes.body) {
        const arr = await fallbackRes.arrayBuffer();
        buffer = Buffer.from(arr);
        duration = 3.0;
      }
    }

    if (!buffer || buffer.length === 0) {
      return res.status(502).json({ error: 'امکان تولید گفتار صوتی در حال حاضر میسر نشد' });
    }

    // If client requested JSON with base64 audio and word boundaries for karaoke display
    if (format === 'json') {
      return res.json({
        success: true,
        audioUrl: `data:audio/mpeg;base64,${buffer.toString('base64')}`,
        wordBoundaries,
        duration,
        text: cleanText,
        lang,
      });
    }

    // Serve raw audio with full range support (iOS Safari & mobile compatible)
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=86400');

    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : buffer.length - 1;
      if (start >= buffer.length || end >= buffer.length) {
        res.setHeader('Content-Range', `bytes */${buffer.length}`);
        return res.status(416).end();
      }
      const chunk = buffer.subarray(start, end + 1);
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${buffer.length}`,
        'Content-Length': chunk.length,
      });
      return res.end(chunk);
    }

    res.setHeader('Content-Length', buffer.length.toString());
    return res.send(buffer);
  } catch (err: any) {
    console.error('TTS endpoint error:', err);
    res.status(500).json({ error: 'خطای سرور در تبدیل متن به گفتار' });
  }
});

// Fallback for any unmatched /api/* requests so they ALWAYS return JSON, never HTML
app.all(['/api', '/api/*'], (req, res) => {
  res.status(404).json({ error: 'سرویس یا مسیر درخواستی در سرور یافت نشد' });
});

// API Error Handler middleware
app.use('/api', (err: any, req: any, res: any, next: any) => {
  console.error('API Error:', err);
  res.status(err.status || 500).json({ error: err.message || 'خطای سرور در پردازش درخواست' });
});

// ----------------------------------------------------
// Vite Dev Server / Static Production Handler
// ----------------------------------------------------
let viteMiddleware: any = null;
const distPath = path.join(process.cwd(), 'dist');

// Serve static assets from dist if they exist
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// Dynamic frontend handler: serves Vite when ready in dev, or static index.html in production
app.use((req, res, next) => {
  if (req.url.startsWith('/api') || req.url === '/ws') {
    return next();
  }
  if (viteMiddleware) {
    return viteMiddleware(req, res, next);
  }
  // If production build index.html exists, serve it directly
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  // While Vite finishes bundling (~500ms in dev mode), serve quick initial reload
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="1"><title>پیام‌رسان مدرسه</title></head><body style="background:#0f172a;color:#94a3b8;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><p style="font-size:14px;">در حال آماده‌سازی سامانه مدرسه...</p></body></html>`);
});

server.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`Port ${PORT} is busy, retrying in 400ms...`);
    setTimeout(() => {
      server.close();
      server.listen(PORT, '0.0.0.0');
    }, 400);
  } else {
    console.error('HTTP Server error:', err);
  }
});

// Start listening immediately on port 3000
server.listen(PORT, '0.0.0.0', () => {
  console.log(`School Chat Server listening at http://0.0.0.0:${PORT}`);
  
  // Background interval: purge expired auto-delete messages every 30 seconds
  setInterval(async () => {
    try {
      const purged = await DatabaseRepository.purgeExpiredMessages();
      if (purged > 0) {
        broadcast('chat:auto-purged', { purgedCount: purged });
      }
    } catch (e) {
      console.warn('Auto-purge interval error:', e);
    }
  }, 30000);
});

async function setupViteOrStatic() {
  // Seed default data asynchronously in background
  try {
    await DatabaseRepository.seedIfEmpty();
  } catch (e) {
    console.warn('Initial seed check error:', e);
  }

  if (process.env.NODE_ENV !== 'production') {
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      viteMiddleware = vite.middlewares;
      console.log('Vite middleware mounted successfully.');
    } catch (err) {
      console.error('Failed to create Vite server:', err);
    }
  } else {
    app.get('*', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Not Found');
      }
    });
  }
}

setupViteOrStatic();
