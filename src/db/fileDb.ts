import fs from 'fs';
import path from 'path';
import { User, Group, Message } from '../types';

export interface DbSchema {
  users: Array<{
    id: string;
    personnelCode: string;
    mobile: string;
    fullName: string;
    subject: string;
    role: 'principal' | 'deputy' | 'teacher';
    avatar: string;
    password?: string;
    isOnline?: boolean;
    createdAt: string;
  }>;
  groups: Array<{
    id: string;
    name: string;
    description: string;
    avatar: string;
    isAnnouncementOnly: boolean;
    createdBy: string;
    createdAt: string;
  }>;
  groupMembers: Array<{
    groupId: string;
    userId: string;
  }>;
  messages: Array<{
    id: string;
    chatId: string;
    senderId: string;
    senderName: string;
    senderRole: string;
    senderAvatar: string;
    content: string;
    type: 'text' | 'image' | 'voice' | 'file' | 'announcement' | 'circular';
    fileUrl?: string;
    fileName?: string;
    voiceDuration?: number;
    isPinned: boolean;
    replyToId?: string;
    replyToContent?: string;
    replyToSender?: string;
    createdAt: string;
  }>;
  reactions: Array<{
    id: string;
    messageId: string;
    userId: string;
    emoji: string;
  }>;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'school_database.json');

const INITIAL_DATA: DbSchema = {
  users: [
    {
      id: 'u_principal',
      personnelCode: '10001356',
      mobile: '09121112233',
      fullName: 'دکتر محمد رضایی (مدیر مدرسه)',
      subject: 'مدیر آموزشگاه',
      role: 'principal',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      password: 'bbp13156',
      isOnline: true,
      createdAt: '2026-09-20T21:46:42.373Z',
    },
    {
      id: 'u_deputy',
      personnelCode: '10002244',
      mobile: '09122223344',
      fullName: 'مهندس علیرضا حسینی (معاون)',
      subject: 'معاونت آموزشی و پرورشی',
      role: 'deputy',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      password: 'deputy_pass_99',
      isOnline: false,
      createdAt: '2026-09-20T21:46:42.381Z',
    },
    {
      id: 'u_101',
      personnelCode: '10003355',
      mobile: '09123334455',
      fullName: 'استاد حمید کاویانی',
      subject: 'دبیر ریاضیات و هندسه',
      role: 'teacher',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
      password: 'math_pass_123',
      isOnline: true,
      createdAt: '2026-09-20T21:46:42.386Z',
    },
    {
      id: 'u_102',
      personnelCode: '10004466',
      mobile: '09124445566',
      fullName: 'سرکار خانم مریم سعیدی',
      subject: 'دبیر زبان و ادبیات فارسی',
      role: 'teacher',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
      password: 'lit_pass_456',
      isOnline: false,
      createdAt: '2026-09-20T21:46:42.390Z',
    },
    {
      id: 'u_103',
      personnelCode: '10005577',
      mobile: '09125556677',
      fullName: 'دکتر بهزاد احمدی',
      subject: 'دبیر فیزیک و آزمایشگاه',
      role: 'teacher',
      avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
      password: 'phys_pass_789',
      isOnline: true,
      createdAt: '2026-09-20T21:46:42.395Z',
    },
    {
      id: 'u_1789941860655_racj',
      personnelCode: '11223344',
      mobile: '09121234567',
      fullName: 'تست دبیر',
      subject: 'ریاضی',
      role: 'teacher',
      avatar: 'https://images.unsplash.com/photo-1535713875096?w=150&auto=format&fit=crop&q=80',
      password: 'pass_863225',
      isOnline: true,
      createdAt: '2026-09-20T22:04:20.658Z',
    },
    {
      id: 'u_1789941962462_hqly',
      personnelCode: '56781123',
      mobile: '09129998877',
      fullName: 'استاد سهرابی',
      subject: 'شیمی',
      role: 'teacher',
      avatar: 'https://images.unsplash.com/photo-1535713875063?w=150&auto=format&fit=crop&q=80',
      password: 'pass_434074',
      isOnline: true,
      createdAt: '2026-09-20T22:06:02.465Z',
    },
    {
      id: 'u_1789942426994_d344',
      personnelCode: '44556677',
      mobile: '09191112233',
      fullName: 'دبیر فیزیک ۲',
      subject: 'فیزیک',
      role: 'teacher',
      avatar: 'https://images.unsplash.com/photo-1535713875086?w=150&auto=format&fit=crop&q=80',
      password: 'pass_754880',
      isOnline: true,
      createdAt: '2026-09-20T22:13:46.997Z',
    },
  ],
  groups: [
    {
      id: 'g_announcements',
      name: 'کانال رسمی بخشنامه‌ها و اعلانات',
      description: 'کانال ارسال فوری مصوبات، بخشنامه‌های اداری و اطلاعیه‌های رسمی مدرسه',
      avatar: 'https://images.unsplash.com/photo-1577495508048-b635879837f1?w=150&auto=format&fit=crop&q=80',
      isAnnouncementOnly: true,
      createdBy: 'u_principal',
      createdAt: '2026-09-20T21:46:42.400Z',
    },
    {
      id: 'g_all_teachers',
      name: 'شورای عمومی معلمان و دبیران',
      description: 'اتاق هم‌اندیشی و گفتگوی عمومی تمامی همکاران آموزشی و اداری',
      avatar: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=150&auto=format&fit=crop&q=80',
      isAnnouncementOnly: false,
      createdBy: 'u_principal',
      createdAt: '2026-09-20T21:46:42.405Z',
    },
    {
      id: 'g_science_dept',
      name: 'گروه آموزشی علوم پایه و ریاضی',
      description: 'هماهنگی آزمون‌ها، طرح درس و امتحانات هماهنگ دروس تخصصی',
      avatar: 'https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?w=150&auto=format&fit=crop&q=80',
      isAnnouncementOnly: false,
      createdBy: 'u_principal',
      createdAt: '2026-09-20T21:46:42.410Z',
    },
  ],
  groupMembers: [
    { groupId: 'g_announcements', userId: 'u_principal' },
    { groupId: 'g_announcements', userId: 'u_deputy' },
    { groupId: 'g_announcements', userId: 'u_101' },
    { groupId: 'g_announcements', userId: 'u_102' },
    { groupId: 'g_announcements', userId: 'u_103' },
    { groupId: 'g_announcements', userId: 'u_1789941860655_racj' },
    { groupId: 'g_announcements', userId: 'u_1789941962462_hqly' },
    { groupId: 'g_announcements', userId: 'u_1789942426994_d344' },

    { groupId: 'g_all_teachers', userId: 'u_principal' },
    { groupId: 'g_all_teachers', userId: 'u_deputy' },
    { groupId: 'g_all_teachers', userId: 'u_101' },
    { groupId: 'g_all_teachers', userId: 'u_102' },
    { groupId: 'g_all_teachers', userId: 'u_103' },
    { groupId: 'g_all_teachers', userId: 'u_1789941860655_racj' },
    { groupId: 'g_all_teachers', userId: 'u_1789941962462_hqly' },
    { groupId: 'g_all_teachers', userId: 'u_1789942426994_d344' },

    { groupId: 'g_science_dept', userId: 'u_principal' },
    { groupId: 'g_science_dept', userId: 'u_101' },
    { groupId: 'g_science_dept', userId: 'u_103' },
    { groupId: 'g_science_dept', userId: 'u_1789941860655_racj' },
    { groupId: 'g_science_dept', userId: 'u_1789941962462_hqly' },
    { groupId: 'g_science_dept', userId: 'u_1789942426994_d344' },
  ],
  messages: [
    {
      id: 'm_1',
      chatId: 'g_announcements',
      senderId: 'u_principal',
      senderName: 'دکتر محمد رضایی (مدیر مدرسه)',
      senderRole: 'principal',
      senderAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      content: 'همکاران گرامی و دبیران ارجمند، با سلام و آرزوی توفیق؛ لطفاً نمرات مستمر ماهانه را تا پایان هفته جاری در سامانه ثبت فرمایید.',
      type: 'circular',
      isPinned: true,
      createdAt: '2026-09-20T21:46:42.420Z',
    },
    {
      id: 'm_2',
      chatId: 'g_all_teachers',
      senderId: 'u_principal',
      senderName: 'دکتر محمد رضایی (مدیر مدرسه)',
      senderRole: 'principal',
      senderAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      content: 'جلسه شورای معلمان روز سه‌شنبه ساعت ۱۲:۳۰ در محل سالن اجتماعات برگزار خواهد شد.',
      type: 'text',
      isPinned: false,
      createdAt: '2026-09-20T21:46:42.425Z',
    },
    {
      id: 'm_3',
      chatId: 'g_all_teachers',
      senderId: 'u_101',
      senderName: 'استاد حمید کاویانی',
      senderRole: 'teacher',
      senderAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
      content: 'سلام جناب دکتر رضایی، هماهنگی‌های گروه ریاضی انجام شده و گزارش پیشرفت دروس آماده ارائه می‌باشد.',
      type: 'text',
      isPinned: false,
      createdAt: '2026-09-20T21:46:42.430Z',
    },
  ],
  reactions: [],
};

class FileDatabaseEngine {
  private data: DbSchema;

  constructor() {
    this.data = this.loadOrInit();
  }

  private loadOrInit(): DbSchema {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw) as DbSchema;
        if (parsed.users && parsed.groups && parsed.messages) {
          return parsed;
        }
      }

      // Write initial default data
      this.persistDirect(INITIAL_DATA);
      return JSON.parse(JSON.stringify(INITIAL_DATA));
    } catch (e) {
      console.warn('FileDatabase initialization warning, fallback to memory copy:', e);
      return JSON.parse(JSON.stringify(INITIAL_DATA));
    }
  }

  private persistDirect(data: DbSchema) {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const tmpFile = `${DB_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tmpFile, DB_FILE);
    } catch (e) {
      console.error('Failed to write to database file:', e);
    }
  }

  private save() {
    this.persistDirect(this.data);
  }

  // --- Methods ---

  public seedIfEmpty() {
    if (!this.data.users || this.data.users.length === 0) {
      this.data = JSON.parse(JSON.stringify(INITIAL_DATA));
      this.save();
    }
  }

  public getAllUsers(): User[] {
    return this.data.users.map(u => ({
      id: u.id,
      personnelCode: u.personnelCode,
      mobile: u.mobile,
      fullName: u.fullName,
      subject: u.subject,
      role: u.role,
      avatar: u.avatar,
      password: u.password || 'pass_123456',
      isOnline: u.isOnline || false,
      createdAt: u.createdAt,
    }));
  }

  public findUserByPersonnelCode(code: string): User | null {
    const u = this.data.users.find(user => user.personnelCode === code);
    if (!u) return null;
    return {
      id: u.id,
      personnelCode: u.personnelCode,
      mobile: u.mobile,
      fullName: u.fullName,
      subject: u.subject,
      role: u.role,
      avatar: u.avatar,
      password: u.password || 'pass_123456',
      isOnline: u.isOnline || false,
      createdAt: u.createdAt,
    };
  }

  public findUserById(id: string): User | null {
    const u = this.data.users.find(user => user.id === id);
    if (!u) return null;
    return {
      id: u.id,
      personnelCode: u.personnelCode,
      mobile: u.mobile,
      fullName: u.fullName,
      subject: u.subject,
      role: u.role,
      avatar: u.avatar,
      password: u.password || 'pass_123456',
      isOnline: u.isOnline || false,
      createdAt: u.createdAt,
    };
  }

  public createUser(userData: {
    personnelCode: string;
    mobile: string;
    fullName: string;
    subject: string;
    role?: 'principal' | 'deputy' | 'teacher';
    avatar?: string;
    password?: string;
  }): User {
    const newId = 'u_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const role = userData.role || 'teacher';
    const password = userData.password || 'pass_' + Math.floor(100000 + Math.random() * 900000);
    const avatar = userData.avatar || `https://images.unsplash.com/photo-${1535713875002 + Math.floor(Math.random() * 100)}?w=150&auto=format&fit=crop&q=80`;
    const createdAt = new Date().toISOString();

    const newUser = {
      id: newId,
      personnelCode: userData.personnelCode,
      mobile: userData.mobile,
      fullName: userData.fullName,
      subject: userData.subject,
      role,
      avatar,
      password,
      isOnline: true,
      createdAt,
    };

    this.data.users.push(newUser);

    // Newly registered users are NOT automatically enrolled in groups.
    // Membership must be intentionally designated and approved by the school principal.

    this.save();
    return newUser;
  }

  public deleteUser(userId: string): boolean {
    const u = this.data.users.find(user => user.id === userId);
    if (!u) return false;
    // Security: Principal account cannot be deleted
    if (u.role === 'principal') return false;

    // Remove user record
    this.data.users = this.data.users.filter(user => user.id !== userId);
    // Remove user from all groups
    this.data.groupMembers = this.data.groupMembers.filter(m => m.userId !== userId);
    // Remove user's reactions
    this.data.reactions = this.data.reactions.filter(r => r.userId !== userId);

    this.save();
    return true;
  }

  public removeGroupMember(groupId: string, userId: string): string[] {
    const u = this.data.users.find(user => user.id === userId);
    // Principal cannot be removed from school groups
    if (u?.role === 'principal') {
      return this.data.groupMembers.filter(m => m.groupId === groupId).map(m => m.userId);
    }

    this.data.groupMembers = this.data.groupMembers.filter(
      m => !(m.groupId === groupId && m.userId === userId)
    );
    this.save();
    return this.data.groupMembers.filter(m => m.groupId === groupId).map(m => m.userId);
  }

  public updatePassword(userId: string, newPass: string): boolean {
    const u = this.data.users.find(user => user.id === userId);
    if (!u) return false;
    u.password = newPass;
    this.save();
    return true;
  }

  public getGroups(userId?: string): Group[] {
    const result: Group[] = [];
    for (const g of this.data.groups) {
      const memberIds = this.data.groupMembers
        .filter(m => m.groupId === g.id)
        .map(m => m.userId);

      if (userId && !memberIds.includes(userId)) {
        continue;
      }

      result.push({
        id: g.id,
        name: g.name,
        description: g.description,
        avatar: g.avatar,
        memberIds,
        adminIds: [g.createdBy || 'u_principal'],
        isAnnouncementOnly: g.isAnnouncementOnly,
        createdBy: g.createdBy,
        createdAt: g.createdAt,
      });
    }
    return result;
  }

  public createGroup(groupData: {
    name: string;
    description?: string;
    avatar?: string;
    memberIds?: string[];
    isAnnouncementOnly?: boolean;
    createdBy: string;
  }): Group {
    const newId = 'g_' + Date.now();
    const avatar = groupData.avatar || 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=150&auto=format&fit=crop&q=80';
    const createdAt = new Date().toISOString();

    const newGroup = {
      id: newId,
      name: groupData.name,
      description: groupData.description || 'گروه گفتگوی کادر مدرسه',
      avatar,
      isAnnouncementOnly: Boolean(groupData.isAnnouncementOnly),
      createdBy: groupData.createdBy,
      createdAt,
    };

    this.data.groups.push(newGroup);

    const members = Array.from(new Set([groupData.createdBy, ...(groupData.memberIds || [])]));
    for (const uid of members) {
      this.data.groupMembers.push({ groupId: newId, userId: uid });
    }

    this.save();

    return {
      id: newGroup.id,
      name: newGroup.name,
      description: newGroup.description,
      avatar: newGroup.avatar,
      memberIds: members,
      adminIds: [groupData.createdBy],
      isAnnouncementOnly: newGroup.isAnnouncementOnly,
      createdBy: newGroup.createdBy,
      createdAt: newGroup.createdAt,
    };
  }

  public updateGroupMembers(groupId: string, memberIds: string[]): string[] {
    // Remove old memberships for this group
    this.data.groupMembers = this.data.groupMembers.filter(m => m.groupId !== groupId);

    // Add new memberships
    for (const uid of memberIds) {
      this.data.groupMembers.push({ groupId, userId: uid });
    }

    this.save();
    return memberIds;
  }

  public deleteGroup(groupId: string): boolean {
    this.data.groups = this.data.groups.filter(g => g.id !== groupId);
    this.data.groupMembers = this.data.groupMembers.filter(m => m.groupId !== groupId);
    this.data.messages = this.data.messages.filter(m => m.chatId !== groupId);
    this.save();
    return true;
  }

  public getMessages(chatId: string): Message[] {
    const msgs = this.data.messages.filter(m => m.chatId === chatId);

    // Build reactions map
    return msgs.map(m => {
      const d = m.createdAt ? new Date(m.createdAt) : new Date();
      const timeStr = d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

      const rxList = this.data.reactions.filter(r => r.messageId === m.id);
      const reactions: Record<string, string[]> = {};
      for (const r of rxList) {
        if (!reactions[r.emoji]) reactions[r.emoji] = [];
        reactions[r.emoji].push(r.userId);
      }

      return {
        id: m.id,
        chatId: m.chatId,
        senderId: m.senderId,
        senderName: m.senderName,
        senderRole: m.senderRole as any,
        senderAvatar: m.senderAvatar,
        content: m.content,
        type: m.type as any,
        timestamp: timeStr,
        fileUrl: m.fileUrl,
        fileName: m.fileName,
        voiceDuration: m.voiceDuration,
        isPinned: m.isPinned || false,
        reactions,
        readBy: [m.senderId],
        replyTo: m.replyToId ? {
          id: m.replyToId,
          content: m.replyToContent || '',
          senderName: m.replyToSender || '',
        } : undefined,
      };
    });
  }

  public insertMessage(msg: {
    chatId: string;
    senderId: string;
    senderName: string;
    senderRole: string;
    senderAvatar: string;
    content: string;
    type?: 'text' | 'image' | 'voice' | 'file' | 'announcement' | 'circular';
    fileUrl?: string;
    fileName?: string;
    voiceDuration?: number;
    replyTo?: { id: string; content: string; senderName: string };
  }): Message {
    const newId = 'm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5);
    const createdAt = new Date().toISOString();

    const newMsg = {
      id: newId,
      chatId: msg.chatId,
      senderId: msg.senderId,
      senderName: msg.senderName,
      senderRole: msg.senderRole,
      senderAvatar: msg.senderAvatar,
      content: msg.content || '',
      type: msg.type || 'text',
      fileUrl: msg.fileUrl,
      fileName: msg.fileName,
      voiceDuration: msg.voiceDuration,
      isPinned: false,
      replyToId: msg.replyTo?.id,
      replyToContent: msg.replyTo?.content,
      replyToSender: msg.replyTo?.senderName,
      createdAt,
    };

    this.data.messages.push(newMsg);
    this.save();

    const d = new Date(createdAt);
    const timeStr = d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

    return {
      id: newMsg.id,
      chatId: newMsg.chatId,
      senderId: newMsg.senderId,
      senderName: newMsg.senderName,
      senderRole: newMsg.senderRole as any,
      senderAvatar: newMsg.senderAvatar,
      content: newMsg.content,
      type: newMsg.type as any,
      timestamp: timeStr,
      fileUrl: newMsg.fileUrl,
      fileName: newMsg.fileName,
      voiceDuration: newMsg.voiceDuration,
      isPinned: false,
      reactions: {},
      readBy: [newMsg.senderId],
      replyTo: msg.replyTo,
    };
  }

  public togglePin(messageId: string): boolean {
    const m = this.data.messages.find(msg => msg.id === messageId);
    if (!m) return false;
    m.isPinned = !m.isPinned;
    this.save();
    return m.isPinned;
  }

  public reactToMessage(messageId: string, userId: string, emoji: string): Record<string, string[]> {
    const existingIdx = this.data.reactions.findIndex(
      r => r.messageId === messageId && r.userId === userId && r.emoji === emoji
    );

    if (existingIdx >= 0) {
      this.data.reactions.splice(existingIdx, 1);
    } else {
      this.data.reactions.push({
        id: 'rx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
        messageId,
        userId,
        emoji,
      });
    }

    this.save();

    const rxList = this.data.reactions.filter(r => r.messageId === messageId);
    const reactions: Record<string, string[]> = {};
    for (const r of rxList) {
      if (!reactions[r.emoji]) reactions[r.emoji] = [];
      reactions[r.emoji].push(r.userId);
    }
    return reactions;
  }
}

export const fileDb = new FileDatabaseEngine();
