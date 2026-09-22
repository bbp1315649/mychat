import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { DatabaseRepository } from './src/db/repository';

const PORT = 3000;
const app = express();
app.use(express.json({ limit: '10mb' }));

// ----------------------------------------------------
// WebSocket Real-Time Broadcaster
// ----------------------------------------------------
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

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
  ws.send(JSON.stringify({ type: 'connected', data: { timestamp: new Date().toISOString() } }));

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
    const { name, description, memberIds = [], isAnnouncementOnly = false, avatar } = req.body;

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
    const { chatId, senderId, content, type = 'text', fileUrl, fileName, voiceDuration, replyTo } = req.body;

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
async function setupViteOrStatic() {
  // Seed default data if database is fresh
  try {
    await DatabaseRepository.seedIfEmpty();
  } catch (e) {
    console.warn('Initial seed check error:', e);
  }

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`School Chat Server with Cloud SQL running at http://0.0.0.0:${PORT}`);
  });
}

setupViteOrStatic();
