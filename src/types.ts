export type UserRole = 'principal' | 'deputy' | 'teacher';

export interface User {
  id: string;
  fullName: string;
  personnelCode: string; // Exactly 8 digits
  mobile: string; // e.g. 09123456789
  role: UserRole;
  subject: string; // e.g. 'مدیر آموزشگاه', 'ریاضی و هندسه', 'ادبیات فارسی'
  avatar: string;
  password: string; // Plaintext visible to Principal per requirement
  createdAt: string;
  isOnline: boolean;
  lastSeen?: string;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  avatar: string;
  createdBy: string;
  memberIds: string[];
  adminIds: string[];
  isAnnouncementOnly?: boolean; // Only principal/admin can post
  createdAt: string;
}

export interface MessageReaction {
  emoji: string;
  userIds: string[];
}

export interface Message {
  id: string;
  chatId: string; // groupId or 'direct_user1_user2'
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  senderAvatar: string;
  content: string;
  type: 'text' | 'image' | 'voice' | 'file' | 'announcement';
  fileUrl?: string;
  fileName?: string;
  fileSize?: string;
  voiceDuration?: number; // in seconds
  isPinned?: boolean;
  replyTo?: {
    id: string;
    senderName: string;
    content: string;
  };
  reactions: Record<string, string[]>; // emoji -> array of userIds
  timestamp: string;
  readBy: string[];
}

export interface AuthState {
  currentUser: User | null;
  isAuthenticated: boolean;
}
