import { User, Group, Message } from '../types';

const API_BASE = '/api';

// Safe fetch wrapper that handles non-JSON / HTML / gateway responses gracefully
async function safeFetchJson<T = any>(url: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, options);
  } catch (err: any) {
    throw new Error('خطا در برقراری ارتباط با سرور. لطفاً اتصال اینترنت خود را بررسی نمایید.');
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
    // Non-JSON response (e.g., HTML from proxy/gateway or server restarting)
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
    const data = await safeFetchJson<{ success: boolean; user: User }>(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personnelCode, password }),
    });
    return data.user;
  },

  async register(params: {
    fullName: string;
    personnelCode: string;
    mobile: string;
    subject: string;
    role?: 'teacher' | 'deputy';
    password?: string;
  }): Promise<User> {
    const data = await safeFetchJson<{ success: boolean; user: User }>(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return data.user;
  },

  // Users
  async getUsers(): Promise<User[]> {
    const data = await safeFetchJson<{ users: User[] }>(`${API_BASE}/users`);
    return data.users || [];
  },

  async updateProfile(userId: string, updates: {
    fullName?: string;
    personnelCode?: string;
    mobile?: string;
    subject?: string;
    avatar?: string;
    password?: string;
  }): Promise<User> {
    const data = await safeFetchJson<{ success: boolean; user: User }>(`${API_BASE}/users/${userId}/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return data.user;
  },

  async resetPassword(userId: string, newPassword?: string): Promise<{ newPassword: string }> {
    const data = await safeFetchJson<{ newPassword: string }>(`${API_BASE}/admin/users/${userId}/password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword }),
    });
    return data;
  },

  async deleteUser(userId: string, requestingUserId?: string): Promise<void> {
    await safeFetchJson(`${API_BASE}/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestingUserId }),
    });
  },

  // Groups
  async getGroups(userId?: string): Promise<Group[]> {
    const url = userId ? `${API_BASE}/groups?userId=${userId}` : `${API_BASE}/groups`;
    const data = await safeFetchJson<{ groups: Group[] }>(url);
    return data.groups || [];
  },

  async createGroup(params: {
    name: string;
    description: string;
    memberIds: string[];
    isAnnouncementOnly?: boolean;
    avatar?: string;
  }): Promise<Group> {
    const data = await safeFetchJson<{ success: boolean; group: Group }>(`${API_BASE}/admin/groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return data.group;
  },

  async updateGroupMembers(groupId: string, memberIds: string[]): Promise<Group> {
    const data = await safeFetchJson<{ success: boolean; group: Group }>(`${API_BASE}/admin/groups/${groupId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberIds }),
    });
    return data.group;
  },

  async removeGroupMember(groupId: string, userId: string): Promise<string[]> {
    const data = await safeFetchJson<{ success: boolean; memberIds: string[] }>(
      `${API_BASE}/admin/groups/${groupId}/members/${userId}`,
      {
        method: 'DELETE',
      }
    );
    return data.memberIds;
  },

  async deleteGroup(groupId: string): Promise<void> {
    await safeFetchJson(`${API_BASE}/admin/groups/${groupId}`, {
      method: 'DELETE',
    });
  },

  // Messages
  async getMessages(chatId: string): Promise<Message[]> {
    if (!chatId || !chatId.trim()) {
      return [];
    }
    const data = await safeFetchJson<{ messages: Message[] }>(`${API_BASE}/messages/${encodeURIComponent(chatId.trim())}`);
    return data.messages || [];
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
    replyTo?: { id: string; senderName: string; content: string };
  }): Promise<Message> {
    const data = await safeFetchJson<{ success: boolean; message: Message }>(`${API_BASE}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return data.message;
  },

  async togglePinMessage(messageId: string): Promise<boolean> {
    const data = await safeFetchJson<{ success: boolean; isPinned: boolean }>(`${API_BASE}/messages/${messageId}/pin`, {
      method: 'POST',
    });
    return data.isPinned;
  },

  async reactToMessage(messageId: string, userId: string, emoji: string): Promise<Record<string, string[]>> {
    const data = await safeFetchJson<{ success: boolean; reactions: Record<string, string[]> }>(`${API_BASE}/messages/${messageId}/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, emoji }),
    });
    return data.reactions;
  },

  async deleteMessage(messageId: string, userId: string): Promise<void> {
    await safeFetchJson<{ success: boolean }>(`${API_BASE}/messages/${messageId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
  },
};

// Real-time WebSocket manager
export class RealtimeClient {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private isConnecting = false;
  private reconnectTimer: any = null;

  connect() {
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
        // Schedule auto-reconnect
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
