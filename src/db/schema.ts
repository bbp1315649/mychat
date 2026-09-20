import { relations } from 'drizzle-orm';
import { 
  pgTable, 
  text, 
  boolean, 
  integer, 
  timestamp, 
  serial 
} from 'drizzle-orm/pg-core';

// Users table (Principal, Deputies, Teachers)
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  personnelCode: text('personnel_code').notNull().unique(), // 8-digit personnel code
  mobile: text('mobile').notNull(), // 11-digit mobile
  fullName: text('full_name').notNull(),
  subject: text('subject').notNull(),
  role: text('role').notNull().default('teacher'), // 'principal' | 'deputy' | 'teacher'
  avatar: text('avatar').notNull(),
  password: text('password').notNull(),
  isOnline: boolean('is_online').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Groups table (Created by Principal)
export const groups = pgTable('groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  avatar: text('avatar').notNull(),
  isAnnouncementOnly: boolean('is_announcement_only').default(false),
  createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Group Members join table
export const groupMembers = pgTable('group_members', {
  id: serial('id').primaryKey(),
  groupId: text('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow(),
});

// Messages table
export const messages = pgTable('messages', {
  id: text('id').primaryKey(),
  chatId: text('chat_id').notNull(),
  senderId: text('sender_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  senderName: text('sender_name').notNull(),
  senderRole: text('sender_role').notNull(),
  senderAvatar: text('sender_avatar').notNull(),
  content: text('content').notNull(),
  type: text('type').notNull().default('text'), // 'text' | 'voice' | 'circular' | 'file'
  fileUrl: text('file_url'),
  fileName: text('file_name'),
  voiceDuration: integer('voice_duration'),
  isPinned: boolean('is_pinned').default(false),
  replyToId: text('reply_to_id'),
  replyToContent: text('reply_to_content'),
  replyToSender: text('reply_to_sender'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Message Reactions table
export const messageReactions = pgTable('message_reactions', {
  id: serial('id').primaryKey(),
  messageId: text('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  emoji: text('emoji').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Relationships
export const usersRelations = relations(users, ({ many }) => ({
  groupMemberships: many(groupMembers),
  messages: many(messages),
}));

export const groupsRelations = relations(groups, ({ many, one }) => ({
  members: many(groupMembers),
  creator: one(users, {
    fields: [groups.createdBy],
    references: [users.id],
  }),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groups, {
    fields: [groupMembers.groupId],
    references: [groups.id],
  }),
  user: one(users, {
    fields: [groupMembers.userId],
    references: [users.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
  reactions: many(messageReactions),
}));

export const messageReactionsRelations = relations(messageReactions, ({ one }) => ({
  message: one(messages, {
    fields: [messageReactions.messageId],
    references: [messages.id],
  }),
  user: one(users, {
    fields: [messageReactions.userId],
    references: [users.id],
  }),
}));
