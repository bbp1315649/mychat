import { User, Group, Message } from '../types';
import { supabase } from './supabaseClient';

const API_BASE = '/api';

const isStaticHost = typeof window !== 'undefined' && (
  window.location.hostname.endsWith('github.io') ||
  window.location.hostname.endsWith('pages.dev') ||
  window.location.protocol === 'file:'
);

// Safe fetch wrapper that handles non-JSON / HTML / gateway responses gracefully
async function safeFetchJson<T = any>(url: string, options?: RequestInit, timeoutMs = 8000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      signal: options?.signal || controller.signal,
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('زمان انتظار ارتباط با سرور به پایان رسید. لطفاً مجدداً امتحان کنید.');
    }
    throw new Error('خطا در برقراری ارتباط با سرور. لطفاً اتصال اینترنت خود را بررسی نمایید.');
  } finally {
    clearTimeout(timer);
  }

  const contentType = res.headers.get('content-type') || '';
  let data: any = null;

  if (contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  } else {
    const text = await res.text().catch(() => '');
    if (!res.ok) {
      if (res.status === 502 || res.status === 503 || res.status === 504) {
        throw new Error('سرور در حال آماده‌سازی و اتصال به دیتابیس است؛ لطفاً چند ثانیه دیگر دوباره امتحان کنید.');
      }
      if (res.status === 404) {
        throw new Error('سرویس مورد نظر در سرور یافت نشد (404).');
      }
      throw new Error(`خطای سرور (${res.status}). لطفاً لحظاتی دیگر تلاش کنید.`);
    }
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const errorMsg = data?.error || data?.message || `خطای سرور (${res.status})`;
    throw new Error(errorMsg);
  }

  return data;
}

export const api = {
  // Auth
  async login(personnelCode: string, password: string): Promise<User> {
    if (isStaticHost) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('personnel_code', personnelCode)
        .single();

      if (error || !data) {
        throw new Error('کاربری با این کد پرسنلی یافت نشد.');
      }
      if (data.password !== password) {
        throw new Error('رمز عبور وارد شده نادرست است.');
      }
      return {
        id: data.id,
        personnelCode: data.personnel_code,
        mobile: data.mobile,
        fullName: data.full_name,
        subject: data.subject,
        role: data.role,
        avatar: data.avatar,
        password: data.password,
        isOnline: true,
        createdAt: data.created_at,
      };
    }

    try {
      const data = await safeFetchJson<{ success: boolean; user: User }>(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personnelCode, password }),
      });
      return data.user;
    } catch (err) {
      // Fallback to Supabase directly
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('personnel_code', personnelCode)
        .single();
      if (!error && data && data.password === password) {
        return {
          id: data.id,
          personnelCode: data.personnel_code,
          mobile: data.mobile,
          fullName: data.full_name,
          subject: data.subject,
          role: data.role,
          avatar: data.avatar,
          password: data.password,
          isOnline: true,
          createdAt: data.created_at,
        };
      }
      throw err;
    }
  },

  async register(params: {
    fullName: string;
    personnelCode: string;
    mobile: string;
    subject: string;
    role?: 'teacher' | 'deputy';
    password?: string;
  }): Promise<User> {
    if (isStaticHost) {
      const newId = 'u_' + Date.now();
      const role = params.role || 'teacher';
      const password = params.password || 'pass_' + Math.floor(100000 + Math.random() * 900000);
      const avatar = `https://images.unsplash.com/photo-${1535713875002 + Math.floor(Math.random() * 100)}?w=150&auto=format&fit=crop&q=80`;

      const { data, error } = await supabase
        .from('users')
        .insert({
          id: newId,
          personnel_code: params.personnelCode,
          mobile: params.mobile,
          full_name: params.fullName,
          subject: params.subject,
          role,
          avatar,
          password,
          is_online: true,
        })
        .select()
        .single();

      if (error || !data) {
        throw new Error(error?.message || 'خطا در ثبت کاربر در دیتابیس');
      }

      return {
        id: data.id,
        personnelCode: data.personnel_code,
        mobile: data.mobile,
        fullName: data.full_name,
        subject: data.subject,
        role: data.role,
        avatar: data.avatar,
        password: data.password,
        isOnline: true,
        createdAt: data.created_at,
      };
    }

    try {
      const data = await safeFetchJson<{ success: boolean; user: User }>(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      return data.user;
    } catch (err) {
      // Fallback direct register in Supabase
      const newId = 'u_' + Date.now();
      const role = params.role || 'teacher';
      const password = params.password || 'pass_' + Math.floor(100000 + Math.random() * 900000);
      const avatar = `https://images.unsplash.com/photo-1535713875002?w=150&auto=format&fit=crop&q=80`;

      const { data, error } = await supabase
        .from('users')
        .insert({
          id: newId,
          personnel_code: params.personnelCode,
          mobile: params.mobile,
          full_name: params.fullName,
          subject: params.subject,
          role,
          avatar,
          password,
          is_online: true,
        })
        .select()
        .single();

      if (!error && data) {
        return {
          id: data.id,
          personnelCode: data.personnel_code,
          mobile: data.mobile,
          fullName: data.full_name,
          subject: data.subject,
          role: data.role,
          avatar: data.avatar,
          password: data.password,
          isOnline: true,
          createdAt: data.created_at,
        };
      }
      throw err;
    }
  },

  // Users
  async getUsers(): Promise<User[]> {
    if (isStaticHost) {
      const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: true });
      if (error || !data) return [];
      return data.map((u: any) => ({
        id: u.id,
        personnelCode: u.personnel_code,
        mobile: u.mobile,
        fullName: u.full_name,
        subject: u.subject,
        role: u.role,
        avatar: u.avatar,
        password: u.password,
        isOnline: u.is_online ?? false,
        createdAt: u.created_at,
      }));
    }

    try {
      const data = await safeFetchJson<{ users: User[] }>(`${API_BASE}/users`);
      return data.users || [];
    } catch {
      // Fallback to Supabase
      const { data } = await supabase.from('users').select('*').order('created_at', { ascending: true });
      if (!data) return [];
      return data.map((u: any) => ({
        id: u.id,
        personnelCode: u.personnel_code,
        mobile: u.mobile,
        fullName: u.full_name,
        subject: u.subject,
        role: u.role,
        avatar: u.avatar,
        password: u.password,
        isOnline: u.is_online ?? false,
        createdAt: u.created_at,
      }));
    }
  },

  async updateProfile(userId: string, updates: {
    fullName?: string;
    personnelCode?: string;
    mobile?: string;
    subject?: string;
    avatar?: string;
    password?: string;
  }): Promise<User> {
    const dbUpdates: any = {};
    if (updates.fullName) dbUpdates.full_name = updates.fullName;
    if (updates.personnelCode) dbUpdates.personnel_code = updates.personnelCode;
    if (updates.mobile) dbUpdates.mobile = updates.mobile;
    if (updates.subject) dbUpdates.subject = updates.subject;
    if (updates.avatar) dbUpdates.avatar = updates.avatar;
    if (updates.password) dbUpdates.password = updates.password;

    const { data } = await supabase.from('users').update(dbUpdates).eq('id', userId).select().single();
    if (data) {
      return {
        id: data.id,
        personnelCode: data.personnel_code,
        mobile: data.mobile,
        fullName: data.full_name,
        subject: data.subject,
        role: data.role,
        avatar: data.avatar,
        password: data.password,
        isOnline: true,
        createdAt: data.created_at,
      };
    }

    const res = await safeFetchJson<{ success: boolean; user: User }>(`${API_BASE}/users/${userId}/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return res.user;
  },

  async resetPassword(userId: string, newPassword?: string): Promise<{ newPassword: string }> {
    const pass = newPassword || 'pass_' + Math.floor(100000 + Math.random() * 900000);
    await supabase.from('users').update({ password: pass }).eq('id', userId);
    return { newPassword: pass };
  },

  async deleteUser(userId: string, requestingUserId?: string): Promise<void> {
    await supabase.from('users').delete().eq('id', userId);
    if (!isStaticHost) {
      await safeFetchJson(`${API_BASE}/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestingUserId }),
      }).catch(() => {});
    }
  },

  // Groups
  async getGroups(userId?: string): Promise<Group[]> {
    if (isStaticHost) {
      const { data: gList } = await supabase.from('groups').select('*').order('created_at', { ascending: true });
      const { data: mList } = await supabase.from('group_members').select('*');

      if (!gList) return [];

      const result: Group[] = [];
      for (const g of gList) {
        const memberIds = (mList || []).filter((m: any) => m.group_id === g.id).map((m: any) => m.user_id);
        if (userId && !memberIds.includes(userId)) {
          continue;
        }
        result.push({
          id: g.id,
          name: g.name,
          description: g.description,
          avatar: g.avatar,
          memberIds,
          adminIds: [g.created_by || 'u_principal'],
          isAnnouncementOnly: g.is_announcement_only,
          autoDeleteHours: g.auto_delete_hours || 0,
          createdBy: g.created_by,
          createdAt: g.created_at,
        });
      }
      return result;
    }

    try {
      const url = userId ? `${API_BASE}/groups?userId=${userId}` : `${API_BASE}/groups`;
      const data = await safeFetchJson<{ groups: Group[] }>(url);
      return data.groups || [];
    } catch {
      const { data: gList } = await supabase.from('groups').select('*');
      const { data: mList } = await supabase.from('group_members').select('*');
      if (!gList) return [];
      return gList.map((g: any) => ({
        id: g.id,
        name: g.name,
        description: g.description,
        avatar: g.avatar,
        memberIds: (mList || []).filter((m: any) => m.group_id === g.id).map((m: any) => m.user_id),
        adminIds: [g.created_by || 'u_principal'],
        isAnnouncementOnly: g.is_announcement_only,
        autoDeleteHours: g.auto_delete_hours || 0,
        createdBy: g.created_by,
        createdAt: g.created_at,
      }));
    }
  },

  async createGroup(params: {
    name: string;
    description: string;
    memberIds: string[];
    isAnnouncementOnly?: boolean;
    autoDeleteHours?: number;
    avatar?: string;
  }): Promise<Group> {
    const newId = 'g_' + Date.now();
    const avatar = params.avatar || 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=150&auto=format&fit=crop&q=80';

    await supabase.from('groups').insert({
      id: newId,
      name: params.name,
      description: params.description,
      avatar,
      is_announcement_only: Boolean(params.isAnnouncementOnly),
      auto_delete_hours: params.autoDeleteHours || 0,
      created_by: 'u_principal',
    });

    const members = Array.from(new Set(['u_principal', ...params.memberIds]));
    for (const uid of members) {
      await supabase.from('group_members').insert({ group_id: newId, user_id: uid });
    }

    return {
      id: newId,
      name: params.name,
      description: params.description,
      avatar,
      memberIds: members,
      adminIds: ['u_principal'],
      isAnnouncementOnly: Boolean(params.isAnnouncementOnly),
      autoDeleteHours: params.autoDeleteHours || 0,
      createdBy: 'u_principal',
      createdAt: new Date().toISOString(),
    };
  },

  async updateGroupMembers(groupId: string, memberIds: string[]): Promise<Group> {
    await supabase.from('group_members').delete().eq('group_id', groupId);
    for (const uid of memberIds) {
      await supabase.from('group_members').insert({ group_id: groupId, user_id: uid });
    }
    const { data: g } = await supabase.from('groups').select('*').eq('id', groupId).single();
    return {
      id: g.id,
      name: g.name,
      description: g.description,
      avatar: g.avatar,
      memberIds,
      adminIds: [g.created_by || 'u_principal'],
      isAnnouncementOnly: g.is_announcement_only,
      autoDeleteHours: g.auto_delete_hours || 0,
      createdBy: g.created_by,
      createdAt: g.created_at,
    };
  },

  async removeGroupMember(groupId: string, userId: string): Promise<string[]> {
    await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId);
    const { data: mList } = await supabase.from('group_members').select('user_id').eq('group_id', groupId);
    return (mList || []).map((m: any) => m.user_id);
  },

  async deleteGroup(groupId: string): Promise<void> {
    await supabase.from('groups').delete().eq('id', groupId);
  },

  // Messages
  async getMessages(chatId: string): Promise<Message[]> {
    if (!chatId || !chatId.trim()) return [];

    const { data: msgs } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId.trim())
      .order('created_at', { ascending: true });

    const { data: rxList } = await supabase.from('message_reactions').select('*');

    if (!msgs) return [];

    return msgs.map((m: any) => {
      const d = m.created_at ? new Date(m.created_at) : new Date();
      const timeStr = d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

      const msgRx = (rxList || []).filter((r: any) => r.message_id === m.id);
      const reactions: Record<string, string[]> = {};
      for (const r of msgRx) {
        if (!reactions[r.emoji]) reactions[r.emoji] = [];
        reactions[r.emoji].push(r.user_id);
      }

      return {
        id: m.id,
        chatId: m.chat_id,
        senderId: m.sender_id,
        senderName: m.sender_name,
        senderRole: m.sender_role as any,
        senderAvatar: m.sender_avatar,
        content: m.content,
        type: m.type as any,
        timestamp: timeStr,
        fileUrl: m.file_url,
        fileName: m.file_name,
        voiceDuration: m.voice_duration,
        videoDuration: m.video_duration,
        voiceTranscript: m.voice_transcript,
        isVoiceTranscribed: m.is_voice_transcribed,
        isVoiceTranslated: m.is_voice_translated,
        originalSpokenText: m.original_spoken_text,
        isPinned: m.is_pinned || false,
        reactions,
        readBy: [m.sender_id],
        replyTo: m.reply_to_id ? {
          id: m.reply_to_id,
          content: m.reply_to_content || '',
          senderName: m.reply_to_sender || '',
        } : undefined,
      };
    });
  },

  async sendMessage(params: {
    chatId: string;
    senderId: string;
    content: string;
    type?: 'text' | 'image' | 'video' | 'voice' | 'file' | 'announcement';
    fileUrl?: string;
    fileName?: string;
    fileSize?: string;
    voiceDuration?: number;
    videoDuration?: number;
    voiceTranscript?: string;
    isVoiceTranscribed?: boolean;
    isVoiceTranslated?: boolean;
    originalSpokenText?: string;
    replyTo?: { id: string; senderName: string; content: string };
  }): Promise<Message> {
    const newId = 'm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const createdAt = new Date().toISOString();

    // Get sender info
    const { data: sender } = await supabase.from('users').select('*').eq('id', params.senderId).single();

    const insertData: any = {
      id: newId,
      chat_id: params.chatId,
      sender_id: params.senderId,
      sender_name: sender?.full_name || 'کاربر',
      sender_role: sender?.role || 'teacher',
      sender_avatar: sender?.avatar || 'https://images.unsplash.com/photo-1535713875002?w=150&auto=format&fit=crop&q=80',
      content: params.content,
      type: params.type || 'text',
      file_url: params.fileUrl,
      file_name: params.fileName,
      voice_duration: params.voiceDuration,
      video_duration: params.videoDuration,
      voice_transcript: params.voiceTranscript,
      is_voice_transcribed: params.isVoiceTranscribed || false,
      is_voice_translated: params.isVoiceTranslated || false,
      original_spoken_text: params.originalSpokenText,
      is_pinned: false,
      reply_to_id: params.replyTo?.id,
      reply_to_content: params.replyTo?.content,
      reply_to_sender: params.replyTo?.senderName,
      created_at: createdAt,
    };

    await supabase.from('messages').insert(insertData);

    const d = new Date(createdAt);
    const timeStr = d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

    return {
      id: newId,
      chatId: params.chatId,
      senderId: params.senderId,
      senderName: insertData.sender_name,
      senderRole: insertData.sender_role,
      senderAvatar: insertData.sender_avatar,
      content: params.content,
      type: insertData.type,
      timestamp: timeStr,
      fileUrl: params.fileUrl,
      fileName: params.fileName,
      voiceDuration: params.voiceDuration,
      videoDuration: params.videoDuration,
      voiceTranscript: params.voiceTranscript,
      isVoiceTranscribed: params.isVoiceTranscribed,
      isVoiceTranslated: params.isVoiceTranslated,
      originalSpokenText: params.originalSpokenText,
      isPinned: false,
      reactions: {},
      readBy: [params.senderId],
      replyTo: params.replyTo,
    };
  },

  async togglePinMessage(messageId: string): Promise<boolean> {
    const { data: m } = await supabase.from('messages').select('is_pinned').eq('id', messageId).single();
    const newPinned = !m?.is_pinned;
    await supabase.from('messages').update({ is_pinned: newPinned }).eq('id', messageId);
    return newPinned;
  },

  async reactToMessage(messageId: string, userId: string, emoji: string): Promise<Record<string, string[]>> {
    const { data: existing } = await supabase
      .from('message_reactions')
      .select('id')
      .eq('message_id', messageId)
      .eq('user_id', userId)
      .eq('emoji', emoji)
      .maybeSingle();

    if (existing) {
      await supabase.from('message_reactions').delete().eq('id', existing.id);
    } else {
      await supabase.from('message_reactions').insert({
        message_id: messageId,
        user_id: userId,
        emoji,
      });
    }

    const { data: rxList } = await supabase.from('message_reactions').select('*').eq('message_id', messageId);
    const reactions: Record<string, string[]> = {};
    for (const r of rxList || []) {
      if (!reactions[r.emoji]) reactions[r.emoji] = [];
      reactions[r.emoji].push(r.user_id);
    }
    return reactions;
  },

  async deleteMessage(messageId: string, userId: string): Promise<void> {
    await supabase.from('messages').delete().eq('id', messageId);
  },

  async clearChatHistory(chatId: string, userId: string): Promise<{ success: boolean; deletedCount: number }> {
    const { count } = await supabase.from('messages').select('*', { count: 'exact', head: true }).eq('chat_id', chatId);
    await supabase.from('messages').delete().eq('chat_id', chatId);
    return { success: true, deletedCount: count || 0 };
  },

  async setGroupAutoDelete(groupId: string, autoDeleteHours: number, userId: string): Promise<{ success: boolean; autoDeleteHours: number }> {
    await supabase.from('groups').update({ auto_delete_hours: autoDeleteHours }).eq('id', groupId);
    return { success: true, autoDeleteHours };
  },

  async translate(text: string, targetLang: 'en' | 'fa' = 'en', sourceLang?: 'en' | 'fa'): Promise<{
    success: boolean;
    originalText: string;
    translatedText: string;
    sourceLang: string;
    targetLang: string;
    engine?: string;
  }> {
    if (isStaticHost) {
      return {
        success: true,
        originalText: text,
        translatedText: text,
        sourceLang: sourceLang || 'fa',
        targetLang,
        engine: 'client-fallback',
      };
    }

    return safeFetchJson<{
      success: boolean;
      originalText: string;
      translatedText: string;
      sourceLang: string;
      targetLang: string;
      engine?: string;
    }>(`${API_BASE}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, targetLang, sourceLang }),
    });
  },
};

// Real-time Supabase & WebSocket manager
export class RealtimeClient {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private isConnecting = false;
  private reconnectTimer: any = null;
  private supabaseChannel: any = null;

  connect() {
    if (isStaticHost) {
      if (!this.supabaseChannel) {
        this.supabaseChannel = supabase
          .channel('public_chat_realtime')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
            const m = payload.new as any;
            const d = m.created_at ? new Date(m.created_at) : new Date();
            const timeStr = d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
            this.emit('message:new', {
              id: m.id,
              chatId: m.chat_id,
              senderId: m.sender_id,
              senderName: m.sender_name,
              senderRole: m.sender_role,
              senderAvatar: m.sender_avatar,
              content: m.content,
              type: m.type,
              timestamp: timeStr,
              fileUrl: m.file_url,
              fileName: m.file_name,
              voiceDuration: m.voice_duration,
              videoDuration: m.video_duration,
              voiceTranscript: m.voice_transcript,
              isVoiceTranscribed: m.is_voice_transcribed,
              isVoiceTranslated: m.is_voice_translated,
              originalSpokenText: m.original_spoken_text,
              isPinned: m.is_pinned || false,
              reactions: {},
              readBy: [m.sender_id],
              replyTo: m.reply_to_id ? {
                id: m.reply_to_id,
                content: m.reply_to_content || '',
                senderName: m.reply_to_sender || '',
              } : undefined,
            });
          })
          .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
            this.emit('message:deleted', { messageId: payload.old?.id, chatId: payload.old?.chat_id });
          })
          .subscribe();
      }
      return;
    }

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.isConnecting = true;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnecting = false;
        console.log('WebSocket connected to School Chat Server');
      };

      this.ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          const { type, data } = parsed;
          if (type && this.listeners.has(type)) {
            this.listeners.get(type)!.forEach((cb) => cb(data));
          }
        } catch (e) {
          // ignore non-json messages
        }
      };

      this.ws.onclose = () => {
        this.isConnecting = false;
        this.ws = null;
        if (!this.reconnectTimer) {
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
          }, 3000);
        }
      };

      this.ws.onerror = () => {
        // Socket error
      };
    } catch (err) {
      this.isConnecting = false;
    }
  }

  private emit(eventType: string, data: any) {
    if (this.listeners.has(eventType)) {
      this.listeners.get(eventType)!.forEach(cb => cb(data));
    }
  }

  on(eventType: string, callback: (data: any) => void) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);

    return () => {
      this.listeners.get(eventType)?.delete(callback);
    };
  }

  disconnect() {
    if (this.supabaseChannel) {
      supabase.removeChannel(this.supabaseChannel);
      this.supabaseChannel = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const realtime = new RealtimeClient();
