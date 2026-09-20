import React, { useState } from 'react';
import { Group, User, Message } from '../types';
import { 
  Search, 
  Plus, 
  Megaphone, 
  Users, 
  CheckCheck, 
  Pin, 
  Sparkles,
  User as UserIcon,
  ShieldCheck
} from 'lucide-react';

interface ChatListProps {
  groups: Group[];
  directUsers: User[];
  messages: Message[];
  currentUser: User;
  onSelectGroup: (group: Group) => void;
  onSelectDirectUser: (user: User) => void;
  onOpenCreateGroup: () => void;
}

export const ChatList: React.FC<ChatListProps> = ({
  groups,
  directUsers,
  messages,
  currentUser,
  onSelectGroup,
  onSelectDirectUser,
  onOpenCreateGroup,
}) => {
  const [filterTab, setFilterTab] = useState<'all' | 'groups' | 'direct'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const isPrincipal = currentUser.role === 'principal';

  // Helper to get last message of a chat
  const getLastMessage = (chatId: string) => {
    const chatMsgs = messages.filter(m => m.chatId === chatId);
    if (chatMsgs.length === 0) return null;
    return chatMsgs[chatMsgs.length - 1];
  };

  // Helper for direct chatId
  const getDirectChatId = (otherUserId: string) => {
    return [currentUser.id, otherUserId].sort().join('_');
  };

  // Filter groups
  const filteredGroups = groups.filter(g => {
    const matchesSearch = g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // Filter direct users
  const filteredDirectUsers = directUsers.filter(u => {
    if (u.id === currentUser.id) return false;
    const matchesSearch = u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.personnelCode.includes(searchQuery);
    return matchesSearch;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Header */}
      <div className="p-3 bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <SchoolIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-100">پیام‌رسان مدرسه</h2>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                <span>آنلاین: {currentUser.fullName.split(' ')[0]}</span>
                {isPrincipal && (
                  <span className="bg-amber-500/20 text-amber-300 text-[9px] px-1.5 py-0.2 rounded font-medium border border-amber-500/30">
                    مدیریت
                  </span>
                )}
              </div>
            </div>
          </div>

          {isPrincipal && (
            <button
              onClick={onOpenCreateGroup}
              className="bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-[11px] font-medium px-2.5 py-1.5 rounded-xl flex items-center gap-1 shadow-md shadow-blue-500/20 transition-all"
              title="تعریف گروه جدید"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>گروه جدید</span>
            </button>
          )}
        </div>

        {/* Search Bar */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجوی گروه، نام همکار یا درس..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 pr-8"
          />
          <Search className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-2.5 pointer-events-none" />
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-1 mt-2 text-[11px]">
          <button
            onClick={() => setFilterTab('all')}
            className={`px-3 py-1 rounded-lg transition-all ${
              filterTab === 'all'
                ? 'bg-blue-600/20 text-blue-400 font-medium border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            همه
          </button>
          <button
            onClick={() => setFilterTab('groups')}
            className={`px-3 py-1 rounded-lg transition-all ${
              filterTab === 'groups'
                ? 'bg-blue-600/20 text-blue-400 font-medium border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            گروه‌های مدرسه ({groups.length})
          </button>
          <button
            onClick={() => setFilterTab('direct')}
            className={`px-3 py-1 rounded-lg transition-all ${
              filterTab === 'direct'
                ? 'bg-blue-600/20 text-blue-400 font-medium border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            همکاران ({directUsers.length - 1})
          </button>
        </div>
      </div>

      {/* Chat List Scrollable Content */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-850/50">
        {/* Groups Section */}
        {(filterTab === 'all' || filterTab === 'groups') && filteredGroups.length > 0 && (
          <div>
            {filterTab === 'all' && (
              <div className="px-3 py-1.5 bg-slate-900/40 text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>گروه‌های همکاران و شوراها</span>
                <span className="text-slate-500">{filteredGroups.length} گروه</span>
              </div>
            )}
            {filteredGroups.map((group) => {
              const lastMsg = getLastMessage(group.id);
              const isAnnouncement = group.isAnnouncementOnly;
              const hasPinned = messages.some(m => m.chatId === group.id && m.isPinned);

              return (
                <div
                  key={group.id}
                  onClick={() => onSelectGroup(group)}
                  className="p-3 hover:bg-slate-900/80 active:bg-slate-850 cursor-pointer transition-colors flex items-center gap-3 relative group"
                >
                  {/* Group Avatar */}
                  <div className="relative shrink-0">
                    <img
                      src={group.avatar}
                      alt={group.name}
                      className="w-11 h-11 rounded-2xl object-cover border border-slate-700/60"
                    />
                    {isAnnouncement && (
                      <span className="absolute -bottom-1 -right-1 bg-amber-500 text-slate-950 p-0.5 rounded-md text-[9px] shadow" title="کانال اعلانات">
                        <Megaphone className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </div>

                  {/* Group Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <h3 className="text-xs font-semibold text-slate-200 truncate">
                          {group.name}
                        </h3>
                        {hasPinned && (
                          <Pin className="w-3 h-3 text-amber-400 shrink-0" />
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 shrink-0 font-mono">
                        {lastMsg?.timestamp || 'جدید'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <p className="truncate text-slate-400 max-w-[200px]">
                        {lastMsg ? (
                          <span>
                            <strong className="font-medium text-slate-300">
                              {lastMsg.senderName.split(' ')[0]}:{' '}
                            </strong>
                            {lastMsg.type === 'voice' ? '🎙️ پیام صوتی' : 
                             lastMsg.type === 'file' ? '📎 فایل پیوست' : 
                             lastMsg.type === 'announcement' ? '📢 بخشنامه مدیریت' : 
                             lastMsg.content}
                          </span>
                        ) : (
                          <span className="italic text-slate-500">{group.description}</span>
                        )}
                      </p>
                      <span className="text-[10px] bg-slate-850 text-slate-400 px-1.5 py-0.5 rounded-full border border-slate-700/50 shrink-0">
                        {group.memberIds.length} عضو
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Direct Messages Section */}
        {(filterTab === 'all' || filterTab === 'direct') && filteredDirectUsers.length > 0 && (
          <div>
            {filterTab === 'all' && (
              <div className="px-3 py-1.5 bg-slate-900/40 text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between border-t border-slate-800/40">
                <span>پیام خصوصی به همکاران</span>
                <span className="text-slate-500">{filteredDirectUsers.length} دبیر</span>
              </div>
            )}
            {filteredDirectUsers.map((user) => {
              const directId = getDirectChatId(user.id);
              const lastMsg = getLastMessage(directId);

              return (
                <div
                  key={user.id}
                  onClick={() => onSelectDirectUser(user)}
                  className="p-3 hover:bg-slate-900/80 active:bg-slate-850 cursor-pointer transition-colors flex items-center gap-3 relative"
                >
                  {/* User Avatar */}
                  <div className="relative shrink-0">
                    <img
                      src={user.avatar}
                      alt={user.fullName}
                      className="w-11 h-11 rounded-2xl object-cover border border-slate-700/60"
                    />
                    {user.isOnline ? (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-slate-950 rounded-full" title="آنلاین"></span>
                    ) : (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-slate-600 border-2 border-slate-950 rounded-full" title="آفلاین"></span>
                    )}
                  </div>

                  {/* User Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <h3 className="text-xs font-semibold text-slate-200 truncate">
                          {user.fullName}
                        </h3>
                        {user.role === 'principal' && (
                          <span className="bg-amber-500/20 text-amber-300 text-[9px] px-1 rounded font-medium border border-amber-500/30">
                            مدیر
                          </span>
                        )}
                        {user.role === 'deputy' && (
                          <span className="bg-purple-500/20 text-purple-300 text-[9px] px-1 rounded font-medium border border-purple-500/30">
                            معاون
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 shrink-0 font-mono">
                        {lastMsg?.timestamp || (user.isOnline ? 'آنلاین' : 'آفلاین')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <p className="truncate text-slate-400 max-w-[210px]">
                        {lastMsg ? (
                          <span>
                            {lastMsg.senderId === currentUser.id ? 'شما: ' : ''}
                            {lastMsg.content}
                          </span>
                        ) : (
                          <span className="text-slate-500">{user.subject}</span>
                        )}
                      </p>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {user.personnelCode}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {filteredGroups.length === 0 && filteredDirectUsers.length === 0 && (
          <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500">
            <Users className="w-10 h-10 mb-2 opacity-40 text-slate-400" />
            <p className="text-xs">هیچ گفتگو یا همکاری یافت نشد</p>
            <p className="text-[11px] text-slate-600 mt-1">می‌توانید عبارت دیگری را جستجو کنید</p>
          </div>
        )}
      </div>
    </div>
  );
};

function SchoolIcon(props: any) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m4 6 8-4 8 4" />
      <path d="m18 10 4 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8l4-2" />
      <path d="M14 22v-4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v4" />
      <path d="M18 5v17" />
      <path d="M6 5v17" />
      <circle cx="12" cy="9" r="2" />
    </svg>
  );
}
